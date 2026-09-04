/* ============================================================
   world.js — assembles the Solar System
   ============================================================ */
import * as THREE from "three";
import { BODIES, PLANETS, byId, dispRadius } from "./data.js";
import { buildSurface, ringTexture, radialTexture, moonSurface, MOON_PAL } from "./textures.js";
import * as S from "./shaders.js";

const SUN_COLOR = new THREE.Color(1.0, 0.955, 0.90);
let GLINT_TEX = null;

/* atmospheres: colour, fresnel power, intensity, shell scale */
const ATMO = {
  mercury:null,
  venus:  { c:"#ffd9a0", p:2.2, i:1.45, s:1.075 },
  earth:  { c:"#5aa9ff", p:2.7, i:1.65, s:1.055 },
  mars:   { c:"#ff9d6e", p:3.0, i:0.60, s:1.030 },
  jupiter:{ c:"#ffcf9a", p:2.9, i:0.90, s:1.032 },
  saturn: { c:"#ffe6b8", p:2.9, i:0.85, s:1.032 },
  uranus: { c:"#9df0f5", p:2.6, i:1.05, s:1.048 },
  neptune:{ c:"#7f9dff", p:2.6, i:1.10, s:1.048 },
  pluto:  { c:"#e8d5c0", p:3.3, i:0.35, s:1.022 }
};

/* orbital inclinations, degrees */
const INC = { mercury:7.0, venus:3.4, earth:0, mars:1.85, jupiter:1.3,
              saturn:2.49, uranus:0.77, neptune:1.77, pluto:17.16 };

