/* ============================================================
   ui.js — builds the scroll narrative and keeps it in sync
   ============================================================ */
import { BODIES, PLANETS, byId } from "./data.js";

const JUP_REL = 10.97;
const relBar = rel => Math.min(1, Math.pow(rel / JUP_REL, 0.55));
const pad2 = n => String(n).padStart(2, "0");

/* station order through the experience */
export const STATIONS = [
  { id:"intro", focus:null },
  ...BODIES.map((b,i) => ({ id:b.id, focus:b.id, side: i % 2 ? "right" : "left" })),
  { id:"outro", focus:null }
];

const stat = (label, value, sub = "", wide = false) => `
  <div class="st${wide ? " wide" : ""}">
    <dt>${label}</dt>
    <dd>${value}${sub ? ` <small>${sub}</small>` : ""}</dd>
  </div>`;

function planetPanel(b, n){
  const moons = b.moonNames.length
    ? `<div class="p-moons">${b.moonNames.map((m,i) =>
        `<span class="mn${i < 2 ? " hi" : ""}">${m}</span>`).join("")}
        ${b.moons > b.moonNames.length
          ? `<span class="mn">+${b.moons - b.moonNames.length} more</span>` : ""}</div>`
    : `<div class="p-moons"><span class="mn">no natural satellites</span></div>`;

  const cmp = b.id === "sun"
    ? `<div class="cmp-lbl"><span>Size</span><span>109 × Earth</span></div>
       <div class="cmp-track"><span class="cmp-fill" style="width:100%"></span></div>`
    : `<div class="cmp-lbl"><span>Size vs Earth</span><span>${b.rel.toFixed(2)} ×</span></div>
       <div class="cmp-track">
         <span class="cmp-fill" data-w="${(relBar(b.rel)*100).toFixed(1)}"></span>
         <span class="cmp-earth" style="left:${(relBar(1)*100).toFixed(1)}%"></span>
       </div>`;

  return `
  <div class="panel">
    <div class="p-kicker">
      <span class="p-idx">${pad2(n)}</span>
      <span class="p-cls">${b.cls}</span>
      <i class="p-rule"></i>
    </div>
    <h2 class="p-name">${b.name}</h2>
    <p class="p-native">${b.native}</p>
    <p class="p-tag">${b.tag}</p>
    <dl class="p-stats">
      ${stat("Distance from Sol", b.distKm, b.distAu ? `${b.distAu} AU` : "")}
      ${stat("Orbital period", b.yearStr)}
      ${stat("Rotation", b.dayStr)}
      ${stat("Diameter", `${(b.radiusKm*2).toLocaleString("en-US")} km`)}
      ${stat("Surface gravity", b.gravity)}
      ${stat("Temperature", b.tempC)}
      ${stat("Moons", b.moons === 0 ? "none" : `${b.moons}`, b.moons > 5 ? "confirmed" : "")}
      ${stat("Mass", b.massStr)}
      ${stat("Axial tilt", b.tilt)}
      ${stat("Orbital velocity", b.velKms)}
      ${stat("Composition", b.comp, "", true)}
    </dl>
    <div class="p-cmp">${cmp}</div>
    <div class="p-fact">${b.fact}</div>
    ${moons}
  </div>`;
}

/* ---------- intro ---------- */
const introPanel = () => `
  <div class="panel">
    <p class="hero-eyebrow">A tour of the Solar System</p>
    <h1 class="hero-title">Eight worlds<b>one star</b></h1>
    <p class="hero-lede">
      Everything here is <em>drawn from nothing</em> — every surface, cloud deck and ring
      is synthesised from noise in your browser the moment this page loads.
      <em>Scroll</em> and the system opens up around you, one world at a time.
    </p>
    <div class="hero-meta">
      <div class="hm"><b>10</b><span>worlds</span></div>
      <div class="hm"><b>423</b><span>known moons</span></div>
      <div class="hm"><b>4.6</b><span>billion years</span></div>
      <div class="hm"><b>0</b><span>image files</span></div>
    </div>
    <div class="scroll-cue">SCROLL<i></i></div>
  </div>`;

/* ---------- outro ---------- */
const outroPanel = () => `
  <div class="panel">
    <p class="hero-eyebrow">End of the line</p>
    <h2 class="hero-title sm">The edge is<b>not an edge</b></h2>
    <p class="hero-lede">
      Past Pluto the Kuiper belt thins out for another 950 AU, and the Oort cloud
      may reach halfway to the next star. <em>Voyager 1</em> — launched in 1977 and
      now 25 billion km out — will need roughly 40 000 years to get there.
    </p>
    <div class="out-grid">
      <div class="oc"><b>Drag</b><p>Swing the camera around whatever world you are parked at.</p></div>
      <div class="oc"><b>Shift + wheel</b><p>Push in or pull out without leaving the station.</p></div>
      <div class="oc"><b>Click a world</b><p>Jump straight to its chapter. Hover for a readout.</p></div>
      <div class="oc"><b>T · O · B · R</b><p>Tour, orbit lines, bloom, and true-to-life sizes.</p></div>
    </div>
    <div class="out-cta">
      <button class="cta" data-go="0">Back to the start</button>
      <button class="cta ghost" data-go="4">Return to Earth</button>
    </div>
    <p class="credit">Procedural surfaces · custom GLSL · hand-rolled bloom<br>
      Figures after NASA / JPL planetary fact sheets</p>
  </div>`;

