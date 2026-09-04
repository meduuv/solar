/* ============================================================
   noise.js — deterministic 3-D value noise for procedural worlds
   ============================================================ */

export const clamp  = (v,a=0,b=1) => v < a ? a : v > b ? b : v;
export const lerp   = (a,b,t) => a + (b - a) * t;
export const smooth = t => t * t * (3 - 2 * t);
export const smoothstep = (e0,e1,x) => { const t = clamp((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
export const mixHex = (h1,h2,t) => {
  const a = hex2rgb(h1), b = hex2rgb(h2);
  return [lerp(a[0],b[0],t), lerp(a[1],b[1],t), lerp(a[2],b[2],t)];
};
export const hex2rgb = h => {
  const n = parseInt(h.replace("#",""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/* --- integer hash → [0,1) --------------------------------- */
function hash3(x, y, z, seed){
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + (z | 0) * 2147483647 + seed * 1442695041;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/* --- 3-D value noise -------------------------------------- */
export function noise3(x, y, z, seed = 0){
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = smooth(x - ix), fy = smooth(y - iy), fz = smooth(z - iz);
  const c000 = hash3(ix,   iy,   iz,   seed), c100 = hash3(ix+1, iy,   iz,   seed);
  const c010 = hash3(ix,   iy+1, iz,   seed), c110 = hash3(ix+1, iy+1, iz,   seed);
  const c001 = hash3(ix,   iy,   iz+1, seed), c101 = hash3(ix+1, iy,   iz+1, seed);
  const c011 = hash3(ix,   iy+1, iz+1, seed), c111 = hash3(ix+1, iy+1, iz+1, seed);
  const x00 = lerp(c000,c100,fx), x10 = lerp(c010,c110,fx);
  const x01 = lerp(c001,c101,fx), x11 = lerp(c011,c111,fx);
  return lerp(lerp(x00,x10,fy), lerp(x01,x11,fy), fz);
}

/* --- fractal sums ----------------------------------------- */
export function fbm(x, y, z, oct = 5, seed = 0, lac = 2.03, gain = 0.5){
  let a = 0.5, sum = 0, norm = 0, f = 1;
  for (let i = 0; i < oct; i++){
    sum  += a * noise3(x * f, y * f, z * f, seed + i * 131);
    norm += a;
    a *= gain; f *= lac;
  }
  return sum / norm;
}

/* ridged multifractal — gives mountain crests and crater walls */
export function ridged(x, y, z, oct = 5, seed = 0){
  let a = 0.5, sum = 0, norm = 0, f = 1;
  for (let i = 0; i < oct; i++){
    const n = 1 - Math.abs(noise3(x * f, y * f, z * f, seed + i * 977) * 2 - 1);
    sum  += a * n * n;
    norm += a;
    a *= 0.5; f *= 2.07;
  }
  return sum / norm;
}

/* domain-warped fbm — swirls, cloud bands, continents */
export function warped(x, y, z, oct = 5, seed = 0, amt = 0.6){
  const wx = fbm(x + 11.3, y + 4.1,  z + 7.7,  3, seed + 51) - 0.5;
  const wy = fbm(x + 2.9,  y + 19.4, z + 1.2,  3, seed + 97) - 0.5;
  const wz = fbm(x + 8.4,  y + 3.6,  z + 23.1, 3, seed + 13) - 0.5;
  return fbm(x + wx * amt, y + wy * amt, z + wz * amt, oct, seed);
}

/* seeded pseudo-random sequence (stable across reloads) */
export function rng(seed){
  let s = seed | 0 || 1;
  return () => { s = Math.imul(s ^ (s >>> 15), 2246822519); s ^= s >>> 13; return (s >>> 0) / 4294967296; };
}