/* instanced asteroid rocks */
const ROCK_VERT = /* glsl */`
attribute float aTint;
varying vec3 vN;
varying vec3 vWP;
varying float vT;
void main(){
  vT = aTint;
  #ifdef USE_INSTANCING
    mat4 im = instanceMatrix;
  #else
    mat4 im = mat4(1.0);
  #endif
  vec4 wp = modelMatrix * im * vec4(position, 1.0);
  vWP = wp.xyz;
  vN = normalize(mat3(modelMatrix) * (mat3(im) * normal));
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const ROCK_FRAG = /* glsl */`
precision highp float;
uniform vec3 uSun;
uniform float uFade;
varying vec3 vN;
varying vec3 vWP;
varying float vT;
void main(){
  vec3 N = normalize(vN);
  vec3 L = normalize(-vWP);
  vec3 V = normalize(cameraPosition - vWP);
  float d = smoothstep(-0.1, 0.4, dot(N, L));
  /* real asteroids are charcoal — keep them dark or they read as popcorn */
  vec3 base = mix(vec3(0.105,0.094,0.082), vec3(0.20,0.175,0.147), vT);
  float rim = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0);
  vec3 col = base * (d * uSun * 1.05 + 0.03) + vec3(0.5,0.42,0.34) * rim * 0.07 * d;
  gl_FragColor = vec4(col * uFade, 1.0);
}
`;

/* a ring with radial UVs, lying in the XZ plane */
function ringGeo(inner, outer, seg){
  const g = new THREE.RingGeometry(inner, outer, seg, 2);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++){
    const r = Math.hypot(p.getX(i), p.getY(i));
    uv.setXY(i, (r - inner) / (outer - inner), 0.5);
  }
  g.rotateX(-Math.PI / 2);
  return g;
}


/* notable moons — radius in km, orbit in planet radii */
const MOONS = {
  earth:  [["Moon",1737.4,3.4,0.55,"luna",150]],
  mars:   [["Phobos",11.3,2.2,1.90,"rusty",70],["Deimos",6.2,3.4,1.05,"rusty",50]],
  jupiter:[["Io",1821.6,2.5,1.25,"sulfur",40],["Europa",1560.8,3.3,0.92,"icy",30],
           ["Ganymede",2634.1,4.3,0.66,"luna",120],["Callisto",2410.3,5.6,0.48,"luna",170]],
  saturn: [["Titan",2574.7,3.6,0.72,"rusty",60],["Enceladus",252.1,2.75,1.15,"icy",40],
           ["Iapetus",734.5,5.2,0.42,"luna",120]],
  uranus: [["Titania",788.4,2.9,0.8,"icy",90],["Oberon",761.4,3.8,0.6,"luna",110]],
  neptune:[["Triton",1353.4,3.2,-0.75,"icy",70]],
  pluto:  [["Charon",606,3.1,0.5,"luna",90]]
};

export class World {
  constructor(scene, renderer){
    this.scene = scene;
    this.renderer = renderer;
    this.items = new Map();          // id → { body, holder, tilt, mesh, ... }
    this.pickables = [];
    this.orbits = [];
    this.t = 0;
    this.orbitsVisible = true;
    this.trueScale = 0;              // 0 = readable, 1 = true relative sizes
  }

  /* ---------------- backdrop ---------------- */
  buildSky(){
    const geo = new THREE.SphereGeometry(6000, 48, 32);
    const mat = new THREE.ShaderMaterial({
      vertexShader: S.SKY_VERT, fragmentShader: S.SKY_FRAG,
      uniforms: { uIntensity: { value: 0.26 } },
      side: THREE.BackSide, depthWrite: false, depthTest: false
    });
    this.sky = new THREE.Mesh(geo, mat);
    this.sky.renderOrder = -100;
    this.sky.frustumCulled = false;
    this.scene.add(this.sky);
  }

  /* ---------------- stars ---------------- */
  buildStars(count = 14000){
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const phase = new Float32Array(count);
    const c = new THREE.Color();
    for (let i = 0; i < count; i++){
      /* uniform on a shell, pushed toward the galactic band */
      let x, y, z, l;
      do { x = Math.random()*2-1; y = Math.random()*2-1; z = Math.random()*2-1; l = Math.hypot(x,y,z); }
      while (l > 1 || l < 0.001);
      const band = Math.pow(Math.random(), 2.2);
      y *= 1 - band * 0.72;
      const n = Math.hypot(x,y,z) || 1;
      const R = 3400 + Math.random() * 1400;
      pos[i*3] = x/n*R; pos[i*3+1] = y/n*R; pos[i*3+2] = z/n*R;

      const t = Math.random();
      // spectral mix: mostly cool white, some blue, some amber
      if (t < 0.62)      c.setHSL(0.58, 0.10 + Math.random()*0.18, 0.86);
      else if (t < 0.82) c.setHSL(0.60, 0.55, 0.78);
      else if (t < 0.95) c.setHSL(0.09, 0.55, 0.76);
      else               c.setHSL(0.02, 0.70, 0.72);
      col[i*3] = c.r; col[i*3+1] = c.g; col[i*3+2] = c.b;
      size[i] = 0.8 + Math.pow(Math.random(), 7) * 5.2;
      phase[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    g.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
    this.starMat = new THREE.ShaderMaterial({
      vertexShader: S.STAR_VERT, fragmentShader: S.STAR_FRAG,
      uniforms: {
        uTime:{ value:0 }, uDpr:{ value: Math.min(devicePixelRatio, 2) }, uMul:{ value:1 }
      },
      transparent: true, blending: THREE.AdditiveBlending,
      depthWrite: false, depthTest: true
    });
    this.stars = new THREE.Points(g, this.starMat);
    this.stars.renderOrder = -90;
    this.stars.frustumCulled = false;
    this.scene.add(this.stars);
  }

  /* ---------------- the Sun ---------------- */
  buildSun(){
    const b = byId("sun");
    const holder = new THREE.Object3D();
    this.scene.add(holder);

    const mat = new THREE.ShaderMaterial({
      vertexShader: S.VERT_WORLD, fragmentShader: S.SUN_FRAG,
      uniforms: { uTime:{ value:0 }, uFade:{ value:1 } }
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(b.R, 96, 64), mat);
    mesh.name = "sun";
    holder.add(mesh);

    /* corona billboard */
    const cMat = new THREE.ShaderMaterial({
      vertexShader: S.CORONA_VERT, fragmentShader: S.CORONA_FRAG,
      uniforms: { uTime:{ value:0 }, uColor:{ value:new THREE.Color(1.0,0.52,0.16) }, uFade:{ value:1 } },
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
    });
    const corona = new THREE.Mesh(new THREE.PlaneGeometry(b.R * 11, b.R * 11), cMat);
    holder.add(corona);

    /* light for the moons/rings that use standard-ish lighting */
    const light = new THREE.PointLight(0xfff0d8, 3.2, 0, 0);
    holder.add(light);

    this.sun = { body:b, holder, mesh, mat, corona, cMat };
    this.pickables.push(mesh);
    this.items.set("sun", { body:b, holder, tilt:holder, mesh, mat, radius:() => b.R });
  }

  /* ---------------- orbit trails ---------------- */
  buildOrbit(b){
    const N = 512;
    const pos = new Float32Array(N * 3), ang = new Float32Array(N);
    for (let i = 0; i < N; i++){
      const a = (i / N) * Math.PI * 2;
      pos[i*3] = Math.cos(a) * b.OR; pos[i*3+1] = 0; pos[i*3+2] = Math.sin(a) * b.OR;
      ang[i] = i / N;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aA", new THREE.BufferAttribute(ang, 1));
    const mat = new THREE.ShaderMaterial({
      vertexShader: S.ORBIT_VERT, fragmentShader: S.ORBIT_FRAG,
      uniforms: {
        uColor:{ value:new THREE.Color(b.color) },
        uHead:{ value:0 }, uOpacity:{ value:0.5 }
      },
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
    });
    const line = new THREE.LineLoop(g, mat);
    line.rotation.x = 0.0;
    this.scene.add(line);
    this.orbits.push({ b, line, mat });
    return { line, mat };
  }

  /* ---------------- a planet, with everything attached ---------------- */
  buildPlanet(b){
    const surf = buildSurface(b);
    const holder = new THREE.Object3D();
    this.scene.add(holder);
    const tilt = new THREE.Object3D();
    tilt.rotation.z = THREE.MathUtils.degToRad(parseFloat(b.tilt) || 0);
    holder.add(tilt);
    const spin = new THREE.Object3D();
    tilt.add(spin);

    const sunI = 1.5 * Math.pow(1 / Math.max(b.distAu, 0.2), 0.22);
    const term = b.kind === "gas" || b.kind === "ice" ? 0.24 : b.id === "earth" ? 0.13 : 0.07;

    const mat = new THREE.ShaderMaterial({
      vertexShader: S.VERT_WORLD, fragmentShader: S.PLANET_FRAG,
      uniforms: {
        uMap:{ value:surf.map }, uNormal:{ value:surf.normalMap },
        uNight:{ value:surf.nightMap || surf.map }, uSpec:{ value:surf.specMap || surf.map },
        uRim:{ value:new THREE.Color(b.rim) }, uSun:{ value:SUN_COLOR },
        uNormalScale:{ value:b.kind === "gas" || b.kind === "ice" ? 0.35 : 1.05 },
        uAmbient:{ value:0.045 }, uSunI:{ value:sunI },
        uRimP:{ value:3.1 }, uRimI:{ value:b.kind === "rock" ? 0.32 : 0.7 },
        uTerm:{ value:term }, uGloss:{ value:1.35 },
        uHasNight:{ value:surf.nightMap ? 1 : 0 }, uHasSpec:{ value:surf.specMap ? 1 : 0 },
        uFade:{ value:1 }
      }
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(b.R, 96, 64), mat);
    mesh.name = b.id;
    spin.add(mesh);

    const item = { body:b, holder, tilt, spin, mesh, mat, moons:[], extras:[] };

    /* --- atmosphere --- */
    const A = ATMO[b.id];
    if (A){
      const aMat = new THREE.ShaderMaterial({
        vertexShader: S.VERT_WORLD, fragmentShader: S.ATMO_FRAG,
        uniforms: { uColor:{ value:new THREE.Color(A.c) }, uPow:{ value:A.p },
                    uIntensity:{ value:A.i }, uFade:{ value:1 } },
        transparent: true, blending: THREE.AdditiveBlending,
        side: THREE.BackSide, depthWrite: false
      });
      const halo = new THREE.Mesh(new THREE.SphereGeometry(b.R * A.s, 64, 48), aMat);
      tilt.add(halo);
      item.halo = halo; item.aMat = aMat; item.extras.push(aMat);
    }

    /* --- clouds --- */
    if (surf.cloudMap){
      const cMat = new THREE.ShaderMaterial({
        vertexShader: S.VERT_WORLD, fragmentShader: S.CLOUD_FRAG,
        uniforms: { uMap:{ value:surf.cloudMap }, uFade:{ value:1 } },
        transparent: true, depthWrite: false
      });
      const cl = new THREE.Mesh(new THREE.SphereGeometry(b.R * 1.014, 80, 56), cMat);
      spin.add(cl);
      item.clouds = cl; item.cMat = cMat; item.extras.push(cMat);
    }

    /* --- rings --- */
    if (b.ring){
      const inner = b.R * b.ring.inner, outer = b.R * b.ring.outer;
      const g = ringGeo(inner, outer, 320);
      const rMat = new THREE.ShaderMaterial({
        vertexShader: S.VERT_WORLD, fragmentShader: S.RING_FRAG,
        uniforms: { uMap:{ value:ringTexture(!!b.ring.faint) },
                    uCenter:{ value:new THREE.Vector3() },
                    uPlanetR:{ value:b.R }, uFade:{ value:1 } },
        transparent: true, side: THREE.DoubleSide, depthWrite: false
      });
      const ring = new THREE.Mesh(g, rMat);
      tilt.add(ring);
      item.ring = ring; item.rMat = rMat; item.extras.push(rMat);
    }

    /* --- moons --- */
    for (const [name, km, dist, spd, pal, cr] of (MOONS[b.id] || [])){
      const surfM = moonSurface(b.id + name, MOON_PAL[pal], cr);
      const mr = Math.max(dispRadius(km) * 0.55, b.R * 0.045);
      const mMat = new THREE.ShaderMaterial({
        vertexShader: S.VERT_WORLD, fragmentShader: S.PLANET_FRAG,
        uniforms: {
          uMap:{ value:surfM.map }, uNormal:{ value:surfM.normalMap },
          uNight:{ value:surfM.map }, uSpec:{ value:surfM.map },
          uRim:{ value:new THREE.Color(0x9fb0c8) }, uSun:{ value:SUN_COLOR },
          uNormalScale:{ value:1.25 }, uAmbient:{ value:0.05 }, uSunI:{ value:sunI },
          uRimP:{ value:3.4 }, uRimI:{ value:0.22 }, uTerm:{ value:0.06 },
          uGloss:{ value:0 }, uHasNight:{ value:0 }, uHasSpec:{ value:0 }, uFade:{ value:1 }
        }
      });
      const m = new THREE.Mesh(new THREE.SphereGeometry(mr, 40, 28), mMat);
      m.name = name;
      const pivot = new THREE.Object3D();
      pivot.rotation.x = (Math.random() - 0.5) * 0.25;
      m.position.x = b.R * dist;
      pivot.add(m);
      tilt.add(pivot);
      item.moons.push({ name, mesh:m, pivot, spd, mMat, dist: b.R * dist, r: mr });
      item.extras.push(mMat);
      this.pickables.push(m);
    }

    this.pickables.push(mesh);
    this.items.set(b.id, item);
    this.buildOrbit(b);

    /* a star-like glint so distant worlds are still visible */
    GLINT_TEX = GLINT_TEX || radialTexture(128, 2.4, [255,255,255], 0.45);
    const glint = new THREE.Sprite(new THREE.SpriteMaterial({
      map: GLINT_TEX, color: new THREE.Color(b.color),
      blending: THREE.AdditiveBlending, transparent: true, depthWrite: false
    }));
    glint.scale.setScalar(b.R * 6);
    holder.add(glint);
    item.glint = glint;

    return item;
  }

  /* ---------------- the asteroid belt ---------------- */
  buildBelt(count = 1400){
    const g = new THREE.IcosahedronGeometry(1, 0);
    /* rough up the rocks so they are not obviously spheres */
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++){
      const s = 0.62 + Math.random() * 0.7;
      p.setXYZ(i, p.getX(i)*s, p.getY(i)*s*0.86, p.getZ(i)*s);
    }
    g.computeVertexNormals();

    const mat = new THREE.ShaderMaterial({
      vertexShader: ROCK_VERT, fragmentShader: ROCK_FRAG,
      uniforms: { uSun:{ value:SUN_COLOR }, uFade:{ value:1 } }
    });
    const inner = byId("mars").OR * 1.16, outer = byId("jupiter").OR * 0.82;
    const mesh = new THREE.InstancedMesh(g, mat, count);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    const pos = new THREE.Vector3(), sc = new THREE.Vector3();
    const tint = new Float32Array(count);
    for (let i = 0; i < count; i++){
      const a = Math.random() * Math.PI * 2;
      const r = inner + Math.pow(Math.random(), 0.72) * (outer - inner);
      const y = (Math.random() - 0.5) * (outer - inner) * 0.10;
      pos.set(Math.cos(a) * r, y, Math.sin(a) * r);
      const s = 0.14 + Math.pow(Math.random(), 3.4) * 0.85;
      sc.set(s, s, s);
      e.set(Math.random()*6.28, Math.random()*6.28, Math.random()*6.28);
      q.setFromEuler(e);
      m.compose(pos, q, sc);
      mesh.setMatrixAt(i, m);
      tint[i] = Math.random();
    }
    g.setAttribute("aTint", new THREE.InstancedBufferAttribute(tint, 1));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    this.belt = { mesh, mat };
  }

  /* ---------------- Kuiper belt haze ---------------- */
  buildKuiper(count = 5000){
    const pos = new Float32Array(count*3), col = new Float32Array(count*3);
    const size = new Float32Array(count), phase = new Float32Array(count);
    const inner = byId("neptune").OR * 1.06, outer = byId("pluto").OR * 1.42;
    const c = new THREE.Color();
    for (let i = 0; i < count; i++){
      const a = Math.random()*Math.PI*2;
      const r = inner + Math.random()*(outer-inner);
      const y = (Math.random()-0.5)*(outer-inner)*0.22;
      pos[i*3] = Math.cos(a)*r; pos[i*3+1] = y; pos[i*3+2] = Math.sin(a)*r;
      c.setHSL(0.55 + Math.random()*0.08, 0.25, 0.55 + Math.random()*0.25);
      col[i*3] = c.r; col[i*3+1] = c.g; col[i*3+2] = c.b;
      size[i] = 0.7 + Math.pow(Math.random(), 4) * 2.6;
      phase[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos,3));
    g.setAttribute("aColor", new THREE.BufferAttribute(col,3));
    g.setAttribute("aSize", new THREE.BufferAttribute(size,1));
    g.setAttribute("aPhase", new THREE.BufferAttribute(phase,1));
    this.kuiperMat = new THREE.ShaderMaterial({
      vertexShader: S.STAR_VERT, fragmentShader: S.STAR_FRAG,
      uniforms:{ uTime:{value:0}, uDpr:{value:Math.min(devicePixelRatio,2)}, uMul:{value:0.75} },
      transparent:true, blending:THREE.AdditiveBlending, depthWrite:false
    });
    this.kuiper = new THREE.Points(g, this.kuiperMat);
    this.kuiper.frustumCulled = false;
    this.scene.add(this.kuiper);
  }

  /* ---------------- progressive build ---------------- */
  async build(onStep){
    const jup = byId("jupiter");
    for (const b of BODIES) b.trueRatio = (b.radiusKm / jup.radiusKm) * (jup.R / b.R);

    const steps = [
      ["mapping the sky",      () => { this.buildSky(); this.buildStars(); }],
      ["igniting Sol",         () => this.buildSun()],
      ...PLANETS.map(b => [`forging ${b.name}`, () => this.buildPlanet(b)]),
      ["scattering the belt",  () => this.buildBelt()],
      ["seeding the Kuiper belt", () => this.buildKuiper()]
    ];
    for (let i = 0; i < steps.length; i++){
      onStep?.(i / steps.length, steps[i][0]);
      await nextFrame();
      steps[i][1]();
    }
    onStep?.(1, "systems nominal");
  }

  /* ---------------- per-frame ---------------- */
  update(t, dt, camera, timeScale = 1){
    this.t = t;
    const T = t * timeScale;
    this.projScale = (innerHeight / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);

    if (this.sun){
      this.sun.mat.uniforms.uTime.value = t;
      this.sun.cMat.uniforms.uTime.value = t;
      this.sun.corona.quaternion.copy(camera.quaternion);      /* billboard */
      this.sun.mesh.rotation.y += dt * 0.02;
    }
    if (this.starMat) this.starMat.uniforms.uTime.value = t;
    if (this.kuiperMat) this.kuiperMat.uniforms.uTime.value = t;

    for (const [id, it] of this.items){
      const b = it.body;
      if (id === "sun") continue;

      /* orbit */
      const a = b.phase + T * b.orbit;
      const inc = THREE.MathUtils.degToRad(INC[id] || 0);
      const ca = Math.cos(a), sa = Math.sin(a);
      it.holder.position.set(ca * b.OR, -Math.sin(inc) * sa * b.OR, Math.cos(inc) * sa * b.OR);
      it.angle = a;

      /* spin */
      it.spin.rotation.y += b.spin * dt * 8;

      /* readable ↔ true scale */
      const k = 1 + (b.trueRatio - 1) * this.trueScale;
      it.tilt.scale.setScalar(k);
      it.scaleK = k;

      /* moons */
      for (const mo of it.moons) mo.pivot.rotation.y = T * mo.spd * 1.6;

      /* rings need to know where the shadow comes from */
      if (it.rMat){
        it.rMat.uniforms.uCenter.value.copy(it.holder.position);
        it.rMat.uniforms.uPlanetR.value = b.R * k;
      }

      /* distant worlds read as bright points */
      if (it.glint){
        const d = camera.position.distanceTo(it.holder.position);
        const px = (b.R * k / Math.max(d, 1)) * this.projScale;
        const vis = 1 - smoothstep01(2.0, 11.0, px);
        it.glint.material.opacity = vis * 0.95;
        it.glint.visible = vis > 0.01;
        it.glint.scale.setScalar(Math.max(b.R * k * 2.6, d * 0.013));
      }
    }

    for (const o of this.orbits){
      const it = this.items.get(o.b.id);
      o.mat.uniforms.uHead.value = ((it.angle / (Math.PI*2)) % 1 + 1) % 1;
      o.line.rotation.x = THREE.MathUtils.degToRad(INC[o.b.id] || 0);
    }
  }

  radiusOf(id){
    const it = this.items.get(id);
    if (!it) return 1;
    return it.body.R * (id === "sun" ? 1 : (it.scaleK ?? 1));
  }

  positionOf(id, out = new THREE.Vector3()){
    const it = this.items.get(id);
    return it ? out.copy(it.holder.position) : out.set(0,0,0);
  }

  setOrbitOpacity(v){
    for (const o of this.orbits) o.mat.uniforms.uOpacity.value = v;
  }
}

/* Yield long enough for the browser to paint the loader between steps.
   rAF is parked in a hidden tab, so a timer races it — otherwise switching
   away mid-load leaves you staring at a frozen progress bar. */
const nextFrame = () => new Promise(res => {
  let done = false;
  const go = () => { if (!done){ done = true; res(); } };
  requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(go, 0)));
  setTimeout(go, 90);
});

function smoothstep01(e0, e1, x){
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}