/* accent tints, kept a touch brighter than the body colour so text stays legible */
const softOf = hex => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},.16)`;
};

const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
const ease = k => k * k * (3 - 2 * k);

export class UI {
  constructor(){
    this.root   = document.getElementById("scroll");
    this.rail   = document.getElementById("rail");
    this.tipEl  = document.getElementById("tooltip");
    this.hud    = {
      name: document.getElementById("hudName"),
      au:   document.getElementById("hudAu"),
      vel:  document.getElementById("hudVel"),
      day:  document.getElementById("hudDay"),
      bar:  document.getElementById("hudScale")
    };
    this.fill   = document.getElementById("progressFill");
    this.pos    = 0;          /* float station index — main.js drives the camera off this */
    this.active = -1;
    this.onJump = null;       /* (index) => void, wired by main.js */
    this.marks  = [];
    this.mount();
  }

  mount(){
    const html = STATIONS.map((s, i) => {
      const b = s.focus ? byId(s.focus) : null;
      const side = b ? s.side : "mid";
      const body = !b ? (s.id === "intro" ? introPanel() : outroPanel()) : planetPanel(b, i);
      return `<section class="sect ${side}" id="s-${s.id}" data-i="${i}">${body}</section>`;
    }).join("");
    this.root.innerHTML = html;

    this.sections = [...this.root.children].map((el, i) => ({
      el, i,
      panel: el.querySelector(".panel"),
      fillBar: el.querySelector(".cmp-fill"),
      k: -1, lit: false
    }));

    /* staggered reveal for the stat cells */
    this.sections.forEach(s => [...s.el.querySelectorAll(".st")]
      .forEach((st, j) => { st.style.transitionDelay = `${60 + j * 42}ms`; }));

    this.rail.innerHTML = STATIONS.map((s, i) => {
      const b = s.focus ? byId(s.focus) : null;
      const label = b ? b.name : (s.id === "intro" ? "Start" : "Beyond");
      return `<button class="rl" data-i="${i}" aria-label="Go to ${label}"><span>${label}</span><i></i></button>`;
    }).join("");

    const jump = e => {
      const t = e.target.closest("[data-i],[data-go]");
      if (!t) return;
      const i = +(t.dataset.i ?? t.dataset.go);
      this.goTo(i);
    };
    this.rail.addEventListener("click", jump);
    this.root.addEventListener("click", jump);
  }

  goTo(i){
    i = Math.max(0, Math.min(STATIONS.length - 1, i));
    const y = Math.max(0, this.marks[i] - innerHeight / 2);
    scrollTo({ top: y, behavior: "smooth" });
    this.onJump?.(i);
  }

  goToBody(id){
    const i = STATIONS.findIndex(s => s.focus === id);
    if (i >= 0) this.goTo(i);
  }

  layout(){
    this.marks = this.sections.map(s => s.el.offsetTop + s.el.offsetHeight / 2);
  }

  /* called every frame from the render loop */
  sync(){
    const y = scrollY, vh = innerHeight, c = y + vh / 2, m = this.marks;
    if (!m.length) return;

    /* float station index */
    let p = m.length - 1;
    if (c <= m[0]) p = 0;
    else for (let i = 0; i < m.length - 1; i++){
      if (c <= m[i + 1]){ p = i + (c - m[i]) / (m[i + 1] - m[i] || 1); break; }
    }
    this.pos = p;

    const span = vh * 0.66;
    for (const s of this.sections){
      const k = ease(clamp01(1 - Math.abs(c - m[s.i]) / span));
      if (Math.abs(k - s.k) > 0.002){
        s.k = k;
        s.el.style.setProperty("--k", k.toFixed(3));
      }
      const lit = k > 0.34;
      if (lit !== s.lit){
        s.lit = lit;
        s.panel.classList.toggle("lit", lit);
        if (lit && s.fillBar && !s.fillBar.style.width)
          s.fillBar.style.width = s.fillBar.dataset.w + "%";
      }
    }

    const max = document.documentElement.scrollHeight - vh;
    this.fill.style.width = `${clamp01(max > 0 ? y / max : 0) * 100}%`;

    const a = Math.round(p);
    if (a !== this.active) this.setActive(a);
  }

  setActive(i){
    this.active = i;
    [...this.rail.children].forEach((el, j) => el.classList.toggle("on", j === i));
    const st = STATIONS[i];
    const b = st.focus ? byId(st.focus) : null;

    /* which side the dossier is on — CSS pulls the chrome out of its way */
    const side = b ? (st.side === "left" ? "side-left" : "side-right") : "side-mid";
    document.body.classList.remove("side-left", "side-right", "side-mid");
    document.body.classList.add(side);

    const acc = b ? b.color : "#7ab8ff";
    const rs = document.documentElement.style;
    rs.setProperty("--acc", acc);
    rs.setProperty("--acc-soft", softOf(acc));
    const h = this.hud;
    h.name.textContent = b ? b.name : (i === 0 ? "Solar System" : "Interstellar");
    h.au.textContent   = b ? (b.distAu ? `${b.distAu} AU` : "origin") : "—";
    h.vel.textContent  = b ? b.velKms : "—";
    h.day.textContent  = b ? b.dayStr : "—";
    this.onStation?.(i, b);
  }

  scaleBar(v){ this.hud.bar.style.width = `${clamp01(v) * 100}%`; }

  tip(text, x, y){
    const t = this.tipEl;
    if (!text){ t.classList.remove("on"); return; }
    t.textContent = text;
    t.style.left = `${x}px`;
    t.style.top  = `${y}px`;
    t.classList.add("on");
  }
}


