/* ============================================================
   post.js — hand-rolled bloom + filmic composite.
   Written against three's core only: no addon files to vendor.
   ============================================================ */
import * as THREE from "three";

const QUAD_VERT = /* glsl */`
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const BRIGHT_FRAG = /* glsl */`
precision highp float;
uniform sampler2D tDiffuse;
uniform float uThresh, uKnee;
varying vec2 vUv;
void main(){
  vec3 c = texture2D(tDiffuse, vUv).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float soft = clamp(l - uThresh + uKnee, 0.0, 2.0 * uKnee);
  soft = soft * soft / (4.0 * uKnee + 1e-5);
  float w = max(soft, l - uThresh) / max(l, 1e-5);
  gl_FragColor = vec4(c * w, 1.0);
}
`;

const BLUR_FRAG = /* glsl */`
precision highp float;
uniform sampler2D tDiffuse;
uniform vec2 uDir;          /* texel-sized step */
varying vec2 vUv;
void main(){
  /* 13-tap gaussian, weights normalised */
  float w[7];
  w[0]=0.1964825; w[1]=0.2969070; w[2]=0.0944703; w[3]=0.0103813;
  w[4]=0.0034541; w[5]=0.0009374; w[6]=0.0001784;
  vec3 sum = texture2D(tDiffuse, vUv).rgb * w[0];
  for (int i = 1; i < 7; i++){
    vec2 o = uDir * float(i);
    sum += texture2D(tDiffuse, vUv + o).rgb * w[i];
    sum += texture2D(tDiffuse, vUv - o).rgb * w[i];
  }
  gl_FragColor = vec4(sum, 1.0);
}
`;

const COPY_FRAG = /* glsl */`
precision highp float;
uniform sampler2D tDiffuse;
varying vec2 vUv;
void main(){ gl_FragColor = texture2D(tDiffuse, vUv); }
`;

const COMPOSITE_FRAG = /* glsl */`
precision highp float;
uniform sampler2D tScene, tB0, tB1, tB2, tB3;
uniform float uBloom, uExposure, uCA, uSat;
varying vec2 vUv;

vec3 aces(vec3 x){
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

void main(){
  vec2 q = vUv - 0.5;
  float r2 = dot(q, q);

  /* very light chromatic aberration toward the corners */
  vec2 off = q * r2 * uCA;
  vec3 col;
  col.r = texture2D(tScene, vUv - off).r;
  col.g = texture2D(tScene, vUv).g;
  col.b = texture2D(tScene, vUv + off).b;

  vec3 bl = texture2D(tB0, vUv).rgb * 1.00
          + texture2D(tB1, vUv).rgb * 0.80
          + texture2D(tB2, vUv).rgb * 0.58
          + texture2D(tB3, vUv).rgb * 0.42;
  col += bl * uBloom;

  col *= uExposure;
  col = aces(col);

  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l), col, uSat);
  col *= 1.0 - r2 * 0.30;                       /* gentle optical vignette */

  gl_FragColor = vec4(pow(max(col, 0.0), vec3(1.0 / 2.2)), 1.0);
}
`;

const LEVELS = 4;

export class Post {
  constructor(renderer, scene, camera, { samples = 4 } = {}){
    this.r = renderer; this.scene = scene; this.camera = camera;
    this.bloom = 0.95; this.exposure = 1.06; this.enabled = true;

    this.quadScene = new THREE.Scene();
    this.quadCam = new THREE.Camera();
    this.geo = new THREE.PlaneGeometry(2, 2);
    this.mesh = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial());
    this.mesh.frustumCulled = false;
    this.quadScene.add(this.mesh);

    const mk = (frag, uniforms) => new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT, fragmentShader: frag, uniforms,
      depthTest: false, depthWrite: false
    });

    this.mBright = mk(BRIGHT_FRAG, {
      tDiffuse:{ value:null }, uThresh:{ value:0.62 }, uKnee:{ value:0.35 }
    });
    this.mBlur = mk(BLUR_FRAG, { tDiffuse:{ value:null }, uDir:{ value:new THREE.Vector2() } });
    this.mCopy = mk(COPY_FRAG, { tDiffuse:{ value:null } });
    this.mComp = mk(COMPOSITE_FRAG, {
      tScene:{ value:null }, tB0:{ value:null }, tB1:{ value:null },
      tB2:{ value:null }, tB3:{ value:null },
      uBloom:{ value:this.bloom }, uExposure:{ value:this.exposure },
      uCA:{ value:0.0022 }, uSat:{ value:1.06 }
    });

    this.samples = samples;
    this.rt = null; this.down = []; this.tmp = [];
  }

  setSize(w, h, dpr){
    const W = Math.max(2, Math.floor(w * dpr)), H = Math.max(2, Math.floor(h * dpr));
    const opts = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter,
                   magFilter: THREE.LinearFilter, depthBuffer: true, stencilBuffer: false };
    this.rt?.dispose();
    this.rt = new THREE.WebGLRenderTarget(W, H, { ...opts, samples: this.samples });
    this.down.forEach(t => t.dispose()); this.tmp.forEach(t => t.dispose());
    this.down = []; this.tmp = [];
    let lw = W, lh = H;
    for (let i = 0; i < LEVELS; i++){
      lw = Math.max(2, lw >> 1); lh = Math.max(2, lh >> 1);
      this.down.push(new THREE.WebGLRenderTarget(lw, lh, { ...opts, depthBuffer:false }));
      this.tmp .push(new THREE.WebGLRenderTarget(lw, lh, { ...opts, depthBuffer:false }));
    }
  }

  _blit(mat, target){
    this.mesh.material = mat;
    this.r.setRenderTarget(target);
    this.r.clear();
    this.r.render(this.quadScene, this.quadCam);
  }

  render(){
    const r = this.r;
    r.setRenderTarget(this.rt);
    r.clear();
    r.render(this.scene, this.camera);

    if (this.enabled){
      /* bright pass into the largest mip */
      this.mBright.uniforms.tDiffuse.value = this.rt.texture;
      this._blit(this.mBright, this.down[0]);

      /* progressive downsample */
      for (let i = 1; i < LEVELS; i++){
        this.mCopy.uniforms.tDiffuse.value = this.down[i-1].texture;
        this._blit(this.mCopy, this.down[i]);
      }
      /* separable blur at every level */
      for (let i = 0; i < LEVELS; i++){
        const t = this.down[i], w = t.width, h = t.height;
        this.mBlur.uniforms.tDiffuse.value = t.texture;
        this.mBlur.uniforms.uDir.value.set(1 / w, 0);
        this._blit(this.mBlur, this.tmp[i]);
        this.mBlur.uniforms.tDiffuse.value = this.tmp[i].texture;
        this.mBlur.uniforms.uDir.value.set(0, 1 / h);
        this._blit(this.mBlur, t);
      }
    }

    const u = this.mComp.uniforms;
    u.tScene.value = this.rt.texture;
    for (let i = 0; i < LEVELS; i++){
      /* when bloom is off uBloom is 0, so the source here is irrelevant */
      u["tB" + i].value = this.enabled ? this.down[i].texture : this.rt.texture;
    }
    u.uBloom.value = this.enabled ? this.bloom : 0;
    u.uExposure.value = this.exposure;
    this._blit(this.mComp, null);
  }

  dispose(){
    this.rt?.dispose();
    this.down.forEach(t => t.dispose());
    this.tmp.forEach(t => t.dispose());
    this.geo.dispose();
    [this.mBright, this.mBlur, this.mCopy, this.mComp].forEach(m => m.dispose());
  }
}



