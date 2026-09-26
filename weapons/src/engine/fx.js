import * as THREE6 from "three";
function tex(size, draw2) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  draw2(c.getContext("2d"), size);
  const t = new THREE6.CanvasTexture(c);
  t.colorSpace = THREE6.SRGBColorSpace;
  return t;
}
function texWH(w, h, draw2) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw2(c.getContext("2d"), w, h);
  const t = new THREE6.CanvasTexture(c);
  t.colorSpace = THREE6.SRGBColorSpace;
  return t;
}
var R2 = Math.random;
var TEX = {};
function textures() {
  if (TEX.glow) return TEX;
  TEX.glow = tex(128, (g, s) => {
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, "rgba(255,255,255,1)");
    gr.addColorStop(0.2, "rgba(255,255,255,.8)");
    gr.addColorStop(0.5, "rgba(255,255,255,.2)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, s, s);
  });
  const flameSide = (o) => texWH(256, 96, (g, w, h) => {
    g.globalCompositeOperation = "lighter";
    const env = (u) => Math.pow(Math.sin(Math.PI * Math.min(1, u / o.peak) * 0.5), 0.8) * Math.pow(1 - u, o.taper);
    for (let i = 0; i < o.n; i++) {
      const u = Math.pow(R2(), o.bias) * 0.92;
      const r = h * 0.5 * env(u) * (0.35 + R2() * 0.65);
      if (r < 1) continue;
      const x = u * w, y = h / 2 + (R2() - 0.5) * h * 0.5 * env(u);
      const hot = Math.max(0, 1 - u * 2.2);
      const gr2 = g.createRadialGradient(x, y, 0, x, y, r);
      const a = (0.1 + R2() * 0.14) * (1 - u * 0.6);
      gr2.addColorStop(0, `rgba(255,${Math.round(190 + 60 * hot)},${Math.round(90 + 150 * hot)},${a * 1.6})`);
      gr2.addColorStop(0.45, `rgba(255,${Math.round(140 + 60 * hot)},${Math.round(40 + 60 * hot)},${a})`);
      gr2.addColorStop(1, "rgba(255,90,20,0)");
      g.fillStyle = gr2;
      g.beginPath();
      g.ellipse(x, y, r * (1.3 + R2()), r, (R2() - 0.5) * 0.6, 0, 7);
      g.fill();
    }
    const cr = h * 0.2;
    const gr = g.createRadialGradient(4, h / 2, 0, 4, h / 2, cr * 2.4);
    gr.addColorStop(0, "rgba(255,252,235,1)");
    gr.addColorStop(0.3, "rgba(255,230,160,.7)");
    gr.addColorStop(1, "rgba(255,160,60,0)");
    g.fillStyle = gr;
    g.beginPath();
    g.ellipse(4, h / 2, cr * 2.4, cr, 0, 0, 7);
    g.fill();
    g.globalCompositeOperation = "destination-in";
    const fx = g.createLinearGradient(0, 0, w, 0);
    fx.addColorStop(0, "rgba(0,0,0,1)");
    fx.addColorStop(0.75, "rgba(0,0,0,.9)");
    fx.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = fx;
    g.fillRect(0, 0, w, h);
  });
  TEX.flameLong = [0, 1, 2].map(() => flameSide({ n: 170, peak: 0.42, taper: 0.8, bias: 1.25 }));
  TEX.flameShort = [0, 1, 2].map(() => flameSide({ n: 120, peak: 0.25, taper: 1.6, bias: 1.8 }));
  const star = (petals) => tex(256, (g, s) => {
    g.translate(s / 2, s / 2);
    g.globalCompositeOperation = "lighter";
    const n = petals || 9;
    const a0 = R2() * 6.28;
    for (let i = 0; i < n; i++) {
      const a = a0 + i / n * Math.PI * 2 + (petals ? 0 : (R2() - 0.5) * 0.5);
      const L = s * (petals ? 0.4 + R2() * 0.08 : 0.2 + R2() * 0.26), wd = s * (petals ? 0.05 : 0.03 + R2() * 0.03);
      g.save();
      g.rotate(a);
      for (let j = 0; j < 5; j++) {
        const gr2 = g.createLinearGradient(0, 0, L, 0);
        gr2.addColorStop(0, "rgba(255,244,215,.5)");
        gr2.addColorStop(0.5, "rgba(255,175,70,.3)");
        gr2.addColorStop(1, "rgba(255,100,20,0)");
        g.fillStyle = gr2;
        const jw = wd * (0.5 + R2() * 0.7), jl = L * (0.6 + R2() * 0.4), dy = (R2() - 0.5) * wd;
        g.beginPath();
        g.moveTo(0, dy - jw);
        g.quadraticCurveTo(jl * 0.55, dy - jw * (0.6 + R2() * 0.6), jl, dy + (R2() - 0.5) * jw);
        g.quadraticCurveTo(jl * 0.55, dy + jw * (0.6 + R2() * 0.6), 0, dy + jw);
        g.fill();
      }
      g.restore();
    }
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, s * 0.2);
    gr.addColorStop(0, "rgba(255,255,240,1)");
    gr.addColorStop(0.4, "rgba(255,215,130,.75)");
    gr.addColorStop(1, "rgba(255,140,40,0)");
    g.fillStyle = gr;
    g.beginPath();
    g.arc(0, 0, s * 0.2, 0, 7);
    g.fill();
  });
  TEX.star = [star(0), star(0), star(0)];
  TEX.star3 = [star(3), star(3)];
  TEX.star4 = [star(4), star(4)];
  TEX.smoke = tex(256, (g, s) => {
    const h = s / 2, img = g.createImageData(s, s), d = img.data;
    const N = 32, grid = [];
    for (let i = 0; i < 4 * N * N; i++) grid.push(R2());
    const vn = (c, x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      const at = (a, b) => grid[c * N * N + (b % N + N) % N * N + (a % N + N) % N];
      const sx = xf * xf * (3 - 2 * xf), sy = yf * yf * (3 - 2 * yf);
      return (at(xi, yi) * (1 - sx) + at(xi + 1, yi) * sx) * (1 - sy) + (at(xi, yi + 1) * (1 - sx) + at(xi + 1, yi + 1) * sx) * sy;
    };
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const c = (x >= h ? 1 : 0) + (y >= h ? 2 : 0);
      const u = x % h / h - 0.5, v = y % h / h - 0.5;
      let f = 0, amp = 0.5, fr = 3;
      for (let o = 0; o < 5; o++) {
        f += vn(c, u * fr + 7 * c, v * fr) * amp;
        amp *= 0.5;
        fr *= 2.03;
      }
      const r = Math.hypot(u, v) * 2;
      const fall = Math.max(0, 1 - r * r) ** 1.4;
      const a = Math.max(0, f - 0.32) * 1.9 * fall;
      const i = (y * s + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = 255 * (0.85 + f * 0.15);
      d[i + 3] = Math.min(255, a * 255);
    }
    g.putImageData(img, 0, 0);
  });
  TEX.spark = tex(64, (g, s) => {
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, "rgba(255,250,230,1)");
    gr.addColorStop(0.25, "rgba(255,200,110,.9)");
    gr.addColorStop(1, "rgba(255,120,30,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, s, s);
  });
  TEX.hole = tex(64, (g, s) => {
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, "rgba(20,18,16,1)");
    gr.addColorStop(0.35, "rgba(40,36,30,.9)");
    gr.addColorStop(0.6, "rgba(120,110,95,.4)");
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, s, s);
  });
  TEX.glare = tex(256, (g, s) => {
    const c = s / 2;
    g.globalCompositeOperation = "lighter";
    let gr = g.createRadialGradient(c, c, 0, c, c, c);
    gr.addColorStop(0, "rgba(255,255,255,1)");
    gr.addColorStop(0.04, "rgba(255,255,255,.9)");
    gr.addColorStop(0.12, "rgba(255,250,240,.35)");
    gr.addColorStop(0.35, "rgba(255,245,230,.08)");
    gr.addColorStop(1, "rgba(255,240,220,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, s, s);
    g.translate(c, c);
    for (let i = 0; i < 6; i++) {
      g.save();
      g.rotate(i * Math.PI / 3 + 0.2);
      const lg = g.createLinearGradient(0, 0, c, 0);
      lg.addColorStop(0, "rgba(255,255,255,.55)");
      lg.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = lg;
      g.beginPath();
      g.moveTo(0, -1.6);
      g.lineTo(c, 0);
      g.lineTo(0, 1.6);
      g.fill();
      g.restore();
    }
  });
  return TEX;
}
var additive = (map, color, opacity = 1) => new THREE6.SpriteMaterial({ map, color, transparent: true, opacity, blending: THREE6.AdditiveBlending, depthWrite: false, toneMapped: false });
var LIT = {
  uAmb: { value: new THREE6.Color(1, 1, 1) },
  uSpotPos: { value: new THREE6.Vector3() },
  uSpotDir: { value: new THREE6.Vector3(1, 0, 0) },
  uSpotCol: { value: new THREE6.Color(0, 0, 0) },
  uSpotProf: { value: new THREE6.Vector3(0.08, 0.55, 0.035) },
  // σ пятна, край засветки (рад), уровень засветки
  uFlashPos: { value: new THREE6.Vector3() },
  uFlashCol: { value: new THREE6.Color(0, 0, 0) }
};
var LIT_GLSL = `
uniform vec3 uAmb, uSpotPos, uSpotDir, uSpotCol, uSpotProf, uFlashPos, uFlashCol;
float beamProf(float ang) {
  return exp(-(ang * ang) / (uSpotProf.x * uSpotProf.x)) + uSpotProf.z * (1.0 - smoothstep(uSpotProf.y * 0.72, uSpotProf.y, ang));
}
// Хеньи–Гринстейн, нормирована к 1 в среднем по сфере
float hg(float c, float g) { float g2 = g * g; return (1.0 - g2) / pow(max(1e-4, 1.0 + g2 - 2.0 * g * c), 1.5); }
vec3 spotAt(vec3 p, float g) {
  vec3 d = p - uSpotPos; float r2 = max(dot(d, d), 4e-4); vec3 n = d * inversesqrt(r2);
  float ang = acos(clamp(dot(n, uSpotDir), -1.0, 1.0));
  return uSpotCol * beamProf(ang) / r2 * hg(dot(n, normalize(cameraPosition - p)), g);
}
vec3 flashAt(vec3 p) { vec3 d = p - uFlashPos; return uFlashCol / max(dot(d, d), 0.01); }
`;
function beamProfile(b, ang) {
  const hot = Math.exp(-(ang * ang) / (b.hot * b.hot));
  const edge = 1 - smooth(b.spill * 0.72, b.spill, ang);
  const ring = (b.ring || 0) * Math.exp(-(((ang - b.hot * 1.9) / (b.hot * 0.5)) ** 2));
  return hot + b.spillK * edge + ring;
}
var smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
var COOKIES = /* @__PURE__ */ new Map();
function beamCookie(b) {
  const key = [b.hot, b.spill, b.spillK, b.ring, b.tir].join("|");
  if (COOKIES.has(key)) return COOKIES.get(key);
  const S = 256, c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d"), img = g.createImageData(S, S), d = img.data;
  const tanA = Math.tan(b.spill * 1.02);
  let s = 1234;
  const rnd = () => (s = s * 16807 % 2147483647) / 2147483647;
  const ph = [0, 1, 2, 3, 4].map(() => rnd() * 6.28);
  let peak = 0;
  const vals = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = (x + 0.5) / S * 2 - 1, v = (y + 0.5) / S * 2 - 1;
    const rho = Math.hypot(u, v), a = Math.atan2(v, u);
    const ang = Math.atan(rho * tanA);
    let val = beamProfile(b, ang);
    const k = b.tir ? 0.25 : 1;
    val *= 1 + k * (0.05 * Math.sin(ang * 90 + ph[0]) * smooth(b.hot, b.hot * 2, ang) + 0.035 * Math.sin(a * 3 + ph[1]) * smooth(b.hot * 0.5, b.hot * 1.5, ang) + 0.02 * Math.sin(a * 7 + ph[2]));
    if (!b.tir) val *= 1 - 0.18 * Math.exp(-(((ang - b.spill * 0.55) / (b.spill * 0.05)) ** 2));
    vals[y * S + x] = Math.max(0, val);
    if (rho < 0.02) peak = Math.max(peak, val);
  }
  for (let i = 0; i < S * S; i++) {
    const q = Math.min(255, Math.round((vals[i] / (peak || 1)) ** (1 / 2.2) * 255));
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = q;
    d[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE6.CanvasTexture(c);
  t.colorSpace = THREE6.SRGBColorSpace;
  COOKIES.set(key, t);
  return t;
}
var CONE_VS = `
varying vec3 vW;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
var CONE_FS = `
uniform float uTan, uLen, uDensity, uTime, uInside;
varying vec3 vW;
${LIT_GLSL}
float h3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float n3(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1, 0, 0)), f.x), mix(h3(i + vec3(0, 1, 0)), h3(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(h3(i + vec3(0, 0, 1)), h3(i + vec3(1, 0, 1)), f.x), mix(h3(i + vec3(0, 1, 1)), h3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
void main() {
  vec3 ro = cameraPosition, rd = normalize(vW - ro);
  vec3 A = uSpotPos, V = uSpotDir;
  float c2 = 1.0 / (1.0 + uTan * uTan);
  vec3 co = ro - A;
  float dv = dot(rd, V), cv = dot(co, V);
  float a = dv * dv - c2, b = 2.0 * (dv * cv - c2 * dot(rd, co)), c = cv * cv - c2 * dot(co, co);
  // луч вдоль образующей конуса: a → 0, деление дало бы Inf/NaN
  if (abs(a) < 1e-6) a = a < 0.0 ? -1e-6 : 1e-6;
  float disc = max(b * b - 4.0 * a * c, 0.0), sq = sqrt(disc);
  float t1 = (-b - sq) / (2.0 * a), t2 = (-b + sq) / (2.0 * a);
  if (t1 > t2) { float t = t1; t1 = t2; t2 = t; }
  float tn = 0.0, tf = 1e4;
  if (a < 0.0) { tn = t1; tf = t2; } else { if (dv > 0.0) { tn = t2; } else { tf = t1; } }
  // срез по длине луча: 0 ≤ h ≤ uLen
  if (abs(dv) > 1e-5) { float ta = -cv / dv, tb = (uLen - cv) / dv; tn = max(tn, min(ta, tb)); tf = min(tf, max(ta, tb)); }
  tn = max(tn, 0.0);
  if (tf <= tn) discard;
  const int N = STEPS;
  float dt = (tf - tn) / float(N);
  float j = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  vec3 acc = vec3(0.0);
  for (int i = 0; i < N; i++) {
    vec3 p = ro + rd * (tn + (float(i) + j) * dt);
    float dens = uDensity * (0.55 + 0.9 * n3(p * 2.3 + vec3(0.0, uTime * 0.04, uTime * 0.02)));
    acc += spotAt(p, 0.72) * dens;
  }
  acc *= dt;
  ${HDR_SAFE("acc")}
  gl_FragColor = vec4(acc, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
var MOTE_VS = `
attribute float aSeed;
uniform float uTime, uSize, uGain;
uniform vec3 uBoxMin, uBoxMax;
varying vec3 vL;
${LIT_GLSL}
void main() {
  vec3 box = uBoxMax - uBoxMin;
  vec3 p = position + vec3(0.012, -0.004, 0.008) * uTime + 0.03 * sin(vec3(uTime * 0.21, uTime * 0.17, uTime * 0.23) + aSeed * vec3(12.9, 78.2, 37.7));
  p = uBoxMin + mod(p - uBoxMin, box);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(uSize * (0.5 + aSeed) / -mv.z, 1.0, 6.0);
  vL = spotAt(p, 0.8) * uGain * (0.3 + aSeed * aSeed);
}`;
var MOTE_FS = `
varying vec3 vL;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.1, d);
  vec3 c = vL * a;
  ${HDR_SAFE("c")}
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
var VS = `
attribute vec3 iPos;
attribute vec4 iData;   // размер, поворот, альфа, кадр атласа
attribute vec4 iCol;    // цвет + растяжение (искры)
varying vec2 vUv;
varying float vA;
varying vec3 vC;
varying vec3 vL;
#include <fog_pars_vertex>
${LIT_GLSL}
void main() {
  vec4 mvPosition = modelViewMatrix * vec4(iPos, 1.0);
  float c = cos(iData.y), s = sin(iData.y);
  vec2 q = position.xy;
  q.x *= 1.0 + iCol.w;
  mvPosition.xy += vec2(q.x * c - q.y * s, q.x * s + q.y * c) * iData.x;
  gl_Position = projectionMatrix * mvPosition;
  float f = iData.w;
  vUv = ATLAS > 1.0 ? (uv + vec2(mod(f, 2.0), floor(f / 2.0))) * 0.5 : uv;
  vA = iData.z;
  vC = iCol.rgb;
  #ifdef LIT
  vL = uAmb + spotAt(iPos, 0.55) + flashAt(iPos);
  #else
  vL = vec3(1.0);
  #endif
  #include <fog_vertex>
}`;
var FS = `
uniform sampler2D map;
varying vec2 vUv;
varying float vA;
varying vec3 vC;
varying vec3 vL;
#include <fog_pars_fragment>
void main() {
  vec4 t = texture2D(map, vUv);
  vec3 c = vC * t.rgb * vL;
  ${HDR_SAFE("c")}
  gl_FragColor = vec4(c, t.a * vA);
  if (gl_FragColor.a < 0.003) discard;
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;
var Particles = class {
  constructor(scene, map, max, o = {}) {
    this.max = max;
    const g = new THREE6.InstancedBufferGeometry();
    const quad = new THREE6.PlaneGeometry(1, 1);
    g.index = quad.index;
    g.setAttribute("position", quad.getAttribute("position"));
    g.setAttribute("uv", quad.getAttribute("uv"));
    this.aPos = new THREE6.InstancedBufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE6.DynamicDrawUsage);
    this.aData = new THREE6.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE6.DynamicDrawUsage);
    this.aCol = new THREE6.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE6.DynamicDrawUsage);
    g.setAttribute("iPos", this.aPos);
    g.setAttribute("iData", this.aData);
    g.setAttribute("iCol", this.aCol);
    g.instanceCount = 0;
    const uniforms = { ...THREE6.UniformsUtils.merge([THREE6.UniformsLib.fog, { map: { value: null } }]), ...LIT };
    uniforms.map.value = map;
    const mat = new THREE6.ShaderMaterial({
      uniforms,
      vertexShader: VS,
      fragmentShader: FS,
      transparent: true,
      depthWrite: false,
      fog: true,
      blending: o.additive ? THREE6.AdditiveBlending : THREE6.NormalBlending,
      defines: { ATLAS: (o.atlas ? 2 : 1).toFixed(1), ...o.additive ? {} : { LIT: 1 } }
    });
    mat.toneMapped = !o.additive;
    this.mesh = new THREE6.Mesh(g, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = o.additive ? 3 : 2;
    scene.add(this.mesh);
    this.list = [];
    this.pool = [];
    this.sort = !!o.sort;
  }
  // p: {pos, vel, life, size, grow, alpha, color, drag, buoy, gravity, turb, rot, spin, frame, stretch, fadeIn}
  add(p) {
    if (this.list.length >= this.max) this.pool.push(this.list.shift());
    const q = this.pool.pop() || {};
    Object.assign(q, { t: 0, drag: 2, buoy: 0, gravity: 0, rot: R2() * 6.28, spin: (R2() - 0.5) * 1.2, frame: R2() * 4 | 0, stretch: 0, fadeIn: 0.06, grow: 0, turb: 0, bounce: 0 }, p);
    q.px = p.pos.x;
    q.py = p.pos.y;
    q.pz = p.pos.z;
    q.vx = p.vel.x;
    q.vy = p.vel.y;
    q.vz = p.vel.z;
    q.pos = q.vel = null;
    this.list.push(q);
  }
  update(dt, cam, wind) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i];
      p.t += dt;
      if (p.t >= p.life) {
        this.pool.push(p);
        L.splice(i, 1);
        continue;
      }
      const dr = Math.exp(-p.drag * dt);
      p.vx = p.vx * dr + wind.x * (1 - dr);
      p.vz = p.vz * dr + wind.z * (1 - dr);
      p.vy = p.vy * dr + (p.buoy - p.gravity) * dt;
      if (p.turb) {
        p.vx += (R2() - 0.5) * p.turb * dt;
        p.vy += (R2() - 0.5) * p.turb * dt;
        p.vz += (R2() - 0.5) * p.turb * dt;
      }
      p.px += p.vx * dt;
      p.py += p.vy * dt;
      p.pz += p.vz * dt;
      p.rot += p.spin * dt;
      // искры и крошка отскакивают от пола и катятся, теряя скорость
      if (p.bounce && this.floorAt) {
        const fl = this.floorAt(p.px, p.pz) + p.size * 0.3;
        if (p.py < fl) {
          p.py = fl;
          if (p.vy < -0.4) {
            p.vy = -p.vy * p.bounce * (0.7 + R2() * 0.5);
            p.vx *= 0.55;
            p.vz *= 0.55;
            p.spin *= 0.5;
          } else {
            p.vy = 0;
            p.vx *= Math.exp(-6 * dt);
            p.vz *= Math.exp(-6 * dt);
            p.spin *= Math.exp(-6 * dt);
          }
        }
      }
    }
    if (this.sort && L.length > 1 && cam) {
      const c = cam.position;
      for (const p of L) p.d = (p.px - c.x) ** 2 + (p.py - c.y) ** 2 + (p.pz - c.z) ** 2;
      L.sort((a, b) => b.d - a.d);
    }
    const P = this.aPos.array, D = this.aData.array, C = this.aCol.array;
    for (let i = 0; i < L.length; i++) {
      const p = L[i], k = p.t / p.life;
      P[i * 3] = p.px;
      P[i * 3 + 1] = p.py;
      P[i * 3 + 2] = p.pz;
      D[i * 4] = p.size + p.grow * Math.sqrt(k);
      D[i * 4 + 1] = p.rot;
      const fin = p.fadeIn > 0 ? Math.min(1, p.t / p.fadeIn) : 1;
      D[i * 4 + 2] = p.alpha * fin * (1 - k) * (1 - k * 0.5);
      D[i * 4 + 3] = p.frame;
      C[i * 4] = p.color[0];
      C[i * 4 + 1] = p.color[1];
      C[i * 4 + 2] = p.color[2];
      C[i * 4 + 3] = p.stretch * (1 - k);
    }
    this.mesh.geometry.instanceCount = L.length;
    if (L.length) {
      for (const a of [this.aPos, this.aData, this.aCol]) {
        a.clearUpdateRanges();
        a.addUpdateRange(0, L.length * a.itemSize);
        a.needsUpdate = true;
      }
    }
  }
};
// След пули: квад вдоль отрезка траектории, развёрнутый к камере. Ширина не меньше ≈1 пикселя,
// при расширении яркость делится — далёкий трассер остаётся точкой, а не исчезает.
var ST_VS = `
attribute vec3 iA;
attribute vec3 iB;
attribute vec4 iP;   // ширина (м), альфа, яркость ядра, —
attribute vec3 iC;
uniform float uPix;
varying vec2 vUv;
varying float vAl;
varying vec3 vCol;
varying float vCore;
void main() {
  vec3 ax = iB - iA;
  float L = length(ax);
  vec3 A = L > 1e-6 ? ax / L : vec3(1.0, 0.0, 0.0);
  vec3 mid = (iA + iB) * 0.5;
  vec3 toCam = cameraPosition - mid;
  float dist = length(toCam);
  vec3 side = cross(A, toCam / max(dist, 1e-4));
  float sl = length(side);
  side = sl > 1e-4 ? side / sl : vec3(0.0, 1.0, 0.0);
  float w = max(iP.x, dist * uPix);
  vec3 p = mix(iA, iB, position.x + 0.5) + side * position.y * w;
  vUv = uv;
  vAl = iP.y * min(1.0, iP.x / w);
  vCol = iC;
  vCore = iP.z;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;
var ST_FS = `
varying vec2 vUv;
varying float vAl;
varying vec3 vCol;
varying float vCore;
void main() {
  float a = abs(vUv.y - 0.5) * 2.0;
  float across = exp(-a * a * 5.0);
  float along = pow(vUv.x, 1.6);
  vec3 c = mix(vCol, vec3(1.0), vCore * exp(-a * a * 30.0) * along);
  ${HDR_SAFE("c")}
  gl_FragColor = vec4(c, vAl * across * along);
  if (gl_FragColor.a < 0.002) discard;
}`;
var Streaks = class {
  constructor(scene, max, additive) {
    this.max = max;
    const g = new THREE6.InstancedBufferGeometry();
    const quad = new THREE6.PlaneGeometry(1, 1);
    g.index = quad.index;
    g.setAttribute("position", quad.getAttribute("position"));
    g.setAttribute("uv", quad.getAttribute("uv"));
    const mk = (n) => new THREE6.InstancedBufferAttribute(new Float32Array(max * n), n).setUsage(THREE6.DynamicDrawUsage);
    this.a = { iA: mk(3), iB: mk(3), iP: mk(4), iC: mk(3) };
    for (const k in this.a) g.setAttribute(k, this.a[k]);
    g.instanceCount = 0;
    this.u = { uPix: { value: 1e-3 } };
    this.mesh = new THREE6.Mesh(g, new THREE6.ShaderMaterial({ uniforms: this.u, vertexShader: ST_VS, fragmentShader: ST_FS, transparent: true, depthWrite: false, blending: additive ? THREE6.AdditiveBlending : THREE6.NormalBlending, toneMapped: false, side: THREE6.DoubleSide }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = additive ? 4 : 3;
    scene.add(this.mesh);
    this.n = 0;
  }
  begin(cam) {
    this.n = 0;
    if (cam) this.u.uPix.value = 2 * Math.tan(cam.fov * Math.PI / 360) / Math.max(300, innerHeight) * 1.3;
  }
  push(A, B, width, alpha, core, col) {
    if (this.n >= this.max) return;
    const i = this.n++, a = this.a;
    a.iA.array.set([A.x, A.y, A.z], i * 3);
    a.iB.array.set([B.x, B.y, B.z], i * 3);
    a.iP.array.set([width, alpha, core, 0], i * 4);
    a.iC.array.set([col.r, col.g, col.b], i * 3);
  }
  end() {
    this.mesh.geometry.instanceCount = this.n;
    if (this.n) for (const k in this.a) {
      const at = this.a[k];
      at.clearUpdateRanges();
      at.addUpdateRange(0, this.n * at.itemSize);
      at.needsUpdate = true;
    }
  }
};
// Световая установка одного фонаря: прожектор с куки-профилем отражателя и тенью, объёмный
// конус (рассеяние в воздухе), отражённый свет от препятствия и пола, блик линзы.
// Основная установка пишет в LIT — ею подсвечиваются дым и пылинки; вторая — облегчённая.
var BeamRig = class {
  constructor(scene, T2, primary) {
    this.primary = primary;
    this.on = false;
    this.U = primary ? LIT : { ...LIT, uSpotPos: { value: new THREE6.Vector3() }, uSpotDir: { value: new THREE6.Vector3(1, 0, 0) }, uSpotCol: { value: new THREE6.Color(0, 0, 0) }, uSpotProf: { value: new THREE6.Vector3(0.08, 0.55, 0.035) } };
    this.spot = new THREE6.SpotLight(16777215, 0, 0, 0.55, 0.04, 2);
    this.spot.castShadow = true;
    this.spot.shadow.mapSize.set(primary ? 2048 : 1024, primary ? 2048 : 1024);
    this.spot.shadow.camera.near = 0.02;
    this.spot.shadow.camera.far = 160;
    this.spot.shadow.bias = -15e-5;
    this.spot.shadow.normalBias = 0.012;
    this.spot.shadow.autoUpdate = false;
    this.spot.map = beamCookie({ hot: 0.075, spill: 0.55, spillK: 0.035, ring: 0.06 });
    // второй прожектор добавляется в расчёт освещения только когда включён
    this.spot.visible = primary;
    scene.add(this.spot, this.spot.target);
    if (primary) {
      this.bounce = new THREE6.PointLight(16777215, 0, 0, 2);
      this.bounceFloor = new THREE6.PointLight(16777215, 0, 0, 2);
      scene.add(this.bounce, this.bounceFloor);
    }
    this.cone = new THREE6.Mesh(
      new THREE6.CylinderGeometry(1, 1e-4, 1, 64, 1, true).translate(0, 0.5, 0).rotateZ(-Math.PI / 2),
      new THREE6.ShaderMaterial({
        uniforms: { ...this.U, uTan: { value: 0.5 }, uLen: { value: 30 }, uDensity: { value: 2e-3 }, uTime: { value: 0 }, uInside: { value: 0 } },
        defines: { STEPS: 40 },
        vertexShader: CONE_VS,
        fragmentShader: CONE_FS,
        transparent: true,
        depthWrite: false,
        blending: THREE6.AdditiveBlending,
        side: THREE6.FrontSide
      })
    );
    this.cone.visible = false;
    this.cone.frustumCulled = false;
    this.cone.renderOrder = 1;
    scene.add(this.cone);
    this.lampGlow = new THREE6.Sprite(additive(T2.glow, 16774886, 0));
    this.lampGlow.renderOrder = 6;
    this.glare = new THREE6.Sprite(additive(T2.glare, 16774886, 0));
    this.glare.renderOrder = 6;
    scene.add(this.lampGlow, this.glare);
    this._v = new THREE6.Vector3();
  }
  // s: { pos, dir, beam, k — световой поток 0..1, warm, dist — до препятствия по оси, hit, cam, exposure }.
  // beam: { cd (кд-ед.), hot, spill, spillK, ring, tir, color, lensR }.
  set(s, haze) {
    const on = !!s && s.k > 1e-3;
    this.on = on;
    this.spot.shadow.autoUpdate = on;
    this.cone.visible = on;
    if (!this.primary) this.spot.visible = on;
    const U = this.U;
    if (!on) {
      this.spot.intensity = 0;
      if (this.bounce) this.bounce.intensity = this.bounceFloor.intensity = 0;
      this.lampGlow.material.opacity = 0;
      this.glare.material.opacity = 0;
      U.uSpotCol.value.setRGB(0, 0, 0);
      return;
    }
    const { pos, dir, beam: b, k } = s;
    const map = beamCookie(b);
    if (this.spot.map !== map) this.spot.map = map;
    this.spot.angle = b.spill * 1.02;
    const col = this.spot.color.set(b.color ?? 16054015);
    if (s.warm) col.lerp(WARM, s.warm);
    this.spot.intensity = b.cd * k;
    this.spot.position.copy(pos).addScaledVector(dir, 4e-3);
    this.spot.target.position.copy(pos).addScaledVector(dir, 10);
    this.spot.target.updateMatrixWorld();
    U.uSpotPos.value.copy(pos);
    U.uSpotDir.value.copy(dir);
    U.uSpotCol.value.copy(col).multiplyScalar(b.cd * k / 2.2);
    U.uSpotProf.value.set(b.hot, b.spill, b.spillK);
    if (this.bounce) {
      if (s.hit) {
        const flux = b.cd * k * (Math.tan(b.hot) ** 2 + b.spillK * Math.tan(b.spill) ** 2) * 0.4;
        this.bounce.intensity = flux;
        this.bounce.color.copy(col).lerp(s.hitColor || col, 0.5);
        this.bounce.position.copy(s.hit).addScaledVector(dir, -Math.min(0.5, (s.dist ?? 1) * 0.1));
      } else this.bounce.intensity = 0;
      if (dir.y < Math.sin(b.spill * 0.8)) {
        const down = Math.max(0.2, pos.y - 0.02);
        const a = Math.max(0.05, b.spill * 0.8 + Math.asin(Math.max(-1, Math.min(1, dir.y))));
        const reach = Math.min(12, down / Math.tan(a));
        this.bounceFloor.position.copy(pos).addScaledVector(dir, reach * 1.3);
        this.bounceFloor.position.y = 0.15;
        this.bounceFloor.intensity = b.cd * k * b.spillK * Math.tan(b.spill) ** 2 * 0.5 * 0.3;
        this.bounceFloor.color.copy(col);
      } else this.bounceFloor.intensity = 0;
    }
    const L = Math.min(s.dist ?? 60, 80) + 0.3, tn = Math.tan(b.spill);
    this.cone.position.copy(pos);
    this.cone.quaternion.setFromUnitVectors(X_AXIS, dir);
    this.cone.scale.set(L, L * tn, L * tn);
    const CU = this.cone.material.uniforms;
    CU.uTan.value = tn;
    CU.uLen.value = L;
    CU.uDensity.value = 12e-4 + haze * 0.045;
    const cam = s.cam;
    const v = this._v.subVectors(cam.position, pos), vl = v.length(), hh = v.dot(dir);
    const inside = hh > 0 && hh < L && Math.acos(Math.min(1, hh / vl)) < b.spill;
    this.cone.material.side = inside ? THREE6.BackSide : THREE6.FrontSide;
    CU.uInside.value = inside ? 1 : 0;
    const ang = Math.acos(Math.max(-1, Math.min(1, hh / vl)));
    const E = b.cd * k * beamProfile(b, ang) / (vl * vl);
    const g = Math.max(0, Math.min(1, Math.log2(1 + E * (s.exposure ?? 1) * 0.4) / 8));
    this.glare.position.copy(pos).addScaledVector(dir, 6e-3);
    this.glare.scale.setScalar(vl * (0.01 + 0.35 * g * g));
    this.glare.material.opacity = g;
    this.glare.material.color.copy(col);
    const face = Math.max(0, Math.cos(Math.min(Math.PI / 2, ang)));
    this.lampGlow.position.copy(pos).addScaledVector(dir, 3e-3);
    this.lampGlow.scale.setScalar((b.lensR ?? 0.013) * 2.6);
    this.lampGlow.material.opacity = Math.min(1, k * (0.25 + 0.75 * face));
    this.lampGlow.material.color.copy(col);
  }
};
var MAX_SHELLS = 60;
var WARM = new THREE6.Color(16763274);
var X_AXIS = new THREE6.Vector3(1, 0, 0);
var FX = class {
  constructor(scene, mats) {
    this.scene = scene;
    const T2 = textures();
    this.T = T2;
    this.mats = mats;
    this.flash = new THREE6.Group();
    this.flash.visible = false;
    scene.add(this.flash);
    const flameMat = () => new THREE6.MeshBasicMaterial({ map: T2.flameLong[0], transparent: true, blending: THREE6.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE6.DoubleSide, fog: false });
    const along = new THREE6.PlaneGeometry(1, 1).translate(0.5, 0, 0);
    this.flameAxis = new THREE6.Group();
    this.flamePlanes = [0, 1, 2].map(() => {
      const m = new THREE6.Mesh(along, flameMat());
      m.renderOrder = 4;
      m.frustumCulled = false;
      this.flameAxis.add(m);
      return m;
    });
    const across = new THREE6.PlaneGeometry(1, 1).rotateY(Math.PI / 2);
    this.flameStar = new THREE6.Mesh(across, flameMat());
    this.flameStar.renderOrder = 4;
    this.flameStar.frustumCulled = false;
    this.flameAxis.add(this.flameStar);
    this.jets = [0, 1].map(() => {
      const g = new THREE6.Group();
      for (let i = 0; i < 2; i++) {
        const m = new THREE6.Mesh(along, flameMat());
        m.rotation.x = i * Math.PI / 2;
        m.renderOrder = 4;
        m.frustumCulled = false;
        g.add(m);
      }
      this.flameAxis.add(g);
      return g;
    });
    this.flash.add(this.flameAxis);
    this.flashFade = 1;
    this.flashLight = new THREE6.PointLight(16754768, 0, 16, 2);
    scene.add(this.flashLight);
    this.flashT = 0;
    this.smoke = new Particles(scene, T2.smoke, 420, { atlas: true, sort: true });
    this.fire = new Particles(scene, T2.spark, 260, { additive: true });
    this.smoke.floorAt = this.fire.floorAt = (x, z) => this.floorAt(x, z);
    this.wind = new THREE6.Vector3(0.18, 0, 0.1);
    this.noWind = new THREE6.Vector3();
    this.heat = 0;
    this.wispT = 0;
    this.haze = 0;
    this.floorAt = () => 0;
    this.shells = [];
    this.inst = /* @__PURE__ */ new Map();
    this.holes = [];
    this.holeGeo = new THREE6.CircleGeometry(0.012, 12);
    this.holeMat = new THREE6.MeshBasicMaterial({ map: T2.hole, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
    this.tracers = new Streaks(scene, 64, true);
    this.traces = new Streaks(scene, 64, false);
    this.night = false;
    this._c = new THREE6.Color();
    // до двух ЛЦУ и двух фонарей одновременно — у каждого свой луч
    this.lasers = [0, 1].map(() => {
      const beam = new THREE6.Mesh(
        new THREE6.CylinderGeometry(7e-4, 16e-4, 1, 6, 1, true).translate(0, 0.5, 0).rotateZ(-Math.PI / 2),
        new THREE6.MeshBasicMaterial({ color: 16722458, transparent: true, opacity: 0.2, blending: THREE6.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false })
      );
      beam.visible = false;
      beam.frustumCulled = false;
      const dot = new THREE6.Sprite(new THREE6.SpriteMaterial({ map: T2.glow, color: 16724e3, transparent: true, depthWrite: false, toneMapped: false }));
      const halo = new THREE6.Sprite(additive(T2.glow, 16724e3, 0.3));
      dot.visible = halo.visible = false;
      dot.renderOrder = halo.renderOrder = 5;
      scene.add(beam, dot, halo);
      return { beam, dot, halo };
    });
    this.rigs = [new BeamRig(scene, T2, true), new BeamRig(scene, T2, false)];
    {
      const N = 900, pos = new Float32Array(N * 3), seed = new Float32Array(N);
      this.moteBox = [new THREE6.Vector3(-0.6, 0.5, -1.6), new THREE6.Vector3(7, 2.8, 1.6)];
      const [a, b] = this.moteBox;
      for (let i = 0; i < N; i++) {
        pos[i * 3] = a.x + R2() * (b.x - a.x);
        pos[i * 3 + 1] = a.y + R2() * (b.y - a.y);
        pos[i * 3 + 2] = a.z + R2() * (b.z - a.z);
        seed[i] = R2();
      }
      const g = new THREE6.BufferGeometry();
      g.setAttribute("position", new THREE6.BufferAttribute(pos, 3));
      g.setAttribute("aSeed", new THREE6.BufferAttribute(seed, 1));
      this.motes = new THREE6.Points(g, new THREE6.ShaderMaterial({
        uniforms: { ...LIT, uTime: { value: 0 }, uSize: { value: 4 }, uGain: { value: 22e-4 }, uBoxMin: { value: a }, uBoxMax: { value: b } },
        vertexShader: MOTE_VS,
        fragmentShader: MOTE_FS,
        transparent: true,
        depthWrite: false,
        blending: THREE6.AdditiveBlending
      }));
      this.motes.visible = false;
      this.motes.frustumCulled = false;
      scene.add(this.motes);
    }
    this.time = 0;
    this.beamOn = false;
    this.ray = new THREE6.Raycaster();
    this._v = new THREE6.Vector3();
    this._v2 = new THREE6.Vector3();
    this._q = new THREE6.Quaternion();
    this._m = new THREE6.Matrix4();
    this._s = new THREE6.Vector3(1, 1, 1);
  }
  // Что-то ещё движется — кадр нужно перерисовать.
  active() {
    return this.flashT > 0 || this.smoke.list.length > 0 || this.fire.list.length > 0 || this.heat > 0.3 || this.shells.some((s) => s.alive && !s.rest) || this.beamOn || this.tracers.n > 0 || this.traces.n > 0;
  }
  smokePuff(pos, vel, o = {}) {
    const g = o.grey ?? 0.58 + R2() * 0.1;
    this.smoke.add({
      pos,
      vel,
      life: o.life ?? 1.6 + R2(),
      size: o.size ?? 0.03,
      grow: o.grow ?? 0.3,
      alpha: o.alpha ?? 0.35,
      color: o.tint ? [g * 0.96, g * 0.98, g * 1.04] : [g * 1.02, g, g * 0.95],
      drag: o.drag ?? 3.5,
      buoy: o.buoy ?? 0.12,
      turb: o.turb ?? 0.25,
      fadeIn: o.fadeIn ?? 0.03,
      gravity: o.gravity ?? 0
    });
  }
  // kind: bare | fh | comp | linear | brake | supp; q — ориентация оружия (боковые струи),
  // o.flash — заметность вспышки дульного устройства (0..1), o.first — первый выстрел из холодного глушителя
  muzzleFlash(pos, dir, kind, size = 1, q = null, o = {}) {
    const T2 = this.T, supp = kind === "supp";
    const pick = (a3) => a3[R2() * a3.length | 0];
    this.flash.position.copy(pos);
    if (q) this.flameAxis.quaternion.copy(q);
    else this.flameAxis.quaternion.setFromUnitVectors(X_AXIS, dir);
    this.flash.visible = true;
    this.flashT = 0.03;
    this.flashFade = 1;
    const vis = o.flash ?? 1;
    const k = size * (0.85 + R2() * 0.3);
    const P = {
      bare: { L: 0.3, W: 0.12, a: 1, long: true, star: 0 },
      fh: { L: 0.11, W: 0.05, a: 0.55, long: false, star: 4 },
      comp: { L: 0.16, W: 0.07, a: 0.85, long: false, star: 0 },
      linear: { L: 0.22, W: 0.05, a: 0.8, long: true, star: 0 },
      brake: { L: 0.1, W: 0.06, a: 0.75, long: false, star: 0 },
      supp: { L: 0.035, W: 0.025, a: o.first ? 0.7 : 0.25, long: false, star: 0 }
    }[kind] || { L: 0.2, W: 0.08, a: 0.9, long: true, star: 0 };
    const a = P.a * (0.35 + 0.65 * Math.min(1, vis * 1.4));
    const tex2 = P.long ? T2.flameLong : T2.flameShort;
    const roll = R2() * Math.PI;
    this.flamePlanes.forEach((m, i) => {
      m.rotation.x = roll + i * Math.PI / 3;
      m.material.map = pick(tex2);
      m.userData.a = a * (i ? 0.75 : 1);
      m.material.opacity = m.userData.a;
      m.scale.set(P.L * k * (0.8 + R2() * 0.4), P.W * k * (0.8 + R2() * 0.4), 1);
    });
    this.flameStar.material.map = pick(P.star === 4 ? T2.star4 : P.star === 3 ? T2.star3 : T2.star);
    this.flameStar.userData.a = a * (supp ? 0.5 : 0.9);
    this.flameStar.material.opacity = this.flameStar.userData.a;
    this.flameStar.position.set(P.L * 0.12 * k, 0, 0);
    this.flameStar.rotation.x = R2() * 6.28;
    this.flameStar.scale.setScalar(P.W * 1.5 * k * (0.8 + R2() * 0.4));
    const jetDirs = kind === "brake" ? [[0, 0, 1], [0, 0, -1]] : kind === "comp" ? [[0.25, 1, 0.3], [0.25, 1, -0.3]] : [];
    this.jets.forEach((g, i) => {
      const d = jetDirs[i];
      g.visible = !!d;
      if (!d) return;
      g.quaternion.setFromUnitVectors(X_AXIS, new THREE6.Vector3(...d).normalize());
      g.position.set(P.L * 0.3 * k, 0, 0);
      const L = (kind === "brake" ? 0.14 : 0.08) * k * (0.8 + R2() * 0.4);
      g.children.forEach((m) => {
        m.material.map = pick(T2.flameShort);
        m.material.opacity = a * 0.8;
        m.scale.set(L, L * 0.45, 1);
      });
    });
    this.flashLight.position.copy(pos).addScaledVector(dir, 0.08);
    this.flashLight.intensity = (supp ? 0.6 : 7) * a * size;
    this.heat = Math.min(3, this.heat + 0.22 * size);
    this.haze = Math.min(1, this.haze + 0.025 * size * (supp ? 0.8 : 1));
    const nSp = supp ? 0 : Math.round((kind === "bare" ? 5 : kind === "brake" ? 4 : 2) * size * (0.5 + R2()));
    for (let i = 0; i < nSp; i++) {
      const v = dir.clone().multiplyScalar(5 + R2() * 9).add(new THREE6.Vector3((R2() - 0.5) * 2, (R2() - 0.5) * 2, (R2() - 0.5) * 2));
      this.fire.add({ pos: pos.clone().addScaledVector(dir, 0.03), vel: v, life: 0.04 + R2() * 0.07, size: 25e-4 + R2() * 3e-3, alpha: 1, color: [1, 0.66, 0.3], drag: 7, gravity: 3, stretch: 3, fadeIn: 0, spin: 0 });
    }
    const lvl = size * (supp ? 0.7 : kind === "brake" ? 0.8 : 1) * (o.smoke ?? 1);
    const gas = size < 1 ? Math.pow(size, 1.5) : 1 + (size - 1) * 0.5;
    const haze = (p, v, op) => this.smokePuff(p, v, { grey: 0.5 + R2() * 0.12, tint: 1, ...op, size: op.size * gas, grow: op.grow * gas });
    const n = supp ? 5 : 8;
    for (let i = 0; i < n; i++) {
      const v = dir.clone().multiplyScalar((supp ? 0.4 : 1.2) + R2() * (supp ? 0.8 : 2.4)).add(new THREE6.Vector3((R2() - 0.5) * 0.35, (R2() - 0.3) * 0.3, (R2() - 0.5) * 0.35));
      haze(pos.clone().addScaledVector(dir, 0.02 + R2() * 0.12), v, { size: 0.02 + R2() * 0.02, grow: 0.22 + R2() * 0.28, alpha: (0.1 + R2() * 0.07) * lvl, life: 0.9 + R2() * 1.3, drag: 6 + R2() * 3, buoy: 0.06, turb: 0.5, fadeIn: 0.02 });
    }
    const side = new THREE6.Vector3(0, 0, 1).applyQuaternion(this.flameAxis.quaternion);
    const up = new THREE6.Vector3(0, 1, 0);
    if (kind === "brake" || kind === "comp") {
      for (let i = 0; i < 6; i++) {
        const sg = kind === "comp" ? (R2() - 0.5) * 0.6 : i % 2 ? 1 : -1;
        const v = side.clone().multiplyScalar(sg * (1.5 + R2() * 2)).addScaledVector(up, kind === "comp" ? 1.2 + R2() * 1.5 : (R2() - 0.2) * 0.6).addScaledVector(dir, R2() * 0.6);
        haze(pos.clone(), v, { size: 0.02, grow: 0.25 + R2() * 0.2, alpha: 0.09 * size, life: 0.9 + R2() * 0.8, drag: 7, turb: 0.5 });
      }
    }
    for (let i = 0; i < 2; i++) {
      haze(pos.clone().addScaledVector(dir, 0.05 + R2() * 0.2), dir.clone().multiplyScalar(0.15 + R2() * 0.3).add(new THREE6.Vector3(0, 0.04, 0)), { size: 0.05, grow: 0.5 + R2() * 0.3, alpha: 0.045 * lvl, life: 2.2 + R2() * 1.5, drag: 2.5, buoy: 0.07, turb: 0.35, fadeIn: 0.2 });
    }
    // Дульная волна: газ за пулей срывается вихревым кольцом — оно быстро расширяется поперёк
    // оси, тормозится воздухом (большое сопротивление) и расплывается. Тормоз режет кольцо вбок.
    if (!supp && kind !== "brake") {
      const ringN = 10, up2 = new THREE6.Vector3(0, 1, 0).applyQuaternion(this.flameAxis.quaternion);
      const ringV = (kind === "bare" ? 3.2 : kind === "comp" ? 2.4 : 1.8) * gas, fwd = (kind === "linear" ? 3 : 1.6) * gas;
      const d0 = 0.04 + R2() * 0.03;
      for (let i = 0; i < ringN; i++) {
        const a = i / ringN * Math.PI * 2 + R2() * 0.3;
        const rad = side.clone().multiplyScalar(Math.cos(a)).addScaledVector(up2, Math.sin(a));
        haze(pos.clone().addScaledVector(dir, d0).addScaledVector(rad, 0.01), rad.multiplyScalar(ringV * (0.8 + R2() * 0.4)).addScaledVector(dir, fwd * (0.8 + R2() * 0.4)), { size: 0.016, grow: 0.16 + R2() * 0.08, alpha: 0.075 * lvl, life: 0.7 + R2() * 0.5, drag: 9 + R2() * 3, buoy: 0.05, turb: 0.6, fadeIn: 0.01 });
      }
    }
  }
  // пороховые газы из окна выброса
  portSmoke(pos, dir, k = 1) {
    for (let i = 0; i < 2; i++) {
      const v = dir.clone().multiplyScalar(0.35 + R2() * 0.3).add(new THREE6.Vector3((R2() - 0.5) * 0.1, 0.18 + R2() * 0.1, 0));
      this.smokePuff(pos.clone(), v, { size: 0.01, grow: 0.1 + R2() * 0.08, alpha: Math.min(0.2, 0.09 * k), life: 0.8 + R2() * 0.6, drag: 3.5, grey: 0.6, tint: 1, turb: 0.3 });
    }
  }
  shellMesh(key, cal, live) {
    let m = this.inst.get(key);
    if (m) return m;
    const c = CAL[cal] || CAL["556"];
    const brass = c.steel ? this.mats.get("steelCase") : this.mats.get("brass");
    let g = caseGeo(cal), mat = brass;
    if (c.shot || live) {
      // гильза дроби — два материала (латунь + пластик); живой патрон — гильза + пуля
      const parts = (c.shot ? [shotHead(c), shotHull(c, !live)] : [g, bulletGeo(cal)]).map((x) => x.index ? x.toNonIndexed() : x);
      g = new THREE6.BufferGeometry();
      for (const a of ["position", "normal"]) {
        const arr = new Float32Array(parts[0].getAttribute(a).array.length + parts[1].getAttribute(a).array.length);
        arr.set(parts[0].getAttribute(a).array, 0);
        arr.set(parts[1].getAttribute(a).array, parts[0].getAttribute(a).array.length);
        g.setAttribute(a, new THREE6.BufferAttribute(arr, 3));
      }
      const n0 = parts[0].getAttribute("position").count;
      g.addGroup(0, n0, 0);
      g.addGroup(n0, parts[1].getAttribute("position").count, 1);
      mat = c.shot ? [this.mats.get("brass"), this.mats.get("hullRed")] : [brass, this.mats.get("copper")];
    }
    g.scale(1e-3, 1e-3, 1e-3);
    g.translate(-c.L * 5e-4, 0, 0);
    m = new THREE6.InstancedMesh(g, mat, live ? 8 : MAX_SHELLS);
    m.castShadow = true;
    m.count = 0;
    m.frustumCulled = false;
    m.instanceMatrix.setUsage(THREE6.DynamicDrawUsage);
    this.scene.add(m);
    this.inst.set(key, m);
    return m;
  }
  // Гильза: вылет из окна с кувырком, дымок из дульца, отскоки от бетона.
  shell(pos, vel, cal, quat, live = false) {
    const c = CAL[cal] || CAL["556"];
    const key = cal + (live ? ":live" : "");
    this.shellMesh(key, cal, live);
    const cap = live ? 8 : MAX_SHELLS;
    const same = this.shells.filter((x) => x.key === key);
    let s = same.find((x) => !x.alive);
    if (!s) {
      if (same.length >= cap) s = same.reduce((a, b) => a.t > b.t ? a : b);
      else {
        s = { key, pos: new THREE6.Vector3(), quat: new THREE6.Quaternion(), vel: new THREE6.Vector3(), w: new THREE6.Vector3() };
        this.shells.push(s);
      }
    }
    s.pos.copy(pos);
    s.quat.copy(quat);
    s.vel.copy(vel);
    const axis = X_AXIS.clone().applyQuaternion(quat);
    const tumble = new THREE6.Vector3().crossVectors(axis, vel).normalize();
    s.w.copy(tumble).multiplyScalar((live ? 12 : 24) + R2() * 22).addScaledVector(axis, (R2() - 0.5) * 12);
    s.alive = true;
    s.rest = false;
    s.t = 0;
    s.bounced = 0;
    s.steel = c.steel;
    s.live = live;
    s.prevY = pos.y;
    s.r = c.rim * 5e-4;
    s.kind = c.shot ? "hull" : c.steel ? "steel" : "brass";
    s.trail = live ? 0 : c.shot ? 0.5 : 0.28;
    return s;
  }
  // Попадание. Сталь — искры и отметина; бумага — пробоина и клочки картона;
  // бетон — серая пыль и крошка; дерево — щепа; пулеулавливатель — искры и тёмная пыль.
  // o: { v — скорость у цели, м/с; graze — рикошет под скользящим углом; pellet — картечина; dir — направление полёта }
  impact(hit, surface, o = {}) {
    const p = hit.point, n = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : new THREE6.Vector3(0, 1, 0);
    // энергия удара относительно винтовочной пули 5,56 у дульного среза
    const E = o.v ? Math.max(0.25, Math.min(2.2, Math.pow(o.v / 800, 2) * (o.mass ?? 4) / 4)) : 1;
    const q = o.pellet ? 0.35 : Math.sqrt(E);
    if (o.graze) {
      // рикошет: веер искр/пыли вдоль отражённого направления, отметины нет
      const d = o.dir ? o.dir.clone() : n.clone().negate();
      const refl = d.sub(n.clone().multiplyScalar(2 * d.dot(n))).normalize();
      const hard = surface === "steel" || surface === "trap" || surface === "panel" || surface === "concrete";
      for (let i = 0; i < (hard ? 6 : 3); i++) {
        const v = refl.clone().multiplyScalar(4 + R2() * 6).add(new THREE6.Vector3((R2() - 0.5) * 1.5, R2() * 1.2, (R2() - 0.5) * 1.5));
        if (hard) this.fire.add({ pos: p.clone().addScaledVector(n, 0.01), vel: v, life: 0.08 + R2() * 0.12, size: 0.01 + R2() * 0.008, alpha: 1, color: [1, 0.72, 0.38], drag: 2, gravity: 9.8, stretch: 3, fadeIn: 0, spin: 0 });
        this.smoke.add({ pos: p.clone(), vel: v.multiplyScalar(0.15), life: 0.6 + R2() * 0.4, size: 0.03, grow: 0.25, alpha: 0.25, color: [0.6, 0.58, 0.55], drag: 3, gravity: 0.3, turb: 0.3 });
      }
      return;
    }
    const sparks = (cnt, spd, col = [1, 0.75, 0.4]) => {
      cnt = Math.max(1, Math.round(cnt * q));
      for (let i = 0; i < cnt; i++) {
        const v = n.clone().multiplyScalar(1 + R2() * spd).add(new THREE6.Vector3((R2() - 0.5) * 4, R2() * 3, (R2() - 0.5) * 4));
        this.fire.add({ pos: p.clone().addScaledVector(n, 0.01), vel: v.multiplyScalar(0.7 + 0.3 * q), life: 0.25 + R2() * 0.35, size: 0.012 + R2() * 0.01, alpha: 1, color: col, drag: 1.5, gravity: 9.8, stretch: 2, fadeIn: 0, spin: 0, bounce: 0.45 });
      }
    };
    const dust = (cnt, col, size = 0.08, alpha = 0.55) => {
      cnt = Math.max(1, Math.round(cnt * q));
      size *= 0.7 + 0.3 * q;
      for (let i = 0; i < cnt; i++) {
        this.smoke.add({ pos: p.clone(), vel: n.clone().multiplyScalar(0.8 + R2() * 1.4).add(new THREE6.Vector3((R2() - 0.5) * 0.9, R2() * 1.2, (R2() - 0.5) * 0.9)), life: 1 + R2() * 0.8, size, grow: size * 7, alpha, color: col, drag: 2.5, gravity: 0.4, turb: 0.3 });
      }
    };
    const chips = (cnt, col, size = 0.025) => {
      cnt = Math.max(1, Math.round(cnt * q));
      for (let i = 0; i < cnt; i++) {
        this.smoke.add({ pos: p.clone(), vel: n.clone().multiplyScalar(2 + R2() * 2).add(new THREE6.Vector3((R2() - 0.5) * 2, R2() * 2, (R2() - 0.5) * 2)), life: 0.9 + R2() * 0.6, size, alpha: 0.9, color: col, drag: 0.8, gravity: 9.8, fadeIn: 0, bounce: 0.3, spin: (R2() - 0.5) * 12 });
      }
    };
    const hole = (scale = 1) => {
      const m = new THREE6.Mesh(this.holeGeo, this.holeMat);
      hit.object.worldToLocal(m.position.copy(p).addScaledVector(n, 15e-4));
      const ln = n.clone().transformDirection(new THREE6.Matrix4().copy(hit.object.matrixWorld).invert());
      m.lookAt(m.position.clone().add(ln));
      m.scale.setScalar(scale * (o.hole ?? 1));
      hit.object.add(m);
      this.holes.push(m);
      if (this.holes.length > 120) {
        const h = this.holes.shift();
        h.parent?.remove(h);
      }
    };
    // касательный базис к поверхности попадания
    const t1 = new THREE6.Vector3().crossVectors(n, Math.abs(n.y) < 0.9 ? new THREE6.Vector3(0, 1, 0) : new THREE6.Vector3(1, 0, 0)).normalize();
    const t2 = new THREE6.Vector3().crossVectors(n, t1);
    // пылевая корона: выброс конусом от поверхности + медленно оседающая взвесь
    const crown = (cnt, col, spd, size) => {
      cnt = Math.max(2, Math.round(cnt * q));
      for (let i = 0; i < cnt; i++) {
        const a = R2() * Math.PI * 2, open = 0.35 + R2() * 0.5;
        const v = n.clone().multiplyScalar(spd * (0.6 + R2() * 0.6)).addScaledVector(t1, Math.cos(a) * spd * open).addScaledVector(t2, Math.sin(a) * spd * open);
        this.smoke.add({ pos: p.clone().addScaledVector(n, 0.01), vel: v, life: 0.5 + R2() * 0.5, size: size * 0.5, grow: size * 4, alpha: 0.5, color: col, drag: 7, gravity: 1.2, turb: 0.4, fadeIn: 0.01 });
      }
      for (let i = 0; i < Math.max(1, Math.round(2 * q)); i++) this.smoke.add({ pos: p.clone().addScaledVector(n, 0.05), vel: n.clone().multiplyScalar(0.2).add(new THREE6.Vector3((R2() - 0.5) * 0.2, 0.05, (R2() - 0.5) * 0.2)), life: 3 + R2() * 2, size: size * 1.5, grow: size * 9, alpha: 0.12, color: col, drag: 1.5, gravity: 0.05, buoy: 0.01, turb: 0.15, fadeIn: 0.3 });
    };
    if (surface === "steel") {
      for (let i = 0; i < 3; i++) this.smokePuff(p.clone().addScaledVector(n, 0.02), n.clone().multiplyScalar(0.4).add(new THREE6.Vector3((R2() - 0.5) * 0.6, R2() * 0.5, (R2() - 0.5) * 0.6)), { life: 0.7, size: 0.06, grow: 0.25, alpha: 0.4, drag: 3 });
      sparks(10, 2);
      // вспышка удара и «брызги» свинца: пуля растекается по плите — веер почти вдоль поверхности
      this.fire.add({ pos: p.clone().addScaledVector(n, 0.015), vel: new THREE6.Vector3(), life: 0.05, size: 0.07 * (0.7 + 0.3 * q), alpha: 1, color: [1, 0.85, 0.6], drag: 0, fadeIn: 0, spin: 0 });
      const splash = Math.round(14 * q);
      for (let i = 0; i < splash; i++) {
        const a = R2() * Math.PI * 2, s = 6 + R2() * 10;
        const v = t1.clone().multiplyScalar(Math.cos(a) * s).addScaledVector(t2, Math.sin(a) * s).addScaledVector(n, s * (0.05 + R2() * 0.15));
        this.fire.add({ pos: p.clone().addScaledVector(n, 0.008), vel: v, life: 0.06 + R2() * 0.1, size: 5e-3 + R2() * 5e-3, alpha: 0.9, color: [1, 0.8, 0.55], drag: 4, gravity: 9.8, stretch: 4, fadeIn: 0, spin: 0 });
        if (i % 3 === 0) this.smoke.add({ pos: p.clone().addScaledVector(n, 0.01), vel: v.clone().multiplyScalar(0.12), life: 0.5 + R2() * 0.4, size: 0.015, grow: 0.12, alpha: 0.3, color: [0.55, 0.55, 0.56], drag: 5, gravity: 0.2, turb: 0.3 });
      }
      hole();
    } else if (surface === "paper") {
      hole(0.55);
      chips(4, [0.72, 0.6, 0.42], 0.012);
      // волокна картона: лёгкое облачко с обеих сторон (пуля прошла насквозь)
      for (const sgn of [1, -1]) this.smoke.add({ pos: p.clone().addScaledVector(n, 0.01 * sgn), vel: n.clone().multiplyScalar(sgn * (0.3 + R2() * 0.3)), life: 0.5 + R2() * 0.3, size: 0.01, grow: 0.08, alpha: 0.35, color: [0.75, 0.66, 0.5], drag: 4, gravity: 0.3, turb: 0.2 });
    } else if (surface === "trap") {
      sparks(6, 1.5, [1, 0.7, 0.35]);
      dust(3, [0.3, 0.29, 0.27], 0.1, 0.4);
    } else if (surface === "wood") {
      dust(3, [0.55, 0.45, 0.33], 0.05, 0.45);
      chips(6, [0.6, 0.48, 0.32], 0.02);
      crown(4, [0.58, 0.48, 0.36], 1.4, 0.03);
    } else if (surface === "panel") {
      sparks(2, 1);
      dust(3, [0.35, 0.35, 0.36], 0.06, 0.4);
    } else {
      dust(6, [0.62, 0.61, 0.58]);
      chips(5, [0.45, 0.44, 0.42]);
      crown(8, [0.6, 0.59, 0.56], 2.2, 0.04);
    }
  }
  // ЛЦУ. s: { pos, dir, hitables, color, k — мощность 0..1 (батарея), night }; i — номер излучателя.
  // Луч в чистом воздухе почти не виден; в темноте и в дыму — тонкая нить.
  setLaser(s, i = 0) {
    const L = this.lasers[i];
    const on = !!s && s.k > 2e-3;
    L.beam.visible = L.dot.visible = L.halo.visible = on;
    if (!on) return;
    const { pos, dir } = s;
    this.ray.set(pos, dir);
    this.ray.far = 250;
    const h = this.ray.intersectObjects(s.hitables, false)[0];
    const d = h ? h.distance : 250;
    const col = s.color ?? 16722458;
    L.beam.material.color.set(col);
    L.dot.material.color.set(col);
    L.halo.material.color.set(col);
    L.beam.position.copy(pos);
    L.beam.scale.set(d, 1, 1);
    L.beam.quaternion.setFromUnitVectors(X_AXIS, dir);
    L.beam.material.opacity = s.k * ((s.night ? 0.045 : 6e-3) + this.haze * (s.night ? 0.4 : 0.12));
    L.dot.position.copy(pos).addScaledVector(dir, d - 0.01);
    L.halo.position.copy(L.dot.position);
    const ds = 7e-3 + d * 9e-4;
    L.dot.scale.setScalar(ds);
    L.dot.material.opacity = Math.min(1, s.k * 1.1);
    L.halo.scale.setScalar(ds * (s.night ? 5 : 2.2));
    L.halo.material.opacity = s.k * (s.night ? 0.4 : 0.12);
  }
  // Фонарь i (0 — основной, подсвечивает дым и пылинки; 1 — второй).
  setLight(s, i = 0) {
    this.rigs[i].set(s, this.haze);
    this.beamOn = this.rigs[0].on || this.rigs[1].on;
    this.motes.visible = this.rigs[0].on;
  }
  // Качество: шаги объёмного луча, число пылинок, размер тени второго фонаря.
  setQuality(q) {
    for (const r of this.rigs) {
      const m = r.cone.material;
      if (m.defines.STEPS !== q.steps) {
        m.defines.STEPS = q.steps;
        m.needsUpdate = true;
      }
    }
    this.motes.geometry.setDrawRange(0, q.motes);
    const sp = this.rigs[0].spot.shadow;
    if (sp.mapSize.x !== q.spot) {
      sp.mapSize.set(q.spot, q.spot);
      sp.map?.dispose();
      sp.map = null;
    }
  }
  // Трасса пули: след ударной волны/тёплого воздуха за пулей или трассер (гореть начинает с 10 м).
  bullets(list, mode, cam) {
    this.tracers.begin(cam);
    this.traces.begin(cam);
    if (mode !== "off") {
      const vis = this.night ? 1 : 0.45;
      const amb = this.night ? [0.035, 0.042, 0.06] : [0.92, 0.94, 0.98];
      const A = this._v, dirV = this._v2;
      for (const b of list) {
        const head = b.p, fade = b.alive ? 1 : Math.max(0, (b.fade ?? 0) / 0.12);
        if (fade <= 0) continue;
        const v = b.v.length();
        dirV.copy(b.v).divideScalar(Math.max(v, 1));
        const flown = b.origin.distanceTo(head);
        if (b.tracer || mode === "tracer") {
          const burn = flown - 10;
          if (burn <= 0) continue;
          const len = Math.min(burn, v * 0.022, 25);
          A.copy(head).addScaledVector(dirV, -len);
          this._c.setHex(b.spec.tracer ?? 16725558);
          this.tracers.push(A, head, 0.012, (0.55 + 0.45 * vis) * fade, 0.8, this._c);
        } else {
          if (flown < 2.5) continue;
          const len = Math.min(flown - 2, 3.5);
          A.copy(head).addScaledVector(dirV, -len);
          this._c.setRGB(amb[0], amb[1], amb[2]);
          const sup = v > 360 ? 1 : 0.55;
          this.traces.push(A, head, 0.006, 0.16 * sup * fade, 0, this._c);
        }
      }
    }
    this.tracers.end();
    this.traces.end();
  }
  setAmbient(k) {
    LIT.uAmb.value.setScalar(k);
  }
  // muzzle — текущий дульный срез: от нагретого ствола после очереди идёт струйка дыма
  update(dt, onShellBounce, cam, muzzle) {
    this.time += dt;
    this.haze *= Math.exp(-dt / 30);
    for (const r of this.rigs) r.cone.material.uniforms.uTime.value = this.time;
    this.motes.material.uniforms.uTime.value = this.time;
    LIT.uFlashPos.value.copy(this.flashLight.position);
    LIT.uFlashCol.value.setRGB(1, 0.66, 0.31).multiplyScalar(this.flashLight.intensity / 2.2);
    if (this.flashT > 0) {
      this.flashT -= dt;
      if (this.flashT <= 0) {
        this.flash.visible = false;
        this.flashLight.intensity = 0;
      } else {
        this.flashLight.intensity *= 0.5;
        this.flashFade *= 0.55;
      }
    }
    if (this.flash.visible && cam) {
      const ax = this._v.set(1, 0, 0).applyQuaternion(this.flameAxis.quaternion);
      const f = Math.abs(ax.dot(this._v2.subVectors(this.flash.position, cam.position).normalize()));
      const F = this.flashFade;
      this.flameStar.material.opacity = this.flameStar.userData.a * (0.15 + 0.85 * f * f) * F;
      for (const m of this.flamePlanes) m.material.opacity = m.userData.a * (1 - 0.55 * f * f) * F;
    }
    if (this.heat > 0) {
      this.heat = Math.max(0, this.heat - dt * 0.35);
      this.wispT -= dt;
      if (this.wispT <= 0 && this.heat > 0.3 && muzzle) {
        this.wispT = 0.06 + R2() * 0.05;
        this.smokePuff(muzzle.clone(), new THREE6.Vector3((R2() - 0.5) * 0.02, 0.1 + R2() * 0.06, (R2() - 0.5) * 0.02), { size: 0.01, grow: 0.09, alpha: Math.min(0.08, this.heat * 0.035), life: 1.8 + R2(), drag: 1.2, buoy: 0.06, turb: 0.12, grey: 0.6, tint: 1, fadeIn: 0.3 });
      }
    }
    for (const s of this.shells) {
      if (!s.alive) continue;
      s.t += dt;
      if (s.t > 10) {
        s.alive = false;
        continue;
      }
      if (s.rest) continue;
      s.vel.y -= 9.81 * dt;
      s.vel.multiplyScalar(Math.exp(-0.25 * dt));
      s.pos.addScaledVector(s.vel, dt);
      const wl = s.w.length();
      if (wl > 1e-3) {
        this._q.setFromAxisAngle(this._v.copy(s.w).divideScalar(wl), wl * dt);
        s.quat.premultiply(this._q);
      }
      if (s.trail > 0) {
        s.trail -= dt;
        if (R2() < 0.45) this.smokePuff(s.pos.clone(), s.vel.clone().multiplyScalar(0.1), { size: 6e-3, grow: 0.05, alpha: 0.06, life: 0.5 + R2() * 0.4, drag: 4, grey: 0.62, tint: 1, fadeIn: 0.02 });
      }
      let fl = this.floorAt(s.pos.x, s.pos.z);
      if (fl > 0 && s.prevY < fl) fl = 0;
      s.prevY = s.pos.y;
      const floor = fl + s.r;
      if (s.pos.y < floor) {
        s.pos.y = floor;
        if (s.vel.y < -0.35) {
          s.vel.y *= -(0.28 + R2() * 0.12);
          s.vel.x *= 0.55;
          s.vel.z *= 0.55;
          s.w.multiplyScalar(0.5).add(this._v.set((R2() - 0.5) * 20, (R2() - 0.5) * 30, (R2() - 0.5) * 20));
          if (s.bounced++ < 2 && onShellBounce) onShellBounce(s, s.bounced);
        } else {
          s.rest = true;
          const ax = X_AXIS.clone().applyQuaternion(s.quat);
          ax.y = 0;
          if (ax.lengthSq() < 1e-6) ax.set(1, 0, 0);
          s.quat.setFromUnitVectors(X_AXIS, ax.normalize()).multiply(this._q.setFromAxisAngle(X_AXIS, R2() * 6.28));
        }
      }
    }
    const counts = /* @__PURE__ */ new Map();
    for (const s of this.shells) {
      if (!s.alive) continue;
      const m = this.inst.get(s.key), i = counts.get(s.key) || 0;
      m.setMatrixAt(i, this._m.compose(s.pos, s.quat, this._s));
      counts.set(s.key, i + 1);
    }
    for (const [k, m] of this.inst) {
      const n = counts.get(k) || 0;
      if (n || m.count) m.instanceMatrix.needsUpdate = true;
      m.count = n;
    }
    this.smoke.update(dt, cam, this.wind);
    this.fire.update(dt, cam, this.noWind);
  }
};

