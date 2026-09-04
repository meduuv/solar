/* ============================================================
   shaders.js — all GLSL for the atlas
   ============================================================ */

/* shared 3-D value noise (matches the CPU version closely enough) */
export const NOISE = /* glsl */`
float h31(vec3 p){
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float n3(vec3 x){
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h31(i + vec3(0,0,0)), h31(i + vec3(1,0,0)), f.x),
                 mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x),
                 mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm3(vec3 p, int oct){
  float a = 0.5, s = 0.0, n = 0.0;
  for (int i = 0; i < 8; i++){
    if (i >= oct) break;
    s += a * n3(p); n += a; p *= 2.03; a *= 0.5;
  }
  return s / n;
}
float ridge3(vec3 p, int oct){
  float a = 0.5, s = 0.0, n = 0.0;
  for (int i = 0; i < 8; i++){
    if (i >= oct) break;
    float v = 1.0 - abs(n3(p) * 2.0 - 1.0);
    s += a * v * v; n += a; p *= 2.07; a *= 0.5;
  }
  return s / n;
}
`;

/* ---------- shared vertex shader: world normal + world position ---------- */
export const VERT_WORLD = /* glsl */`
varying vec2 vUv;
varying vec3 vN;
varying vec3 vWP;
void main(){
  vUv = uv;
  vN  = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWP = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

/* ============================================================
   PLANET — one light (the Sun, at the origin), hand-rolled so we
   can control the terminator, night lights and limb glow.
   ============================================================ */
export const PLANET_FRAG = /* glsl */`
precision highp float;
uniform sampler2D uMap, uNormal, uNight, uSpec;
uniform vec3  uRim, uSun;
uniform float uNormalScale, uAmbient, uSunI, uRimP, uRimI, uTerm, uGloss;
uniform float uHasNight, uHasSpec, uFade;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vWP;

