import * as THREE2 from "three";
function rng2(seed) {
  let s = seed >>> 0;
  return () => (s = s * 1664525 + 1013904223 >>> 0) / 4294967296;
}
function valueNoise(size, cells, seed) {
  const r = rng2(seed);
  const grid = new Float32Array((cells + 1) * (cells + 1));
  for (let i = 0; i < grid.length; i++) grid[i] = r();
  for (let i = 0; i <= cells; i++) {
    grid[i * (cells + 1) + cells] = grid[i * (cells + 1)];
    grid[cells * (cells + 1) + i] = grid[i];
  }
  const out = new Float32Array(size * size);
  const sm = (t) => t * t * (3 - 2 * t);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const gx = x / size * cells, gy = y / size * cells;
    const x0 = Math.floor(gx), y0 = Math.floor(gy), fx = sm(gx - x0), fy = sm(gy - y0);
    const g = (i, j) => grid[j * (cells + 1) + i];
    const a = g(x0, y0) + (g(x0 + 1, y0) - g(x0, y0)) * fx;
    const b = g(x0, y0 + 1) + (g(x0 + 1, y0 + 1) - g(x0, y0 + 1)) * fx;
    out[y * size + x] = a + (b - a) * fy;
  }
  return out;
}
function fbm(size, octaves, seed, base = 4) {
  const out = new Float32Array(size * size);
  let amp = 1, tot = 0;
  for (let o = 0; o < octaves; o++) {
    const n = valueNoise(size, base << o, seed + o * 17);
    for (let i = 0; i < out.length; i++) out[i] += n[i] * amp;
    tot += amp;
    amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= tot;
  return out;
}
function toTex(size, fill, srgb) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const [r, g, b] = fill(i);
    img.data[i * 4] = r;
    img.data[i * 4 + 1] = g;
    img.data[i * 4 + 2] = b;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE2.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE2.RepeatWrapping;
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE2.SRGBColorSpace;
  return t;
}
function normalFrom(h, size, strength) {
  return toTex(size, (i) => {
    const x = i % size, y = i / size | 0;
    const hx = h[y * size + (x + 1) % size] - h[y * size + (x - 1 + size) % size];
    const hy = h[(y + 1) % size * size + x] - h[(y - 1 + size) % size * size + x];
    let nx = -hx * strength, ny = -hy * strength, nz = 1;
    const l = Math.hypot(nx, ny, nz);
    return [(nx / l * 0.5 + 0.5) * 255, (ny / l * 0.5 + 0.5) * 255, (nz / l * 0.5 + 0.5) * 255];
  });
}
function roughFrom(h, size, lo, hi) {
  return toTex(size, (i) => {
    const v = (lo + (hi - lo) * h[i]) * 255;
    return [v, v, v];
  });
}
function makeTextures() {
  const S = 256;
  const coarse = fbm(S, 5, 11, 4);
  const fine = fbm(S, 3, 77, 32);
  const stipple = fbm(S, 2, 123, 64);
  const brushed = new Float32Array(S * S);
  const br = fbm(S, 4, 5, 8);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) brushed[y * S + x] = br[y * S + x * 7 % S] * 0.3 + br[y * 3 % S * S + x] * 0.7;
  const mix = new Float32Array(S * S);
  for (let i = 0; i < mix.length; i++) mix[i] = coarse[i] * 0.55 + fine[i] * 0.45;
  const streak = (() => {
    const n = fbm(S, 4, 555, 16), out = new Float32Array(S * S), R4 = 18;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      let a = 0;
      for (let d = -R4; d <= R4; d++) a += n[y * S + (x + d + S) % S];
      out[y * S + x] = a / (2 * R4 + 1);
    }
    return out;
  })();
  const woodVal = (i) => {
    const y = (i / S | 0) / S;
    const ply = 0.5 + 0.5 * Math.sin((y + coarse[i] * 0.06) * Math.PI * 2 * 28);
    return (streak[i] - 0.5) * 1.6 + (ply - 0.5) * 0.12 + (coarse[i] - 0.5) * 0.25;
  };
  const wood = (hue) => toTex(S, (i) => {
    const k = 0.9 + woodVal(i) * 0.5;
    return [hue[0] * k, hue[1] * k, hue[2] * k];
  }, true);
  const woodH = new Float32Array(S * S);
  for (let i = 0; i < S * S; i++) woodH[i] = woodVal(i) * 0.5 + 0.5;
  return {
    rough: roughFrom(mix, S, 0.72, 1),
    roughStrong: roughFrom(coarse, S, 0.55, 1),
    roughBrushed: roughFrom(brushed, S, 0.7, 1),
    nMetal: normalFrom(fine, S, 1.4),
    nCast: normalFrom(mix, S, 3.2),
    nPoly: normalFrom(stipple, S, 5.5),
    nWood: normalFrom(woodH, S, 1.6),
    woodBirch: wood([100, 42, 24]),
    woodWalnut: wood([92, 58, 36])
  };
}
var WEAR_GLSL = `
varying vec3 vObjP;
uniform float uWear, uWearMetal, uWearRough, uGrime;
uniform vec3 uWearCol;
float wH(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float wN(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(wH(i), wH(i + vec3(1, 0, 0)), f.x), mix(wH(i + vec3(0, 1, 0)), wH(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(wH(i + vec3(0, 0, 1)), wH(i + vec3(1, 0, 1)), f.x), mix(wH(i + vec3(0, 1, 1)), wH(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}`;
function addWear(mat, o) {
  const U = {
    uWear: { value: o.wear ?? 0.6 },
    uWearMetal: { value: o.metal ?? mat.metalness },
    uWearRough: { value: o.rough ?? 0.35 },
    uGrime: { value: o.grime ?? 1 },
    uWearCol: { value: new THREE2.Color(o.col ?? 9409174) }
  };
  mat.userData.wear = U;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vObjP;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvObjP = position;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\n" + WEAR_GLSL).replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
      {
        vec3 nn = normalize(vNormal);
        float px = max(length(fwidth(vViewPosition)), 1e-6);
        float curv = length(fwidth(nn)) / px;               // 1/м
        float brk = wN(vObjP * 0.45) * 0.65 + wN(vObjP * 2.1) * 0.35;
        float edge = smoothstep(170.0, 750.0, curv) * smoothstep(0.3, 0.6, brk);
        float m = clamp(edge * uWear, 0.0, 1.0);
        diffuseColor.rgb = mix(diffuseColor.rgb, uWearCol, m);
        metalnessFactor = mix(metalnessFactor, uWearMetal, m);
        roughnessFactor = mix(roughnessFactor, uWearRough, m);
        float g1 = wN(vObjP * 0.018 + 3.1), g2 = wN(vObjP * 0.06 + 11.7);
        roughnessFactor = clamp(roughnessFactor * mix(1.0, 0.8 + 0.4 * g1, uGrime), 0.04, 1.0);
        diffuseColor.rgb *= mix(1.0, 0.93 + 0.14 * g2, uGrime);
      }`);
  };
  mat.customProgramCacheKey = () => "wear";
  return mat;
}
function createMaterials(envMap) {
  const tex2 = makeTextures();
  const rep = (t, mm) => {
    const c = t.clone();
    c.needsUpdate = true;
    c.repeat.set(1 / mm, 1 / mm);
    return c;
  };
  const R4 = {};
  const std = (o) => new THREE2.MeshStandardMaterial(o);
  const phys = (o) => new THREE2.MeshPhysicalMaterial(o);
  const metal = (color, rough, metal2, o = {}) => std({
    color,
    roughness: rough,
    metalness: metal2,
    roughnessMap: rep(o.brushed ? tex2.roughBrushed : tex2.rough, o.tile ?? 40),
    normalMap: rep(o.cast ? tex2.nCast : tex2.nMetal, o.tile ?? 30),
    normalScale: new THREE2.Vector2((o.ns ?? 0.35) * 0.45, (o.ns ?? 0.35) * 0.45),
    envMapIntensity: o.env ?? 1
  });
  const poly = (color, rough, o = {}) => std({
    color,
    roughness: rough,
    metalness: 0,
    roughnessMap: rep(tex2.rough, 50),
    normalMap: rep(tex2.nPoly, o.tile ?? 14),
    normalScale: new THREE2.Vector2((o.ns ?? 0.45) * 0.55, (o.ns ?? 0.45) * 0.55),
    envMapIntensity: o.env ?? 0.8
  });
  R4.steel = metal(2829358, 0.38, 0.82, { ns: 0.18, tile: 18 });
  R4.steelPark = metal(3487030, 0.62, 0.55, { cast: true, ns: 0.5 });
  R4.steelWorn = metal(5592666, 0.36, 0.9, { brushed: true });
  R4.steelBright = metal(10987949, 0.26, 1, { brushed: true });
  R4.chrome = metal(13224910, 0.14, 1);
  R4.alu = metal(2039842, 0.44, 0.6, { ns: 0.14, tile: 16 });
  R4.aluGrey = metal(3882304, 0.44, 0.6, { ns: 0.25 });
  R4.aluFde = metal(7693130, 0.58, 0.25, { cast: true, ns: 0.35, env: 0.8 });
  R4.aluOd = metal(4999992, 0.6, 0.25, { cast: true });
  R4.cast = metal(2500393, 0.66, 0.55, { cast: true, ns: 0.7 });
  R4.brass = metal(13148240, 0.3, 1);
  R4.copper = metal(11889982, 0.32, 1);
  R4.steelCase = metal(6249532, 0.45, 0.6);
  R4.spring = metal(4868942, 0.35, 0.9);
  R4.poly = poly(1776412, 0.74);
  R4.polySoft = poly(2105377, 0.86, { ns: 0.7 });
  R4.polyFde = poly(8350800, 0.78);
  R4.polyFdeDark = poly(6049338, 0.8);
  // текстура рукояти (Glock RTF / HK): мелкая «наждачка», заметнее обычного полимера
  R4.polyGrip = poly(1250067, 0.84, { ns: 1.15, tile: 5, env: 0.6 });
  // пластиковая гильза 12 калибра и зелёная «Бреннеке»
  R4.hullRed = poly(0xa3201c, 0.5, { ns: 0.2, env: 1 });
  R4.hullGreen = poly(0x2f5a32, 0.5, { ns: 0.2, env: 1 });
  R4.lead = metal(0x6b6f74, 0.55, 0.4);
  // оксидированная сталь HK/Glock: чуть глубже и матовее «steel»
  R4.steelMatte = metal(0x232426, 0.55, 0.65, { ns: 0.45 });
  R4.polyPlum = poly(4991522, 0.58, { ns: 0.3 });
  R4.polyOd = poly(4868662, 0.78);
  R4.polyGrey = poly(3948097, 0.7);
  R4.polyTan = poly(11573876, 0.78);
  R4.rubber = poly(1315860, 0.92, { ns: 0.9, tile: 14 });
  R4.bakelite = std({ color: 4856846, roughness: 0.4, metalness: 0, normalMap: rep(tex2.nCast, 60), normalScale: new THREE2.Vector2(0.2, 0.2), roughnessMap: rep(tex2.rough, 60) });
  R4.wood = phys({
    color: 16777215,
    map: rep(tex2.woodBirch, 160),
    roughness: 0.52,
    metalness: 0,
    normalMap: rep(tex2.nWood, 160),
    normalScale: new THREE2.Vector2(0.15, 0.15),
    clearcoat: 0.3,
    clearcoatRoughness: 0.35
  });
  R4.woodDark = phys({
    color: 16777215,
    map: rep(tex2.woodWalnut, 160),
    roughness: 0.5,
    metalness: 0,
    normalMap: rep(tex2.nWood, 160),
    normalScale: new THREE2.Vector2(0.25, 0.25),
    clearcoat: 0.3,
    clearcoatRoughness: 0.45
  });
  const glass = (color, op) => phys({
    color,
    roughness: 0.04,
    metalness: 0.1,
    transparent: true,
    opacity: op,
    depthWrite: false,
    envMapIntensity: 2.2,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    side: THREE2.DoubleSide
  });
  R4.glass = glass(12113124, 0.08);
  R4.glassAmber = glass(14725232, 0.1);
  R4.glassRed = glass(15245456, 0.09);
  R4.glassBlue = glass(9087208, 0.1);
  R4.glassDark = glass(2241348, 0.55);
  R4.lensBlack = std({ color: 329223, roughness: 0.25, metalness: 0.2 });
  R4.emRed = std({ color: 2228224, emissive: 16722458, emissiveIntensity: 3, roughness: 0.4 });
  R4.emGreen = std({ color: 8704, emissive: 7208794, emissiveIntensity: 2.5, roughness: 0.4 });
  R4.tritium = std({ color: 1714704, emissive: 9240426, emissiveIntensity: 1.2, roughness: 0.4 });
  R4.lampLens = std({ color: 14542574, emissive: 16774108, emissiveIntensity: 0, roughness: 0.08, metalness: 0.2 });
  R4.laserLens = std({ color: 3346448, emissive: 16719888, emissiveIntensity: 0, roughness: 0.1 });
  R4.irLens = std({ color: 1381653, roughness: 0.05, metalness: 0.4 });
  R4.ledPhos = std({ color: 13615226, emissive: 16774108, emissiveIntensity: 0, roughness: 0.45 });
  R4.reflector = std({ color: 15132908, roughness: 0.22, metalness: 1, emissive: 16774108, emissiveIntensity: 0, side: THREE2.DoubleSide, envMapIntensity: 2.4 });
  R4.white = std({ color: 15263456, roughness: 0.5 });
  R4.paintRed = std({ color: 11805724, roughness: 0.5 });
  R4.paintWhite = std({ color: 14605266, roughness: 0.55 });
  R4.paper = std({ color: 15328211, roughness: 0.95 });
  R4.target = std({ color: 13617334, roughness: 0.6, metalness: 0.2 });
  const W = {
    steel: { col: 9343896, metal: 1, rough: 0.3, wear: 0.75 },
    steelPark: { col: 7106161, metal: 0.9, rough: 0.38, wear: 0.55 },
    steelWorn: { col: 11120050, metal: 1, rough: 0.28, wear: 0.5 },
    steelMatte: { col: 7895160, metal: 0.95, rough: 0.34, wear: 0.5 },
    alu: { col: 9146004, metal: 1, rough: 0.3, wear: 0.4 },
    aluGrey: { col: 10132898, metal: 1, rough: 0.3, wear: 0.4 },
    aluFde: { col: 9407622, metal: 0.95, rough: 0.35, wear: 0.45 },
    aluOd: { col: 9407622, metal: 0.95, rough: 0.35, wear: 0.45 },
    cast: { col: 8224642, metal: 0.95, rough: 0.35, wear: 0.35 },
    poly: { col: 3815996, metal: 0, rough: 0.5, wear: 0.55 },
    polySoft: { col: 3815996, metal: 0, rough: 0.6, wear: 0.35 },
    polyGrip: { col: 3815996, metal: 0, rough: 0.55, wear: 0.4 },
    polyFde: { col: 11047538, metal: 0, rough: 0.55, wear: 0.5 },
    polyFdeDark: { col: 8153938, metal: 0, rough: 0.55, wear: 0.5 },
    polyTan: { col: 11969151, metal: 0, rough: 0.55, wear: 0.5 },
    polyOd: { col: 6974034, metal: 0, rough: 0.55, wear: 0.5 },
    polyGrey: { col: 6448232, metal: 0, rough: 0.55, wear: 0.5 },
    polyPlum: { col: 7224368, metal: 0, rough: 0.4, wear: 0.45 },
    bakelite: { col: 9062954, metal: 0, rough: 0.35, wear: 0.4 },
    rubber: { col: 3026479, metal: 0, rough: 0.7, wear: 0.2, grime: 0.6 }
  };
  for (const [k, o] of Object.entries(W)) if (R4[k]) addWear(R4[k], o);
  const cache2 = /* @__PURE__ */ new Map();
  return {
    tex: tex2,
    all: R4,
    get(key) {
      if (typeof key !== "string") return key;
      if (R4[key]) return R4[key];
      if (cache2.has(key)) return cache2.get(key);
      const [base, col] = key.split("#");
      if (R4[base] && col) {
        const m = R4[base].clone();
        m.color = new THREE2.Color("#" + col);
        if (W[base]) addWear(m, W[base]);
        cache2.set(key, m);
        return m;
      }
      console.warn("нет материала", key);
      return R4.poly;
    }
  };
}

