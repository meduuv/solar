/* ============================================================
   main.js — renderer, camera choreography, input, the loop
   ============================================================ */
import * as THREE from "three";
import { byId } from "./data.js";
import { World } from "./world.js";
import { Post } from "./post.js";
import { UI, STATIONS } from "./ui.js";

const canvas = document.getElementById("gl");
const ldFill = document.getElementById("ldFill");
const ldStep = document.getElementById("ldStep");
const loader = document.getElementById("loader");
const hint   = document.getElementById("hint");
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- renderer ---------- */
const renderer = new THREE.WebGLRenderer({
  canvas, antialias:false, alpha:false, stencil:false,
  powerPreference:"high-performance"
});
/* the composite pass does ACES + gamma by hand, so three must not touch either */
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.autoClear = false;
renderer.setClearColor(0x000000, 1);

let dprCap = 1.8;
const dpr = () => Math.min(devicePixelRatio || 1, dprCap);

const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.25, 9000);
camera.position.set(0, 210, 640);

const world = new World(scene, renderer);
const post  = new Post(renderer, scene, camera, { samples: 4 });
const ui    = new UI();

function resize(){
  /* a hidden or just-restored tab can report 0×0; an aspect of NaN would poison
     the projection matrix and the look-point maths and never recover */
  const w = Math.max(1, innerWidth), h = Math.max(1, innerHeight), d = dpr();
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(d);
  renderer.setSize(w, h, false);
  post.setSize(w, h, d);
  ui.layout();
}

/* ============================================================
   CAMERA CHOREOGRAPHY
   Every station is a shot: a centre, a distance, an elevation and
   a yaw measured from the direction of the Sun — so the lighting
   stays flattering wherever the world happens to be in its orbit.
   ============================================================ */
const DMUL = { sun:3.0, saturn:4.7, uranus:4.0, jupiter:3.5 };
const ELEV = { sun:0.09, saturn:0.30, uranus:0.20, earth:0.15, pluto:0.24 };
const YAW  = { sun:0.35, mercury:-0.62, venus:0.68, earth:-0.55, mars:0.62,
               jupiter:-0.70, saturn:0.78, uranus:-0.58, neptune:0.66, pluto:-0.62 };
const WIDE = { intro:{ dist:660, elev:0.50, yaw:0.30 }, outro:{ dist:980, elev:0.86, yaw:-0.35 } };

const mkPose = () => ({ center:new THREE.Vector3(), dist:1, elev:0, yaw:0, side:0, arc:0 });
const PA = mkPose(), PB = mkPose(), P = mkPose();

function shotOf(i, out){
  const s = STATIONS[i];
  if (!s.focus){
    const w = WIDE[s.id];
    out.center.set(0, 0, 0);
    if (s.id === "outro") world.positionOf("pluto", out.center).multiplyScalar(0.5);
    out.dist = w.dist; out.elev = w.elev; out.yaw = w.yaw; out.side = 0;
    return out;
  }
  world.positionOf(s.focus, out.center);
  out.dist = world.radiusOf(s.focus) * (DMUL[s.focus] || 3.2) + 2.6;
  out.elev = ELEV[s.focus] ?? 0.20;
  out.yaw  = YAW[s.focus] ?? 0.55;
  out.side = s.side === "left" ? -1 : 1;
  return out;
}

const sstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const mix = (a, b, k) => a + (b - a) * k;

function poseAt(p, out){
  const last = STATIONS.length - 1;
  const i = Math.max(0, Math.min(last, Math.floor(p)));
  const j = Math.min(last, i + 1);
  const f = p - i;
  const e = sstep(0.15, 0.87, f);
  shotOf(i, PA); shotOf(j, PB);
  out.center.lerpVectors(PA.center, PB.center, e);
  out.dist = Math.exp(mix(Math.log(PA.dist), Math.log(PB.dist), e));  /* octave-linear zoom */
  out.elev = mix(PA.elev, PB.elev, e);
  out.yaw  = mix(PA.yaw,  PB.yaw,  e);
  out.side = mix(PA.side, PB.side, e);
  out.arc  = 0;

  /* Crossing from one world to another, rise and pull back over the gap —
     otherwise the trip is spent staring at empty space from 12 units away. */
  if (i !== j && STATIONS[i].focus && STATIONS[j].focus){
    const arc = Math.sin(Math.PI * sstep(0.03, 0.97, f));
    const sep = PA.center.distanceTo(PB.center);
    out.dist = out.dist * (1 + arc * 0.55) + arc * sep * 0.32;
    out.elev += arc * 0.34;
    out.arc = arc;
  }
  return out;
}