void main(){
  vec3 base = texture2D(uMap, vUv).rgb;
  vec3 N = normalize(vN);

  /* tangent frame of a UV sphere (poles are approximate, and invisible) */
  vec3 T = normalize(cross(vec3(0.0, 1.0, 0.0), N) + vec3(1e-4, 0.0, 0.0));
  vec3 B = cross(N, T);
  vec3 nm = texture2D(uNormal, vUv).xyz * 2.0 - 1.0;
  N = normalize(N + (T * nm.x + B * nm.y) * uNormalScale);

  vec3 L = normalize(-vWP);                     /* toward the Sun */
  vec3 V = normalize(cameraPosition - vWP);
  float ndl = dot(N, L);

  float diff = smoothstep(-uTerm, uTerm, ndl);
  vec3 col = base * (diff * uSun * uSunI + uAmbient);

  if (uHasSpec > 0.5){
    float g = texture2D(uSpec, vUv).r;
    float s = pow(max(dot(N, normalize(L + V)), 0.0), 88.0);
    col += uSun * s * g * uGloss * diff;
  }
  if (uHasNight > 0.5){
    float night = pow(clamp(-ndl * 1.5 + 0.18, 0.0, 1.0), 1.35);
    col += texture2D(uNight, vUv).rgb * night * 2.1;
  }

  float fres = pow(1.0 - clamp(dot(normalize(vN), V), 0.0, 1.0), uRimP);
  col += uRim * fres * uRimI * (0.14 + 1.0 * max(ndl, 0.0));

  gl_FragColor = vec4(col * uFade, 1.0);
}
`;

/* ============================================================
   ATMOSPHERE — additive halo on back faces
   ============================================================ */
export const ATMO_FRAG = /* glsl */`
precision highp float;
uniform vec3  uColor;
uniform float uPow, uIntensity, uFade;
varying vec3 vN;
varying vec3 vWP;
void main(){
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vWP);
  vec3 L = normalize(-vWP);
  float rim = pow(clamp(1.0 - abs(dot(N, V)), 0.0, 1.0), uPow);
  float lit = clamp(dot(N, L) * 0.62 + 0.38, 0.0, 1.0);
  float fwd = pow(clamp(dot(-V, L), 0.0, 1.0), 4.0);        /* forward scatter */
  vec3 c = uColor * rim * uIntensity * (0.10 + lit * 1.5 + fwd * 0.7);
  gl_FragColor = vec4(c * uFade, rim);
}
`;

/* ============================================================
   THE SUN — churning plasma, limb brightening, corona
   ============================================================ */
export const SUN_FRAG = /* glsl */`
precision highp float;
${NOISE}
uniform float uTime, uFade;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vWP;
void main(){
  vec3 p = normalize(vN);
  float t = uTime * 0.055;

  float gran = fbm3(p * 14.0 + vec3(0.0, t * 1.6, 0.0), 5);
  float cell = ridge3(p * 5.2 + vec3(t * 0.7, 0.0, t * 0.5), 5);
  float slow = fbm3(p * 2.1 - vec3(t * 0.4), 4);

  float v = gran * 0.42 + cell * 0.40 + slow * 0.34;
  v = pow(clamp(v, 0.0, 1.4), 1.35);

  vec3 deep = vec3(0.42, 0.06, 0.01);
  vec3 mid  = vec3(1.00, 0.36, 0.04);
  vec3 hot  = vec3(1.00, 0.79, 0.34);
  vec3 core = vec3(1.00, 0.98, 0.90);
  vec3 col = mix(deep, mid, smoothstep(0.10, 0.46, v));
  col = mix(col, hot,  smoothstep(0.42, 0.78, v));
  col = mix(col, core, smoothstep(0.74, 1.06, v));

  /* limb brightening + a hint of spicules at the edge */
  vec3 V = normalize(cameraPosition - vWP);
  float limb = pow(1.0 - clamp(dot(p, V), 0.0, 1.0), 2.6);
  col += vec3(1.0, 0.46, 0.10) * limb * 1.5;
  col *= 1.0 + 0.4 * limb;

  gl_FragColor = vec4(col * 1.35 * uFade, 1.0);
}
`;

/* ---------- corona: a billboarded plane of streamers ---------- */
export const CORONA_VERT = /* glsl */`
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

export const CORONA_FRAG = /* glsl */`
precision highp float;
${NOISE}
uniform float uTime, uFade;
uniform vec3 uColor;
varying vec2 vUv;
void main(){
  vec2 q = vUv * 2.0 - 1.0;
  float r = length(q);
  if (r > 1.0) discard;
  float a = atan(q.y, q.x);
  float s = fbm3(vec3(cos(a) * 2.3, sin(a) * 2.3, uTime * 0.05), 4);
  float s2 = fbm3(vec3(cos(a) * 6.1, sin(a) * 6.1, uTime * 0.09 + 4.0), 3);
  float e = clamp(1.0 - r, 0.0, 1.0);
  float limb = exp(-pow((r - 0.185) / 0.072, 2.0));
  float halo = pow(e, 3.1);
  float rays = pow(e, 1.55) * smoothstep(0.16, 0.34, r) * (0.18 + s * 1.15 + s2 * 0.5);
  float g = (limb * 0.85 + halo * 0.5 + rays * 0.42) * smoothstep(1.0, 0.9, r);
  gl_FragColor = vec4(uColor * g * uFade, g);
}
`;

/* ---------- star field ---------- */
export const STAR_VERT = /* glsl */`
attribute float aSize;
attribute float aPhase;
attribute vec3  aColor;
uniform float uTime, uDpr, uMul;
varying vec3 vColor;
varying float vTw;
void main(){
  vColor = aColor;
  vTw = 0.68 + 0.32 * sin(uTime * 1.6 + aPhase * 6.28318);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uMul * uDpr;
}
`;

