/* ============================================================
   textures.js — every world's surface is generated here, at
   runtime, from noise. No image files, no network.
   ============================================================ */
import * as THREE from "three";
import { fbm, ridged, warped, noise3, clamp, lerp, smoothstep, rng, hex2rgb } from "./noise.js";

/* ---------- tiny helpers ---------- */
function cv(w,h){ const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }

function tex(canvas, { srgb = true, wrapS = THREE.RepeatWrapping } = {}){
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = wrapS; t.wrapT = THREE.ClampToEdgeWrapping;
  t.anisotropy = 8; t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

/* multi-stop colour ramp → [r,g,b] 0-255 */
function ramp(stops, t){
  t = clamp(t);
  for (let i = 0; i < stops.length - 1; i++){
    const [p0,c0] = stops[i], [p1,c1] = stops[i+1];
    if (t <= p1){
      const k = p1 === p0 ? 0 : (t - p0) / (p1 - p0);
      const a = hex2rgb(c0), b = hex2rgb(c1);
      return [lerp(a[0],b[0],k), lerp(a[1],b[1],k), lerp(a[2],b[2],k)];
    }
  }
  return hex2rgb(stops[stops.length-1][1]);
}

/* direction vector for a pixel of an equirectangular map */
function dirAt(i, j, W, H, out){
  const lon = ((i + 0.5) / W) * Math.PI * 2;
  const lat = (0.5 - (j + 0.5) / H) * Math.PI;
  const cl = Math.cos(lat);
  out[0] = cl * Math.cos(lon); out[1] = Math.sin(lat); out[2] = cl * Math.sin(lon);
  return out;
}

/* ---------- palettes ---------- */
const PAL = {
  mercury:[[0,"#3c352c"],[.32,"#6a6053"],[.52,"#8d8272"],[.74,"#b5a996"],[1,"#ded4c3"]],
  pluto:  [[0,"#4c382a"],[.28,"#84654c"],[.5,"#b18b69"],[.72,"#dcc0a2"],[1,"#f6ecdd"]],
  mars:   [[0,"#4e2414"],[.26,"#8a3d21"],[.48,"#b3552c"],[.66,"#c97243"],[.84,"#dc9a68"],[1,"#f0cfa8"]],
  venus:  [[0,"#8e6530"],[.3,"#c1934c"],[.56,"#e0ba74"],[.78,"#f3daa4"],[1,"#fdf3d6"]],
  jupiter:[[0,"#6b4526"],[.18,"#96653c"],[.36,"#c49461"],[.54,"#e6cba2"],[.72,"#f6e8cd"],[.88,"#c08e5c"],[1,"#8a5c34"]],
  saturn: [[0,"#7d5f33"],[.2,"#a9884f"],[.42,"#d2b47f"],[.62,"#eddfb4"],[.8,"#f7eed2"],[1,"#bb9660"]],
  uranus: [[0,"#2c7f88"],[.3,"#4fa8b1"],[.58,"#79ccd4"],[.8,"#a5e6ea"],[1,"#cdf5f6"]],
  neptune:[[0,"#152479"],[.26,"#22369c"],[.5,"#3554c4"],[.72,"#5b7ee4"],[.9,"#8fa9f3"],[1,"#c2d2fb"]]
};

const EARTH_SEA  = [[0,"#03162e"],[.4,"#052a54"],[.72,"#0a4b84"],[1,"#1d7ab5"]];
const EARTH_LAND = [[0,"#c8b688"],[.08,"#5d7a3a"],[.3,"#2f6b34"],[.52,"#1e4f28"],[.7,"#5f6b40"],[.86,"#7b6f5a"],[1,"#eff5ff"]];

/* ============================================================
   CRATERS — applied to a heightfield inside a lon/lat bbox
   ============================================================ */
function stampCraters(h, W, H, count, seed){
  const rand = rng(seed);
  for (let n = 0; n < count; n++){
    const lat0 = Math.asin(rand() * 2 - 1);
    const lon0 = rand() * Math.PI * 2;
    const big  = rand();
    const R    = (0.012 + Math.pow(big, 3.2) * 0.19) * Math.PI;   // angular radius
    const deep = (0.035 + rand() * 0.075) * (0.4 + big * 0.9);
    const c0 = Math.cos(lat0), s0 = Math.sin(lat0);
    const jr = Math.ceil((R / Math.PI) * H) + 2;
    const jc = Math.round((0.5 - lat0 / Math.PI) * H);
    const lonSpan = R / Math.max(0.12, Math.cos(lat0));
    const ir = Math.ceil((lonSpan / (Math.PI * 2)) * W) + 2;
    const ic = Math.round((lon0 / (Math.PI * 2)) * W);

    for (let dj = -jr; dj <= jr; dj++){
      const j = jc + dj; if (j < 0 || j >= H) continue;
      const lat = (0.5 - (j + 0.5) / H) * Math.PI;
      const cl = Math.cos(lat), sl = Math.sin(lat);
      for (let di = -ir; di <= ir; di++){
        const i = ((ic + di) % W + W) % W;
        const lon = ((i + 0.5) / W) * Math.PI * 2;
        // great-circle angle between (lat,lon) and (lat0,lon0)
        const cosd = s0 * sl + c0 * cl * Math.cos(lon - lon0);
        const d = Math.acos(clamp(cosd, -1, 1)) / R;
        if (d >= 1.25) continue;
        const idx = j * W + i;
        const floor = -deep * (1 - smoothstep(0.55, 1.0, d));
        const rim   =  deep * 0.85 * Math.exp(-Math.pow((d - 0.92) / 0.17, 2));
        const eject =  deep * 0.18 * Math.exp(-Math.pow((d - 1.12) / 0.3, 2));
        h[idx] = clamp(h[idx] + floor + rim + eject);
      }
    }
  }
}

/* ============================================================
   HEIGHT → NORMAL MAP  (wraps in longitude)
   ============================================================ */
function normalMap(h, W, H, strength){
  const c = cv(W,H), ctx = c.getContext("2d");
  const img = ctx.createImageData(W,H), d = img.data;
  for (let j = 0; j < H; j++){
    const jm = j > 0 ? j-1 : 0, jp = j < H-1 ? j+1 : H-1;
    for (let i = 0; i < W; i++){
      const im = (i-1+W)%W, ip = (i+1)%W;
      const dx = (h[j*W+ip] - h[j*W+im]) * strength;
      const dy = (h[jp*W+i] - h[jm*W+i]) * strength;
      let nx = -dx, ny = dy, nz = 1;
      const l = Math.hypot(nx,ny,nz) || 1;
      const o = (j*W+i)*4;
      d[o]   = ((nx/l) * 0.5 + 0.5) * 255;
      d[o+1] = ((ny/l) * 0.5 + 0.5) * 255;
      d[o+2] = ((nz/l) * 0.5 + 0.5) * 255;
      d[o+3] = 255;
    }
  }
  ctx.putImageData(img,0,0);
  return tex(c, { srgb:false });
}

/* ============================================================
   HEIGHT FIELDS, one per class of world
   ============================================================ */
const HEIGHT = {
  rock(d, lat, s){
    const base = fbm(d[0]*2.3, d[1]*2.3, d[2]*2.3, 5, s);
    const rg   = ridged(d[0]*4.6, d[1]*4.6, d[2]*4.6, 5, s+31);
    return clamp(base*0.64 + rg*0.44 - 0.08);
  },
  mars(d, lat, s){
    const base = fbm(d[0]*1.8, d[1]*1.8, d[2]*1.8, 5, s);
    const rg   = ridged(d[0]*5.2, d[1]*5.2, d[2]*5.2, 5, s+17);
    const dich = 0.16 * (-d[1]);                       // northern lowlands
    return clamp(base*0.6 + rg*0.3 + dich + 0.16);
  },
  earth(d, lat, s){
    const w  = warped(d[0]*1.32, d[1]*1.32, d[2]*1.32, 6, s, 0.8);
    const dt = fbm(d[0]*7.5, d[1]*7.5, d[2]*7.5, 4, s+61);
    const rg = ridged(d[0]*3.4, d[1]*3.4, d[2]*3.4, 4, s+83);
    return clamp((w - 0.5) * 1.55 + 0.5 + (dt - 0.5) * 0.17 + (rg - 0.5) * 0.1);
  },
  venus(d, lat, s){
    const sw = warped(d[0]*1.6, d[1]*3.4, d[2]*1.6, 6, s, 1.15);
    const fine = fbm(d[0]*5.5, d[1]*11, d[2]*5.5, 4, s+7);
    const zone = 0.5 + 0.5*Math.sin(lat*7.5 + (sw-0.5)*9);
    return clamp(sw*0.56 + zone*0.28 + (fine-0.5)*0.2 + 0.08);
  },
  gas(d, lat, s, b){
    const flow = fbm(d[0]*1.15, d[1]*8.5, d[2]*1.15, 5, s);
    const fine = fbm(d[0]*3.2, d[1]*26,  d[2]*3.2, 4, s+41);
    const curl = warped(d[0]*2.1, d[1]*5.0, d[2]*2.1, 4, s+11, 1.5);
    const t = lat / (Math.PI/2);
    let v = 0.5 + 0.5*Math.sin(t*Math.PI*(b.bands||18) + (flow-0.5)*7.5 + (curl-0.5)*3.2);
    v = v*0.7 + (fine-0.5)*0.3 + 0.15;
    return clamp(v * (1 - 0.3*Math.pow(Math.abs(t),3)));   // dim the poles
  },
  ice(d, lat, s, b){
    const flow = fbm(d[0]*1.0, d[1]*5.5, d[2]*1.0, 4, s);
    const fine = fbm(d[0]*2.6, d[1]*14, d[2]*2.6, 4, s+29);
    const t = lat / (Math.PI/2);
    let v = 0.5 + 0.5*Math.sin(t*Math.PI*(b.bands||8) + (flow-0.5)*4.2);
    return clamp(0.46 + v*0.34 + (fine-0.5)*0.16 - 0.1*Math.pow(Math.abs(t),2));
  }
};

const seedOf = id => { let s = 2166136261; for (const ch of id) s = Math.imul(s ^ ch.charCodeAt(0), 16777619); return (s >>> 0) % 100000; };

/* ============================================================
   MAIN BUILDER
   ============================================================ */
export function buildSurface(body){
  const kind = body.kind;
  const big  = kind === "gas" || body.id === "earth";
  const W = big ? 1024 : 768, H = W >> 1;
  const seed = seedOf(body.id);
  const hf = HEIGHT[kind] || HEIGHT.rock;
  const h = new Float32Array(W*H);
  const dir = [0,0,0];

  /* ---- pass 1 · heightfield ---- */
  for (let j = 0; j < H; j++){
    const lat = (0.5 - (j + 0.5) / H) * Math.PI;
    for (let i = 0; i < W; i++){
      dirAt(i, j, W, H, dir);
      h[j*W+i] = hf(dir, lat, seed, body);
    }
  }
  if (body.craters) stampCraters(h, W, H, body.craters, seed + 909);
  if (body.id === "mars") carveValles(h, W, H, seed);

  /* ---- pass 2 · albedo ---- */
  const c = cv(W,H), ctx = c.getContext("2d");
  const img = ctx.createImageData(W,H), d = img.data;
  const pal = PAL[body.id] || PAL.mercury;
  const spec = body.id === "earth" ? cv(W,H) : null;
  const sctx = spec && spec.getContext("2d");
  const simg = spec && sctx.createImageData(W,H);

  for (let j = 0; j < H; j++){
    const lat = (0.5 - (j + 0.5) / H) * Math.PI;
    const alat = Math.abs(lat) / (Math.PI/2);
    for (let i = 0; i < W; i++){
      const idx = j*W+i, o = idx*4;
      const hv = h[idx];
      dirAt(i, j, W, H, dir);
      let col;

      if (body.id === "earth"){
        const sea = 0.5;
        if (hv < sea){
          col = ramp(EARTH_SEA, hv / sea);
          if (simg) setPix(simg.data, o, 235, 235, 235);         // ocean = glossy
        } else {
          const t = (hv - sea) / (1 - sea);
          const dry = fbm(dir[0]*2.2+9, dir[1]*2.2, dir[2]*2.2, 3, seed+301);
          let biome = clamp(t*1.15 + (dry-0.5)*0.55 + alat*0.45);
          col = ramp(EARTH_LAND, biome);
          if (simg) setPix(simg.data, o, 22, 22, 22);
        }
        // ice caps, fringed with noise
        const capN = fbm(dir[0]*5, dir[1]*5, dir[2]*5, 3, seed+7);
        const cap = smoothstep(0.74 + capN*0.14, 0.9 + capN*0.1, alat);
        if (cap > 0){
          col = [lerp(col[0],244,cap), lerp(col[1],249,cap), lerp(col[2],255,cap)];
          if (simg) setPix(simg.data, o, 90*cap+22, 90*cap+22, 90*cap+22);
        }
      }
      else if (kind === "gas" || kind === "ice"){
        col = ramp(pal, hv);
        if (body.spot) col = applySpot(col, body, dir, lat, i/W, seed);
      }
      else if (kind === "venus"){
        col = ramp(pal, hv);
      }
      else {
        col = ramp(pal, hv);
        // subtle albedo mottling independent of relief
        const mot = fbm(dir[0]*8.5, dir[1]*8.5, dir[2]*8.5, 3, seed+55) - 0.5;
        col = [col[0]*(1+mot*0.22), col[1]*(1+mot*0.2), col[2]*(1+mot*0.18)];
        if (body.caps){                                          // martian polar frost
          const capN = fbm(dir[0]*6, dir[1]*6, dir[2]*6, 3, seed+13);
          const cap = smoothstep(0.8 + capN*0.12, 0.94 + capN*0.06, alat);
          col = [lerp(col[0],238,cap), lerp(col[1],244,cap), lerp(col[2],252,cap)];
        }
        if (body.heart) col = plutoHeart(col, dir, seed);
      }
      setPix(d, o, col[0], col[1], col[2]);
    }
  }
  ctx.putImageData(img, 0, 0);
  if (spec){ sctx.putImageData(simg, 0, 0); }

  const out = { map: tex(c) };
  const bump = body.bump ?? (kind === "gas" || kind === "ice" ? 0.35 : 0.8);
  out.normalMap = normalMap(h, W, H, bump * (big ? 30 : 24));
  if (spec) out.specMap = tex(spec, { srgb:false });
  if (body.clouds) out.cloudMap = buildClouds(seed);
  if (body.night)  out.nightMap = buildNight(h, W, H, seed);
  return out;
}

function setPix(d, o, r, g, b){ d[o] = r; d[o+1] = g; d[o+2] = b; d[o+3] = 255; }

/* ---------- Valles Marineris ---------- */
function carveValles(h, W, H, seed){
  const lat0 = -0.14;
  for (let i = 0; i < W; i++){
    const lon = (i / W) * Math.PI * 2;
    if (lon < 1.35 || lon > 3.5) continue;
    const wob = (fbm(Math.cos(lon)*3, 0.5, Math.sin(lon)*3, 3, seed+404) - 0.5) * 0.16;
    const lc = lat0 + wob;
    const jc = Math.round((0.5 - lc / Math.PI) * H);
    const span = Math.round(H * 0.035);
    const edge = smoothstep(1.35, 1.7, lon) * (1 - smoothstep(3.1, 3.5, lon));
    for (let dj = -span; dj <= span; dj++){
      const j = jc + dj; if (j < 0 || j >= H) continue;
      const f = 1 - Math.abs(dj) / span;
      h[j*W+i] = clamp(h[j*W+i] - 0.3 * edge * f * f);
    }
  }
}

/* ---------- storms & spots ---------- */
function applySpot(col, body, dir, lat, u, seed){
  const dark = body.spot === "dark";
  const lat0 = dark ? -0.46 : -0.36;
  const lon0 = dark ? 4.1 : 2.15;
  const lon = u * Math.PI * 2;
  let dl = lon - lon0; if (dl > Math.PI) dl -= Math.PI*2; if (dl < -Math.PI) dl += Math.PI*2;
  const ex = dl / (dark ? 0.40 : 0.56), ey = (lat - lat0) / (dark ? 0.17 : 0.20);
  const r = Math.hypot(ex, ey);
  if (r > 1.35) return col;
  const swirl = fbm(dir[0]*9, dir[1]*9, dir[2]*9, 4, seed+808);
  const k = (1 - smoothstep(0.62, 1.15, r)) * (0.72 + swirl*0.5);
  const tgt = dark ? [22,38,110] : [176,72,44];
  const rimK = Math.exp(-Math.pow((r-0.95)/0.2,2)) * 0.5;
  return [
    lerp(col[0], tgt[0], clamp(k)) * (1 + rimK*0.22),
    lerp(col[1], tgt[1], clamp(k)) * (1 + rimK*0.18),
    lerp(col[2], tgt[2], clamp(k)) * (1 + rimK*0.14)
  ];
}

/* ---------- Tombaugh Regio, the nitrogen-ice heart ---------- */
function plutoHeart(col, dir, seed){
  const lat = Math.asin(clamp(dir[1],-1,1));
  const lon = Math.atan2(dir[2], dir[0]);
  let dl = lon - 0.9; if (dl > Math.PI) dl -= Math.PI*2; if (dl < -Math.PI) dl += Math.PI*2;
  const x = dl / 0.62, y = (lat - 0.16) / 0.44;
  const f = Math.pow(x*x + y*y - 1, 3) - x*x*y*y*y;
  if (f > 0.6) return col;
  const n = fbm(dir[0]*7, dir[1]*7, dir[2]*7, 3, seed+606);
  const k = clamp((0.6 - f) / 0.9) * (0.62 + n*0.42);
  return [lerp(col[0],246,k), lerp(col[1],241,k), lerp(col[2],226,k)];
}

/* ---------- data textures (no canvas → no premultiply) ---------- */
function dataTex(data, W, H, { srgb = true, wrap = THREE.RepeatWrapping } = {}){
  const t = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = wrap; t.wrapT = THREE.ClampToEdgeWrapping;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

/* ---------- Earth's weather ---------- */
function buildClouds(seed){
  const W = 1024, H = 512, data = new Uint8Array(W*H*4), dir = [0,0,0];
  for (let j = 0; j < H; j++){
    const lat = (0.5 - (j + 0.5) / H) * Math.PI;
    const t = lat / (Math.PI/2);
    // itcz near the equator, storm tracks around ±50°, clear subtropics
    const belt = 0.62 + 0.5*Math.exp(-Math.pow(t/0.16,2)) + 0.42*Math.exp(-Math.pow((Math.abs(t)-0.56)/0.2,2))
               - 0.34*Math.exp(-Math.pow((Math.abs(t)-0.3)/0.14,2));
    for (let i = 0; i < W; i++){
      dirAt(i, j, W, H, dir);
      const sw = warped(dir[0]*2.1, dir[1]*2.6, dir[2]*2.1, 6, seed+71, 1.35);
      const fine = fbm(dir[0]*7.5, dir[1]*9, dir[2]*7.5, 4, seed+91);
      let a = clamp((sw*belt + (fine-0.5)*0.34 - 0.46) * 3.1);
      a = Math.pow(a, 1.25);
      const o = ((H-1-j)*W + i)*4;                     // DataTexture is bottom-up
      data[o] = data[o+1] = data[o+2] = 255;
      data[o+3] = a * 255;
    }
  }
  return dataTex(data, W, H);
}

/* ---------- Earth at night ---------- */
function buildNight(h, hW, hH, seed){
  const W = 512, H = 256, data = new Uint8Array(W*H*4), dir = [0,0,0];
  const rand = rng(seed + 3141);
  for (let j = 0; j < H; j++){
    const alat = Math.abs((0.5 - (j+0.5)/H) * 2);
    for (let i = 0; i < W; i++){
      const hj = Math.min(hH-1, Math.floor(j / H * hH));
      const hi = Math.min(hW-1, Math.floor(i / W * hW));
      const land = h[hj*hW + hi];
      const o = ((H-1-j)*W + i)*4;
      data[o+3] = 255;
      if (land <= 0.505 || alat > 0.82) continue;              // sea & poles are dark
      dirAt(i, j, W, H, dir);
      const pop = fbm(dir[0]*3.1, dir[1]*3.1, dir[2]*3.1, 4, seed+511);
      const grain = fbm(dir[0]*26, dir[1]*26, dir[2]*26, 3, seed+733);
      const coast = 1 - smoothstep(0.505, 0.62, land);          // people hug the shore
      let v = clamp((pop - 0.46) * 3.4) * (0.35 + coast*0.9) * Math.pow(grain, 2.6) * 3.2;
      v *= (1 - smoothstep(0.62, 0.86, alat));
      if (rand() < 0.12) v *= 1.9;                              // scattered megacities
      v = clamp(v);
      data[o]   = v * 255;
      data[o+1] = v * 205;
      data[o+2] = v * 140;
    }
  }
  return dataTex(data, W, H);
}

/* ---------- Saturn's rings (radial 1-D profile) ---------- */
export function ringTexture(faint = false){
  const W = 2048, H = 8, data = new Uint8Array(W*H*4);
  const gaps = [[0.00,0.06,1.0],[0.615,0.665,0.93],[0.905,0.925,0.7],[0.985,1.0,1.0]];
  for (let i = 0; i < W; i++){
    const r = i / (W - 1);
    let a = 0.86;
    a *= 0.55 + 0.45*fbm(r*140, 3.3, 8.1, 4, 777);
    a *= 0.62 + 0.38*fbm(r*26, 1.1, 2.2, 3, 313);
    a *= smoothstep(0.0, 0.05, r) * (1 - smoothstep(0.94, 1.0, r));
    for (const [g0,g1,depth] of gaps){
      const m = smoothstep(g0-0.012, g0+0.004, r) * (1 - smoothstep(g1-0.004, g1+0.012, r));
      a *= 1 - m*depth;
    }
    if (faint) a *= 0.30;
    const shade = 0.74 + 0.26*fbm(r*70, 9.4, 1.7, 3, 555);
    const warm = faint ? [172,196,208] : [236,214,176];
    for (let j = 0; j < H; j++){
      const o = (j*W + i)*4;
      data[o]   = warm[0]*shade; data[o+1] = warm[1]*shade; data[o+2] = warm[2]*shade;
      data[o+3] = clamp(a) * 255;
    }
  }
  return dataTex(data, W, H, { wrap: THREE.ClampToEdgeWrapping });
}

/* ---------- soft radial sprite: coronas, glows, lens flare ---------- */
export function radialTexture(size = 256, falloff = 3.0, rgb = [255,255,255], core = 0.0){
  const data = new Uint8Array(size*size*4), c = (size-1)/2;
  for (let j = 0; j < size; j++){
    for (let i = 0; i < size; i++){
      const r = Math.hypot(i-c, j-c) / c;
      let a = r >= 1 ? 0 : Math.pow(1 - r, falloff);
      if (core > 0) a = clamp(a + core * Math.pow(clamp(1 - r/0.16), 2));
      const o = (j*size+i)*4;
      data[o] = rgb[0]; data[o+1] = rgb[1]; data[o+2] = rgb[2]; data[o+3] = clamp(a)*255;
    }
  }
  return dataTex(data, size, size, { wrap: THREE.ClampToEdgeWrapping });
}

/* ---------- moons: small cratered rocks, cheap to build ---------- */
export function moonSurface(id, palette, craters = 90){
  const W = 384, H = 192, seed = seedOf(id);
  const h = new Float32Array(W*H), dir = [0,0,0];
  for (let j = 0; j < H; j++){
    const lat = (0.5 - (j+0.5)/H) * Math.PI;
    for (let i = 0; i < W; i++){
      dirAt(i,j,W,H,dir);
      h[j*W+i] = HEIGHT.rock(dir, lat, seed);
    }
  }
  stampCraters(h, W, H, craters, seed+42);
  const c = cv(W,H), ctx = c.getContext("2d");
  const img = ctx.createImageData(W,H), d = img.data;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++){
    const o = (j*W+i)*4, col = ramp(palette, h[j*W+i]);
    setPix(d, o, col[0], col[1], col[2]);
  }
  ctx.putImageData(img,0,0);
  return { map: tex(c), normalMap: normalMap(h, W, H, 22) };
}

export const MOON_PAL = {
  luna:   [[0,"#38352f"],[.35,"#6b665c"],[.6,"#918b7e"],[.82,"#b8b1a3"],[1,"#ded8ca"]],
  icy:    [[0,"#6b7784"],[.34,"#93a2b0"],[.62,"#c0cdd8"],[.85,"#e2ebf2"],[1,"#f7fbff"]],
  rusty:  [[0,"#3a2a20"],[.36,"#6b4d3a"],[.64,"#94705a"],[.86,"#bb9880"],[1,"#dcc0a8"]],
  sulfur: [[0,"#6e5514"],[.3,"#b08f23"],[.56,"#dcc04a"],[.8,"#f2e08a"],[1,"#fdf5c8"]]
};