/* user offsets, folded on top of the scripted shot */
const user = { yaw:0, pitch:0, zoom:1 };

const dirv = new THREE.Vector3(), rightv = new THREE.Vector3();
const tgtPos = new THREE.Vector3(), tgtLook = new THREE.Vector3();
const camLook = new THREE.Vector3();
let seeded = false;

function frameCamera(dt){
  poseAt(ui.pos, P);

  if (P.center.lengthSq() < 1e-6) dirv.set(0, 0, 1);
  else dirv.copy(P.center).normalize().negate();          /* toward the Sun */

  const yaw = P.yaw + user.yaw;
  const el  = Math.max(-1.32, Math.min(1.32, P.elev + user.pitch));
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const x  = dirv.x * cy + dirv.z * sy, z = -dirv.x * sy + dirv.z * cy;
  const ce = Math.cos(el);
  dirv.set(x * ce, Math.sin(el), z * ce).normalize();

  const d = P.dist * user.zoom;
  tgtPos.copy(P.center).addScaledVector(dirv, d);
  tgtLook.copy(P.center);

  /* slide the look-point sideways so the panel never sits on top of the world */
  if (innerWidth > 900){
    rightv.set(dirv.z, 0, -dirv.x).normalize();
    const amt = 0.30 * d * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)
              * camera.aspect * (1 - P.arc * 0.8);
    tgtLook.addScaledVector(rightv, P.side * amt);
  }

  if (!seeded){ camera.position.copy(tgtPos); camLook.copy(tgtLook); seeded = true; }
  const kp = 1 - Math.exp(-dt * 9.5), kl = 1 - Math.exp(-dt * 7.5);
  camera.position.lerp(tgtPos, kp);
  camLook.lerp(tgtLook, kl);
  /* a single bad frame must not black out the canvas forever */
  if (!Number.isFinite(camLook.x + camLook.y + camLook.z)) camLook.copy(tgtLook);
  camera.lookAt(camLook);
}

/* ============================================================
   INPUT
   ============================================================ */
const state = { tour:false, orbits:true, bloom:true, truth:0, truthTgt:0 };
const btn = {
  tour:   document.getElementById("btnTour"),
  orbits: document.getElementById("btnOrbits"),
  bloom:  document.getElementById("btnBloom"),
  truth:  document.getElementById("btnTrue")
};
btn.truth.classList.add("off");

const overUI = t => !!(t.closest && t.closest(".panel,#rail,#toolbar,#brand,#hud,#loader"));

/* --- drag to orbit --- */
let drag = null, lastMoved = 0;
addEventListener("pointerdown", e => {
  if (e.button !== 0 || e.pointerType === "touch" || overUI(e.target)) return;
  drag = { x:e.clientX, y:e.clientY, moved:0 };
  document.body.classList.add("dragging");
});
addEventListener("pointermove", e => {
  if (drag){
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    user.yaw   -= dx * 0.0052;
    user.pitch += dy * 0.0040;
    return;
  }
  hover(e);
});
addEventListener("pointerup", () => {
  document.body.classList.remove("dragging");
  lastMoved = drag ? drag.moved : 0;
  drag = null;
});

/* --- shift+wheel zooms without stealing the scroll --- */
addEventListener("wheel", e => {
  if (!e.shiftKey) return;
  e.preventDefault();
  user.zoom = Math.max(0.34, Math.min(3.4, user.zoom * Math.exp(e.deltaY * 0.0011)));
}, { passive:false });

/* --- hover + click picking --- */
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let hovered = null;

function pick(e){
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(world.pickables, false)[0];
  return hit ? label(hit.object) : null;
}

function label(mesh){
  const b = byId(mesh.name);
  if (b) return { id:b.id, text:`${b.name} — ${b.cls}` };
  for (const [id, it] of world.items){
    if (it.moons?.some(m => m.mesh === mesh))
      return { id, text:`${mesh.name} — moon of ${it.body.name}` };
  }
  return null;
}