export const STAR_FRAG = /* glsl */`
precision highp float;
varying vec3 vColor;
varying float vTw;
void main(){
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(q, q);
  if (r2 > 1.0) discard;
  float a = pow(1.0 - r2, 2.4);
  gl_FragColor = vec4(vColor * a * vTw * 1.5, a);
}
`;

/* ---------- galactic backdrop ---------- */
export const SKY_VERT = /* glsl */`
varying vec3 vDir;
void main(){
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const SKY_FRAG = /* glsl */`
precision highp float;
${NOISE}
uniform float uIntensity;
varying vec3 vDir;
void main(){
  vec3 d = normalize(vDir);
  vec3 g = normalize(vec3(0.36, 0.82, 0.44));       /* tilted galactic plane */
  float h = dot(d, g);
  float band = exp(-pow(h / 0.26, 2.0));
  float n  = fbm3(d * 3.1, 5);
  float n2 = fbm3(d * 9.4 + 7.0, 4);
  float lanes = fbm3(d * 5.6 + 21.0, 4);
  vec3 cold  = vec3(0.055, 0.085, 0.225);
  vec3 viol  = vec3(0.205, 0.095, 0.265);
  vec3 dusty = vec3(0.300, 0.170, 0.105);
  vec3 col = mix(cold, viol, n);
  col = mix(col, dusty, smoothstep(0.52, 1.0, n2) * 0.6);
  col *= (0.16 + band * 1.55) * (0.30 + smoothstep(0.40, 0.95, n * 0.75 + n2 * 0.4) * 1.5);
  col *= 1.0 - 0.55 * smoothstep(0.52, 0.92, lanes) * band;
  gl_FragColor = vec4(col * uIntensity, 1.0);
}
`;

/* ---------- planetary rings, with the planet's shadow across them ---------- */
export const RING_FRAG = /* glsl */`
precision highp float;
uniform sampler2D uMap;
uniform vec3  uCenter;
uniform float uPlanetR, uFade;
varying vec2 vUv;
varying vec3 vWP;
void main(){
  vec4 t = texture2D(uMap, vUv);
  if (t.a < 0.004) discard;

  /* is this ring particle inside the planet's umbra? */
  vec3 d = normalize(vWP);
  float tc = dot(uCenter, d);
  float perp = sqrt(max(dot(uCenter, uCenter) - tc * tc, 0.0));
  float sh = 1.0;
  if (tc > 0.0 && length(vWP) > tc){
    sh = smoothstep(uPlanetR * 0.90, uPlanetR * 1.10, perp);
  }
  float lit = 0.20 + 0.80 * sh;
  gl_FragColor = vec4(t.rgb * lit * 1.05 * uFade, t.a * uFade);
}
`;

/* ---------- Earth's cloud deck ---------- */
export const CLOUD_FRAG = /* glsl */`
precision highp float;
uniform sampler2D uMap;
uniform float uFade;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vWP;
void main(){
  float a = texture2D(uMap, vUv).a;
  if (a < 0.01) discard;
  vec3 N = normalize(vN);
  vec3 L = normalize(-vWP);
  vec3 V = normalize(cameraPosition - vWP);
  float diff = smoothstep(-0.22, 0.34, dot(N, L));
  float rim = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 2.2);
  vec3 col = vec3(1.0) * (diff * 1.06 + 0.025) + vec3(1.0, 0.86, 0.72) * rim * diff * 0.4;
  gl_FragColor = vec4(col, a * (0.28 + diff * 0.86) * uFade);
}
`;

/* ---------- orbit trail: bright just behind the planet ---------- */
export const ORBIT_VERT = /* glsl */`
attribute float aA;
varying float vA;
void main(){
  vA = aA;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const ORBIT_FRAG = /* glsl */`
precision highp float;
uniform vec3  uColor;
uniform float uHead, uOpacity;
varying float vA;
void main(){
  float d = fract(uHead - vA + 1.0);
  float g = pow(1.0 - d, 7.0) * 1.15 + 0.10;
  gl_FragColor = vec4(uColor * g, g * uOpacity);
}
`;