function hover(e){
  if (overUI(e.target)){
    if (hovered){ hovered = null; ui.tip(null); document.body.classList.remove("hovering"); }
    return;
  }
  const h = pick(e);
  const key = h ? h.text : null;
  if (key !== (hovered && hovered.text)){
    hovered = h;
    document.body.classList.toggle("hovering", !!h);
    ui.tip(h ? h.text : null, e.clientX, e.clientY);
  } else if (h){
    ui.tip(h.text, e.clientX, e.clientY);
  }
}

addEventListener("click", e => {
  if (overUI(e.target) || lastMoved > 6) return;
  const h = pick(e);
  if (h) ui.goToBody(h.id);
});

/* --- toggles --- */
function setOrbits(v){
  state.orbits = v;
  world.setOrbitOpacity(v ? 0.5 : 0);
  btn.orbits.classList.toggle("off", !v);
}
function setBloom(v){
  state.bloom = v;
  post.enabled = v;
  btn.bloom.classList.toggle("off", !v);
}
function setTruth(v){
  state.truthTgt = v ? 1 : 0;
  btn.truth.classList.toggle("off", !v);
}
function setTour(v){
  state.tour = v;
  btn.tour.textContent = v ? "■ STOP" : "▶ TOUR";
}

btn.orbits.onclick = () => setOrbits(!state.orbits);
btn.bloom .onclick = () => setBloom(!state.bloom);
btn.truth .onclick = () => setTruth(!state.truthTgt);
btn.tour  .onclick = () => setTour(!state.tour);

addEventListener("keydown", e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === "t") setTour(!state.tour);
  else if (k === "o") setOrbits(!state.orbits);
  else if (k === "b") setBloom(!state.bloom);
  else if (k === "r") setTruth(!state.truthTgt);
  else if (k === " " || k === "arrowdown" || k === "pagedown"){ e.preventDefault(); ui.goTo(Math.round(ui.pos) + 1); }
  else if (k === "arrowup" || k === "pageup"){ e.preventDefault(); ui.goTo(Math.round(ui.pos) - 1); }
  else if (k === "home"){ e.preventDefault(); ui.goTo(0); }
  else if (k === "end"){ e.preventDefault(); ui.goTo(STATIONS.length - 1); }
  else if (k >= "0" && k <= "9") ui.goTo(k === "0" ? 10 : +k);
  else return;
  hint?.classList.add("gone");
});

/* arriving somewhere new resets the framing the user was fiddling with */
ui.onStation = (i, b) => {
  user.yaw = 0; user.pitch = 0; user.zoom = 1;
  ui.scaleBar(b ? Math.min(1, (b.distAu || 0) / 39.48) : (i === 0 ? 0 : 1));
};

addEventListener("scroll", () => {
  if (scrollY > 80) hint?.classList.add("gone");
}, { passive:true });

/* ============================================================
   BOOT + LOOP
   ============================================================ */
const clock = new THREE.Clock();
let frames = 0, acc = 0, judged = false;

function loop(){
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, clock.getDelta());
  const t  = clock.elapsedTime;

  if (state.tour){
    const max = document.documentElement.scrollHeight - innerHeight;
    const y = Math.min(max, scrollY + innerHeight * 0.19 * dt);
    scrollTo(0, y);
    if (y >= max - 1) setTour(false);
  }

  ui.sync();
  state.truth += (state.truthTgt - state.truth) * (1 - Math.exp(-dt * 3.4));
  world.trueScale = state.truth;
  world.update(t, dt, camera, reduce ? 0.25 : 1);
  frameCamera(dt);
  post.render();

  /* one-shot watchdog: shed the expensive pass if we cannot hold ~34 fps */
  if (!judged){
    acc += dt; frames++;
    if (frames > 110){
      judged = true;
      if (acc / frames > 0.029 && state.bloom){ setBloom(false); dprCap = 1.35; resize(); }
    }
  }
}

async function boot(){
  history.scrollRestoration = "manual";
  scrollTo(0, 0);
  resize();
  addEventListener("resize", resize);
  await world.build((p, step) => {
    ldFill.style.width = `${Math.round(p * 100)}%`;
    ldStep.textContent = `${step}…`;
  });
  ui.layout();
  ui.sync();
  frameCamera(1);
  loader.classList.add("done");
  setTimeout(() => loader.remove(), 1000);
  clock.start();
  requestAnimationFrame(loop);
}

window.ATLAS = { world, camera, post, ui, state, user };
boot();

