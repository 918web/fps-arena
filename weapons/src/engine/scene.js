import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
// Защита HDR-буфера (half float, предел 65504). Острый GGX-блик от точечного света вспышки на стекле
// или латуни даёт Inf, вырожденная нормаль — NaN; UnrealBloom разносит такой пиксель по мип-цепочке
// в чёрный прямоугольник на пол-экрана. Ограничение 16384 после ACES неотличимо от белого.
var HDR_SAFE = (v, mx = "16384.0") => `${v} = clamp(${v}, 0.0, ${mx}); if (any(isnan(${v}))) ${v} = vec3(0.0);`;
// вариант для RawShaderMaterial на GLSL ES 1.0 (нет isnan): NaN не равен сам себе
var HDR_SAFE1 = (v) => `${v} = clamp(${v}, 0.0, 16384.0); if (!(${v}.r == ${v}.r && ${v}.g == ${v}.g && ${v}.b == ${v}.b)) ${v} = vec3(0.0);`;
THREE.ShaderChunk.opaque_fragment = THREE.ShaderChunk.opaque_fragment.replace("gl_FragColor = vec4( outgoingLight", HDR_SAFE("outgoingLight") + "\ngl_FragColor = vec4( outgoingLight");
function hdrGuardPass(mat, line) {
  if (!mat.fragmentShader.includes(line)) return;
  // вход bloom ограничен сильнее: одиночный пересвеченный пиксель иначе размывается в квадрат свечения
  mat.fragmentShader = mat.fragmentShader.replace(line, line + "\n" + HDR_SAFE("texel.rgb", "64.0"));
  mat.needsUpdate = true;
}
var GUN_Y = 1.42;
var RANGE = { back: -4.2, end: 102, halfW: 6, ceil: 3.6, line: 0.62 };
var LUX = 1 / 200;
function rng(seed) {
  let s = seed >>> 0;
  return () => (s = s * 1664525 + 1013904223 >>> 0) / 4294967296;
}
function canvasTex(w, h, draw2, srgb = true) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw2(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function blotches(g, w, h, n, r0, r1, col, a0, a1, R4) {
  for (let i = 0; i < n; i++) {
    const x = R4() * w, y = R4() * h, r = r0 + R4() * (r1 - r0);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    const a = a0 + R4() * (a1 - a0);
    gr.addColorStop(0, `rgba(${col},${a})`);
    gr.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = gr;
    for (const [dx, dy] of [[0, 0], [w, 0], [-w, 0], [0, h], [0, -h]]) g.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
  }
}
function speckle(g, w, h, n, lo, hi, a, R4, s0 = 0.5, s1 = 2) {
  for (let i = 0; i < n; i++) {
    const v = lo + R4() * (hi - lo);
    g.fillStyle = `rgba(${v},${v},${v},${R4() * a})`;
    const s = s0 + R4() * (s1 - s0);
    g.fillRect(R4() * w, R4() * h, s, s);
  }
}
function floorTex() {
  const R4 = rng(7);
  const map = canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = "#77756f";
    g.fillRect(0, 0, w, h);
    blotches(g, w, h, 90, 40, 220, "96,94,88", 0.05, 0.22, R4);
    blotches(g, w, h, 70, 30, 160, "140,137,128", 0.04, 0.16, R4);
    blotches(g, w, h, 18, 10, 60, "45,42,38", 0.08, 0.25, R4);
    speckle(g, w, h, 6e4, 70, 160, 0.35, R4);
    g.strokeStyle = "rgba(150,148,140,0.05)";
    for (let i = 0; i < 160; i++) {
      g.lineWidth = 6 + R4() * 20;
      g.beginPath();
      g.arc(R4() * w, R4() * h, 80 + R4() * 200, R4() * 6, R4() * 6 + 1.5);
      g.stroke();
    }
    g.fillStyle = "rgba(30,30,30,.85)";
    g.fillRect(0, 0, w, 3);
    g.fillRect(0, 0, 3, h);
  });
  const rough = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = "#9a9a9a";
    g.fillRect(0, 0, w, h);
    blotches(g, w, h, 80, 20, 120, "60,60,60", 0.1, 0.35, R4);
    blotches(g, w, h, 40, 20, 90, "220,220,220", 0.1, 0.3, R4);
    speckle(g, w, h, 12e3, 120, 255, 0.5, R4);
  }, false);
  return { map, rough };
}
function blockTex() {
  const R4 = rng(21);
  return canvasTex(1024, 512, (g, w, h) => {
    g.fillStyle = "#a9a7a0";
    g.fillRect(0, 0, w, h);
    const bw = w / 4, bh = h / 4;
    for (let r = 0; r < 4; r++) for (let c = -1; c < 5; c++) {
      const x = c * bw + r % 2 * bw / 2, y = r * bh;
      const v = 178 + R4() * 18;
      g.fillStyle = `rgb(${v},${v - 2},${v - 8})`;
      g.fillRect(x + 4, y + 4, bw - 8, bh - 8);
    }
    speckle(g, w, h, 4e4, 120, 210, 0.3, R4, 0.5, 2.5);
    blotches(g, w, h, 30, 20, 140, "120,116,105", 0.04, 0.14, R4);
  });
}
function acousticTex() {
  const R4 = rng(33);
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = "#34363a";
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, 3e4, 30, 90, 0.5, R4, 0.6, 1.6);
    g.fillStyle = "rgba(0,0,0,.5)";
    for (let y = 8; y < h; y += 12) for (let x = 8 + y / 12 % 2 * 6; x < w; x += 12) {
      g.beginPath();
      g.arc(x, y, 2.2, 0, 7);
      g.fill();
    }
    g.fillStyle = "rgba(15,15,16,.9)";
    g.fillRect(0, 0, w, 5);
    g.fillRect(0, 0, 5, h);
    blotches(g, w, h, 12, 20, 90, "90,86,78", 0.03, 0.08, R4);
  });
}
function woodTex(seed = 55) {
  const R4 = rng(seed);
  return canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = "#8b7355";
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) {
      const v = (R4() - 0.5) * 30;
      g.fillStyle = `rgba(${90 + v},${70 + v},${48 + v},.35)`;
      g.fillRect(0, y, w, 1 + R4() * 2);
    }
    speckle(g, w, h, 5e3, 50, 120, 0.25, R4);
    blotches(g, w, h, 20, 10, 60, "40,30,20", 0.1, 0.3, R4);
  });
}
function boothTex() {
  const R4 = rng(91);
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = "#8f9290";
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, 5e4, 100, 170, 0.35, R4, 0.5, 1.5);
    for (let y = 0; y < h; y += 3) {
      g.fillStyle = `rgba(0,0,0,${0.03 + R4() * 0.03})`;
      g.fillRect(0, y, w, 1);
    }
    blotches(g, w, h, 25, 20, 90, "70,70,68", 0.05, 0.15, R4);
    g.fillStyle = "#3b3d3f";
    g.fillRect(0, 0, w, 14);
    g.fillRect(0, h - 14, w, 14);
    g.fillRect(0, 0, 14, h);
    g.fillRect(w - 14, 0, 14, h);
    g.fillStyle = "#1e1f20";
    for (const [x, y] of [[7, 7], [w - 7, 7], [7, h - 7], [w - 7, h - 7], [w / 2, 7], [w / 2, h - 7]]) {
      g.beginPath();
      g.arc(x, y, 3.5, 0, 7);
      g.fill();
    }
  });
}
function signTex(text, o = {}) {
  return canvasTex(o.w || 512, o.h || 192, (g, w, h) => {
    g.fillStyle = o.bg || "#e8e3d4";
    g.fillRect(0, 0, w, h);
    g.fillStyle = o.fg || "#1e1e1e";
    g.font = `bold ${o.size || 96}px Arial`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, w / 2, h / 2 + 4);
  });
}
function envScene(night) {
  const s = new THREE.Scene();
  const dim = night ? 4e-3 : 1;
  const room = new THREE.Mesh(new THREE.BoxGeometry(40, RANGE.ceil, RANGE.halfW * 2), new THREE.MeshBasicMaterial({ color: 7170918, side: THREE.BackSide }));
  room.material.color.multiplyScalar(dim);
  room.position.set(14, RANGE.ceil / 2 - GUN_Y, 0);
  s.add(room);
  const plane = (w, d, color, k, x, y, z, rx = Math.PI / 2) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    m.material.color.multiplyScalar(k);
    m.rotation.x = rx;
    m.position.set(x, y, z);
    s.add(m);
    return m;
  };
  plane(40, RANGE.halfW * 2, 5592143, dim, 14, -GUN_Y + 0.01, 0);
  plane(40, RANGE.halfW * 2, 2500394, dim, 14, RANGE.ceil - GUN_Y - 0.01, 0);
  if (!night) {
    for (const x of [4, 8, 12, 16, 20, 24]) plane(0.25, 9, 16774114, 9, x, RANGE.ceil - GUN_Y - 0.05, 0);
    for (const x of [-2.6, -0.9]) for (const z of [-2.4, 0, 2.4]) plane(1.2, 0.6, 16774114, 8, x, RANGE.ceil - GUN_Y - 0.06, z);
    for (let x = 3; x < 30; x += 4) plane(1.5, 9, 14674679, 5, x + 1.65, RANGE.ceil - GUN_Y + 0.3, 0);
  } else {
    plane(0.5, 0.2, 4259712, 2.5, RANGE.back + 0.05, 2.3 - GUN_Y, -3, 0).rotation.y = Math.PI / 2;
  }
  return s;
}
function createScene(canvasHost) {
  // Сглаживание — MSAA в HDR-буфере композитора; MSAA самого холста только тратило память и
  // пропускную способность на каждом кадре (в него пишет лишь финальный полноэкранный проход).
  const renderer = new THREE.WebGLRenderer({ antialias: false, stencil: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = true;
  canvasHost.appendChild(renderer.domElement);
  RectAreaLightUniformsLib.init();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envDay = pmrem.fromScene(envScene(false), 0.035).texture;
  const envNight = pmrem.fromScene(envScene(true), 0.035).texture;
  scene.environment = envDay;
  scene.environmentIntensity = 1.05;
  scene.fog = new THREE.FogExp2(7828847, 45e-4);
  const hemi = new THREE.HemisphereLight(16774374, 6117970, 0.5);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(16773856, 2.1);
  sun.position.set(-0.7, RANGE.ceil - 0.15, 0.7);
  sun.target.position.set(0, GUN_Y, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -1.1;
  sc.right = 1.1;
  sc.top = 1.1;
  sc.bottom = -1.1;
  sc.near = 0.2;
  sc.far = 6;
  sun.shadow.bias = -4e-4;
  sun.shadow.normalBias = 0.012;
  scene.add(sun, sun.target);
  const area = new THREE.RectAreaLight(16774114, 5.5, 1.2, 0.6);
  area.position.set(-0.9, RANGE.ceil - 0.08, 0);
  area.lookAt(-0.9, 0, 0);
  scene.add(area);
  const down = new THREE.DirectionalLight(16773340, 1.3);
  down.position.set(-10, 20, 3);
  down.target.position.set(40, 0, 0);
  scene.add(down, down.target);
  const fill = new THREE.DirectionalLight(16774374, 0.7);
  fill.position.set(0.5, 0.6, 3);
  fill.target.position.set(0, GUN_Y, 0);
  scene.add(fill, fill.target);
  const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 8e-3, 400);
  camera.position.set(-0.25, GUN_Y + 0.25, 1.35);
  const range = buildRange(scene);
  const rangeUpdate = range.update;
  const sunDir = new THREE.Vector3(0.22, -1, -0.62).normalize();
  const sky = new THREE.DirectionalLight(16773336, 7);
  sky.position.set(49, 0, 0).addScaledVector(sunDir, -30);
  sky.target.position.set(49, 0, 0);
  sky.castShadow = true;
  sky.shadow.mapSize.set(4096, 4096);
  Object.assign(sky.shadow.camera, { left: -76, right: 76, top: 76, bottom: -76, near: 1, far: 70 });
  sky.shadow.bias = -6e-4;
  sky.shadow.normalBias = 0.03;
  scene.add(sky, sky.target);
  const shaftU = { uCol: { value: new THREE.Color(16773336).multiplyScalar(0.05) }, uTime: { value: 0 } };
  const shaftM = new THREE.ShaderMaterial({
    uniforms: shaftU,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: "varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }",
    fragmentShader: `uniform vec3 uCol; uniform float uTime; varying vec3 vW;
      float h3(vec3 p){ p = fract(p*0.3183099+0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
      float n3(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.-2.*f);
        return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z); }
      void main(){
        float h = clamp(vW.y / ${RANGE.ceil.toFixed(1)}, 0., 1.);
        float d = 0.55 + 0.9 * n3(vW * 1.7 + vec3(0., uTime * 0.03, 0.));
        vec3 c = uCol * d * (0.35 + 0.65 * h);
        ${HDR_SAFE("c")}
        gl_FragColor = vec4(c, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  {
    const G2 = [];
    const t = RANGE.ceil / -sunDir.y;
    for (const [x0, x1, z0, z1] of range.skylights) {
      const top = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([x, z]) => new THREE.Vector3(x, RANGE.ceil, z));
      const bot = top.map((v) => v.clone().addScaledVector(sunDir, t));
      const pos = [];
      for (let i = 0; i < 4; i++) {
        const a = top[i], b = top[(i + 1) % 4], c = bot[(i + 1) % 4], d = bot[i];
        pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      G2.push(g);
    }
    const shafts = new THREE.Mesh(mergeGeometries(G2), shaftM);
    shafts.renderOrder = 1;
    shafts.userData.noAO = true;
    shafts.frustumCulled = false;
    scene.add(shafts);
  }
  const DAY = { hemi: 0.5, sun: 2.1, area: 5.5, down: 0.9, fill: 0.7, env: 1.05, fog: 7828847, sky: 7, shaft: 0.04 };
  const NIGHT = { hemi: 5e-3, sun: 0, area: 0, down: 0, fill: 15e-4, env: 1, fog: 263173, sky: 0.03, shaft: 2e-3 };
  let night = false;
  const setNight = (on) => {
    night = !!on;
    const P = night ? NIGHT : DAY;
    hemi.intensity = P.hemi;
    sun.intensity = P.sun;
    area.intensity = P.area;
    down.intensity = P.down;
    fill.intensity = P.fill;
    hemi.color.set(night ? 9413320 : 16774374);
    fill.color.set(night ? 10466520 : 16774374);
    scene.environment = night ? envNight : envDay;
    scene.environmentIntensity = P.env;
    scene.fog.color.set(P.fog);
    sky.intensity = P.sky;
    sky.color.set(night ? 10335456 : 16773336);
    shaftU.uCol.value.copy(sky.color).multiplyScalar(P.shaft);
    range.setNight(night);
  };
  const ambient = () => night ? 4e-3 : 2.6;
  const rt = new THREE.WebGLRenderTarget(innerWidth * renderer.getPixelRatio(), innerHeight * renderer.getPixelRatio(), { type: THREE.HalfFloatType, stencilBuffer: true, depthBuffer: true, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, innerWidth, innerHeight);
  gtao.overrideVisibility = function() {
    const cache2 = this._visibilityCache;
    this.scene.traverse((o) => {
      cache2.set(o, o.visible);
      const m = o.material;
      if (o.isPoints || o.isLine || o.isSprite || o.userData.noAO || o.userData.reticle || m && (m.transparent || m.isShaderMaterial)) o.visible = false;
    });
  };
  gtao.updateGtaoMaterial({ radius: 0.07, distanceExponent: 1.4, thickness: 1.2, scale: 1.1, samples: 16, distanceFallOff: 1, screenSpaceRadius: false });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
  gtao.blendIntensity = 0.85;
  composer.addPass(gtao);
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.25, 0.45, 1.2);
  composer.addPass(bloom);
  hdrGuardPass(bloom.materialHighPassFilter, "vec4 texel = texture2D( tDiffuse, vUv );");
  const outPass = new OutputPass();
  // Пост-обработка без промежуточных полноэкранных проходов. Раньше GTAO копировал кадр во второй
  // буфер и домножал его на AO, bloom дорисовывал свечение поверх — три лишних чтения/записи кадра
  // в HDR, да ещё в MSAA-буфер 4× (буферы композитора менялись ролями каждый кадр). Теперь AO и
  // свечение применяются в самом OutputPass (AO — ещё и на входе bloom) по той же формуле и с той же
  // выборкой текстур: картинка та же, а в полном разрешении остаётся один проход. Второй буфер
  // композитора больше не используется и на GPU не выделяется.
  const aoTex = gtao.pdRenderTarget.texture, bloomTex = bloom.renderTargetsHorizontal[0].texture;
  gtao.output = GTAOPass.OUTPUT.Off;
  gtao.needsSwap = false;
  const hp = bloom.materialHighPassFilter;
  Object.assign(hp.uniforms, { tAO: { value: aoTex }, uAOk: { value: 0 } });
  hp.fragmentShader = hp.fragmentShader.replace("uniform sampler2D tDiffuse;", "uniform sampler2D tDiffuse;\nuniform sampler2D tAO;\nuniform float uAOk;").replace("vec4 texel = texture2D( tDiffuse, vUv );", "vec4 texel = texture2D( tDiffuse, vUv );\ntexel.rgb *= mix( vec3( 1.0 ), texture2D( tAO, vUv ).rgb, uAOk );");
  const bloomQuadRender = bloom.fsQuad.render.bind(bloom.fsQuad);
  bloom.fsQuad.render = (r) => {
    if (bloom.fsQuad.material !== bloom.blendMaterial) bloomQuadRender(r);
  };
  Object.assign(outPass.material.uniforms, { tAO: { value: aoTex }, uAOk: { value: 0 }, tBloom: { value: bloomTex }, uBloomK: { value: 0 } });
  // свечение раньше накладывалось смешиванием AdditiveBlending (SRC_ALPHA, ONE) — отсюда множитель .a
  outPass.material.fragmentShader = outPass.material.fragmentShader.replace("uniform sampler2D tDiffuse;", "uniform sampler2D tDiffuse;\nuniform sampler2D tAO, tBloom;\nuniform float uAOk, uBloomK;").replace("gl_FragColor = texture2D( tDiffuse, vUv );", "vec4 texel = texture2D( tDiffuse, vUv );\ntexel.rgb *= mix( vec3( 1.0 ), texture2D( tAO, vUv ).rgb, uAOk );\nvec4 bl = texture2D( tBloom, vUv );\ntexel.rgb += bl.rgb * bl.a * uBloomK;\n" + HDR_SAFE1("texel.rgb") + "\ngl_FragColor = texel;");
  outPass.needsSwap = false;
  composer.addPass(outPass);
  // сцена рисуется в readBuffer (у EffectComposer это renderTarget2); MSAA нужен только ему
  composer.writeBuffer.samples = 0;
  const post = { composer, gtao, bloom };
  // Уровни качества. «Высокое» — исходная картинка: AO в полном разрешении, 16 сэмплов, MSAA 4×,
  // тени 4096/2048. Ниже — те же эффекты дешевле: AO в половинном разрешении с меньшим числом
  // сэмплов, реже MSAA, меньше карты теней и пиксельная плотность. Ничего не выключается целиком.
  const QUALITY = [
    { id: "low", label: "Низкое", dpr: 1, ao: 0.5, aoS: 8, pdS: 6, msaa: 2, sky: 2048, sun: 1024, spot: 1024, steps: 20, motes: 350, bloom: 0.5 },
    { id: "mid", label: "Среднее", dpr: 1.5, ao: 0.5, aoS: 12, pdS: 8, msaa: 4, sky: 4096, sun: 2048, spot: 1024, steps: 28, motes: 600 },
    { id: "high", label: "Высокое", dpr: 2, ao: 1, aoS: 16, pdS: 16, msaa: 4, sky: 4096, sun: 2048, spot: 2048, steps: 40, motes: 900 }
  ];
  let qi = 2;
  // свечение и так размыто: на «низком» его цепочка мипов начинается с четверти разрешения
  const bloomSetSize = bloom.setSize.bind(bloom);
  bloom.setSize = (w, h) => bloomSetSize(Math.max(1, Math.round(w * (QUALITY[qi].bloom ?? 1))), Math.max(1, Math.round(h * (QUALITY[qi].bloom ?? 1))));
  const gtaoSetSize = gtao.setSize.bind(gtao);
  gtao.setSize = (w, h) => gtaoSetSize(Math.max(1, Math.round(w * QUALITY[qi].ao)), Math.max(1, Math.round(h * QUALITY[qi].ao)));
  const shadowSize = (light, n) => {
    if (light.shadow.mapSize.x === n) return;
    light.shadow.mapSize.set(n, n);
    light.shadow.map?.dispose();
    light.shadow.map = null;
    light.shadow.needsUpdate = true;
  };
  // Небесный свет освещает статичный тир: его карта 4096² перерисовывается только по запросу
  // (старт, смена качества, качнувшиеся мишени), а не каждый активный кадр.
  sky.shadow.autoUpdate = false;
  sky.shadow.needsUpdate = true;
  range.update = (dt) => {
    if (rangeUpdate(dt)) sky.shadow.needsUpdate = true;
  };
  const setQuality = (i) => {
    qi = Math.max(0, Math.min(QUALITY.length - 1, i));
    const q = QUALITY[qi];
    gtao.updateGtaoMaterial({ samples: q.aoS });
    gtao.updatePdMaterial({ samples: q.pdS });
    for (const t of [composer.readBuffer]) if (t.samples !== q.msaa) {
      t.samples = q.msaa;
      t.dispose();
    }
    shadowSize(sky, q.sky);
    shadowSize(sun, q.sun);
    resize();
    return q;
  };
  const render = () => {
    shaftU.uTime.value = performance.now() / 1e3;
    const e = renderer.toneMappingExposure;
    bloom.threshold = 1.15 / e;
    bloom.strength = night ? 0.55 : 0.22;
    gtao.blendIntensity = night ? 0.4 : 0.85;
    const aoK = gtao.enabled ? gtao.blendIntensity : 0;
    hp.uniforms.uAOk.value = aoK;
    const ou = outPass.material.uniforms;
    ou.uAOk.value = aoK;
    ou.uBloomK.value = bloom.enabled ? 1 : 0;
    composer.render();
  };
  const resize = () => {
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(innerWidth, innerHeight);
  };
  addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    resize();
  });
  return { renderer, scene, camera, sun, sky, range, env: envDay, setNight, ambient, render, resize, post, QUALITY, setQuality,
    get quality() {
      return QUALITY[qi];
    },
    get night() {
      return night;
    } };
}
function buildRange(scene) {
  const grp = new THREE.Group();
  scene.add(grp);
  const { back, end, halfW, ceil, line } = RANGE;
  const L = end - back, cx = (end + back) / 2;
  const hitables = [];
  const add = (m, surface, hit2 = true) => {
    m.userData.surface = surface;
    grp.add(m);
    if (hit2) hitables.push(m);
    return m;
  };
  const ft = floorTex();
  ft.map.repeat.set(L / 4, halfW * 2 / 4);
  ft.rough.repeat.set(L / 3, halfW * 2 / 3);
  const floorM = new THREE.MeshStandardMaterial({ map: ft.map, roughnessMap: ft.rough, roughness: 0.62, metalness: 0, envMapIntensity: 0.5 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(L, halfW * 2), floorM);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx, 0, 0);
  add(floor, "concrete");
  const paint = (w, d, color, x, z, rough = 0.5) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ color, roughness: rough, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 2e-3, z);
    grp.add(m);
    return m;
  };
  paint(0.1, halfW * 2, 13214247, line, 0);
  paint(0.05, halfW * 2, 11023403, line + 0.9, 0);
  for (const z of [-3.6, -1.2, 1.2, 3.6]) paint(end - line - 2, 0.05, 14210248, (end + line) / 2, z, 0.6);
  for (const d of [5, 10, 15, 25, 50, 75, 100]) {
    const t = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.34), new THREE.MeshStandardMaterial({ map: signTex(d + " м", { bg: "#77756f", fg: "#e4dfd0", size: 120 }), roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 }));
    t.rotation.x = -Math.PI / 2;
    t.rotation.z = Math.PI / 2;
    t.position.set(line + d, 3e-3, halfW - 0.6);
    grp.add(t);
  }
  const bt = blockTex();
  bt.repeat.set(L / 1.6, ceil / 0.8);
  const wallM = new THREE.MeshStandardMaterial({ map: bt, roughness: 0.9, envMapIntensity: 0.4 });
  const at = acousticTex();
  at.repeat.set(12, 2);
  const panelM = new THREE.MeshStandardMaterial({ map: at, roughness: 0.95, envMapIntensity: 0.3 });
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(L, ceil), wallM);
    w.position.set(cx, ceil / 2, s * halfW);
    w.rotation.y = s > 0 ? Math.PI : 0;
    add(w, "concrete");
    const p = new THREE.Mesh(new THREE.BoxGeometry(18, 2.2, 0.06), panelM);
    p.position.set(back + 9.2, 1.5, s * (halfW - 0.03));
    add(p, "panel");
  }
  const at2 = at.clone();
  at2.repeat.set(6, 2);
  at2.needsUpdate = true;
  const bw = new THREE.Mesh(new THREE.PlaneGeometry(halfW * 2, ceil), new THREE.MeshStandardMaterial({ map: at2, roughness: 0.95, envMapIntensity: 0.3 }));
  bw.position.set(back, ceil / 2, 0);
  bw.rotation.y = Math.PI / 2;
  add(bw, "panel", false);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.1, 1), new THREE.MeshStandardMaterial({ color: 5922659, roughness: 0.5, metalness: 0.6 }));
  door.position.set(back + 0.03, 1.05, -3);
  grp.add(door);
  const exitT = signTex("ВЫХОД", { bg: "#0f7a3a", fg: "#e8ffe8", size: 110 });
  const exitM = new THREE.MeshStandardMaterial({ map: exitT, emissiveMap: exitT, emissive: 16777215, emissiveIntensity: 0.9, roughness: 0.4 });
  const exit = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.19), exitM);
  exit.position.set(back + 0.07, 2.3, -3);
  exit.rotation.y = Math.PI / 2;
  grp.add(exit);
  const gapM = new THREE.MeshBasicMaterial({ color: 16769712 });
  const gap = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.012), gapM);
  gap.position.set(back + 0.065, 6e-3, -3);
  gap.rotation.y = Math.PI / 2;
  grp.add(gap);
  const skylights = [];
  for (let x = 3; x < 30; x += 4) skylights.push([x + 0.9, x + 2.4, -4.5, 4.5]);
  const cs = new THREE.Shape();
  cs.moveTo(back, -halfW);
  cs.lineTo(end, -halfW);
  cs.lineTo(end, halfW);
  cs.lineTo(back, halfW);
  cs.closePath();
  for (const [x0, x1, z0, z1] of skylights) {
    const h = new THREE.Path();
    h.moveTo(x0, z0);
    h.lineTo(x0, z1);
    h.lineTo(x1, z1);
    h.lineTo(x1, z0);
    h.closePath();
    cs.holes.push(h);
  }
  const ceilMesh = new THREE.Mesh(new THREE.ShapeGeometry(cs), new THREE.MeshStandardMaterial({ color: 2039842, roughness: 0.95 }));
  ceilMesh.rotation.x = Math.PI / 2;
  ceilMesh.position.y = ceil;
  ceilMesh.castShadow = true;
  add(ceilMesh, "concrete");
  const curbM = new THREE.MeshStandardMaterial({ color: 9277329, roughness: 0.6, metalness: 0.4 });
  const curbG = [], paneG = [];
  for (const [x0, x1, z0, z1] of skylights) {
    const H = 0.45, xm = (x0 + x1) / 2, zm = (z0 + z1) / 2;
    curbG.push(new THREE.BoxGeometry(x1 - x0 + 0.1, H, 0.05).translate(xm, ceil + H / 2, z0 - 0.025));
    curbG.push(new THREE.BoxGeometry(x1 - x0 + 0.1, H, 0.05).translate(xm, ceil + H / 2, z1 + 0.025));
    curbG.push(new THREE.BoxGeometry(0.05, H, z1 - z0).translate(x0 - 0.025, ceil + H / 2, zm));
    curbG.push(new THREE.BoxGeometry(0.05, H, z1 - z0).translate(x1 + 0.025, ceil + H / 2, zm));
    for (let i = 1; i < 6; i++) curbG.push(new THREE.BoxGeometry(x1 - x0, 0.06, 0.05).translate(xm, ceil + H - 0.03, z0 + (z1 - z0) * i / 6));
    curbG.push(new THREE.BoxGeometry(0.05, 0.06, z1 - z0).translate(xm, ceil + H - 0.03, zm));
    paneG.push(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(Math.PI / 2).translate(xm, ceil + H, zm));
  }
  const curbs = new THREE.Mesh(mergeGeometries(curbG), curbM);
  curbs.castShadow = true;
  grp.add(curbs);
  const skyM = new THREE.MeshBasicMaterial({ color: 14674679 });
  skyM.color.multiplyScalar(5);
  grp.add(new THREE.Mesh(mergeGeometries(paneG), skyM));
  const wt = woodTex();
  wt.repeat.set(6, 1);
  const bafG = [], fixtures = [];
  for (let x = 3; x < end - 4; x += x < 30 ? 4 : 8) {
    bafG.push(new THREE.BoxGeometry(0.03, 1, halfW * 2 - 0.1).rotateZ(-0.52).translate(x, ceil - 0.5, 0));
    fixtures.push(x + (x < 30 ? 3.1 : 4));
  }
  const baffles = new THREE.Mesh(mergeGeometries(bafG), new THREE.MeshStandardMaterial({ map: wt, color: 9079434, roughness: 0.85 }));
  baffles.castShadow = true;
  add(baffles, "wood");
  const fixM = new THREE.MeshStandardMaterial({ color: 2236962, emissive: 16774114, emissiveIntensity: 2.2, roughness: 0.4 });
  const housingM = new THREE.MeshStandardMaterial({ color: 10132896, roughness: 0.4, metalness: 0.7 });
  const fixG = [], houseG = [];
  const bar = (x, y, z, w, d) => {
    houseG.push(new THREE.BoxGeometry(w + 0.04, 0.05, d + 0.04).translate(x, y + 0.03, z));
    fixG.push(new THREE.BoxGeometry(w, 0.012, d).translate(x, y, z));
  };
  for (const x of fixtures) bar(x, ceil - 0.06, 0, 0.14, halfW * 2 - 1.5);
  for (const x of [-2.6, -0.9]) for (const z of [-2.4, 0, 2.4]) bar(x, ceil - 0.06, z, 1.2, 0.6);
  grp.add(new THREE.Mesh(mergeGeometries(houseG), housingM));
  grp.add(new THREE.Mesh(mergeGeometries(fixG), fixM));
  const boothM = new THREE.MeshStandardMaterial({ map: boothTex(), roughness: 0.85, metalness: 0.05 });
  for (const z of [-3.6, -1.2, 1.2, 3.6]) {
    for (const s of [-1, 1]) {
      const inner = z === 1.2 && s > 0 || z === -1.2 && s < 0;
      if (Math.abs(z) === 1.2 && !inner) continue;
      const p = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.9), boothM);
      p.position.set(line - 0.85, 1.05, z);
      p.rotation.y = s > 0 ? Math.PI : 0;
      p.userData.noShadow = true;
      grp.add(p);
    }
  }
  const st = woodTex(77);
  st.repeat.set(1, 18);
  st.rotation = Math.PI / 2;
  const shelf = new THREE.Mesh(new THREE.PlaneGeometry(0.45, halfW * 2 - 0.2), new THREE.MeshStandardMaterial({ map: st, roughness: 0.7 }));
  shelf.rotation.x = -Math.PI / 2;
  shelf.position.set(line - 0.25, 0.95, 0);
  add(shelf, "wood");
  const edge = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, halfW * 2 - 0.2), new THREE.MeshStandardMaterial({ color: 2763565, roughness: 0.5, metalness: 0.6 }));
  edge.position.set(line - 0.02, 0.93, 0);
  grp.add(edge);
  const shelfFront = new THREE.Mesh(new THREE.PlaneGeometry(halfW * 2 - 0.2, 0.93), boothM);
  shelfFront.position.set(line, 0.465, 0);
  shelfFront.rotation.y = Math.PI / 2;
  grp.add(shelfFront);
  shelfFront.material = new THREE.MeshStandardMaterial({ color: 4869456, roughness: 0.7, metalness: 0.2 });
  const trapG = [];
  for (let i = 0; i < 7; i++) trapG.push(new THREE.BoxGeometry(0.02, 0.62, halfW * 2).rotateZ(0.55).translate(end - 0.3 - i % 2 * 0.15, 0.3 + i * 0.5, 0));
  add(new THREE.Mesh(mergeGeometries(trapG), new THREE.MeshStandardMaterial({ color: 3815992, roughness: 0.55, metalness: 0.75 })), "trap");
  const trapWall = new THREE.Mesh(new THREE.PlaneGeometry(halfW * 2, ceil), new THREE.MeshStandardMaterial({ color: 1381653, roughness: 0.9 }));
  trapWall.position.set(end, ceil / 2, 0);
  trapWall.rotation.y = -Math.PI / 2;
  add(trapWall, "trap");
  const targets = [];
  const steelM = new THREE.MeshStandardMaterial({ color: 14736591, roughness: 0.55, metalness: 0.3 });
  const postM = new THREE.MeshStandardMaterial({ color: 3816252, roughness: 0.7, metalness: 0.4 });
  const ipsc = new THREE.Shape();
  ipsc.moveTo(-0.15, 0);
  ipsc.lineTo(0.15, 0);
  ipsc.lineTo(0.23, 0.12);
  ipsc.lineTo(0.23, 0.52);
  ipsc.lineTo(0.14, 0.6);
  ipsc.lineTo(0.08, 0.6);
  ipsc.lineTo(0.08, 0.76);
  ipsc.lineTo(-0.08, 0.76);
  ipsc.lineTo(-0.08, 0.6);
  ipsc.lineTo(-0.14, 0.6);
  ipsc.lineTo(-0.23, 0.52);
  ipsc.lineTo(-0.23, 0.12);
  ipsc.closePath();
  const ipscG = new THREE.ExtrudeGeometry(ipsc, { depth: 0.012, bevelEnabled: false });
  ipscG.translate(0, 0, -6e-3);
  ipscG.rotateY(Math.PI / 2);
  const plateG = new THREE.CylinderGeometry(0.15, 0.15, 0.012, 32);
  plateG.rotateZ(Math.PI / 2);
  const addTarget = (x, z, kind, label) => {
    const t = new THREE.Group();
    t.position.set(x, 0, z);
    const hinge = new THREE.Group();
    hinge.position.y = kind === "plate" ? 1.25 : 1.05;
    const plate = new THREE.Mesh(kind === "plate" ? plateG : ipscG, steelM.clone());
    plate.position.y = kind === "plate" ? -0.15 : -0.76;
    plate.castShadow = true;
    plate.userData.surface = "steel";
    plate.userData.target = t;
    hinge.add(plate);
    t.add(hinge);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, hinge.position.y + 0.04, 0.05), postM);
    post.position.set(0.04, (hinge.position.y + 0.04) / 2, 0);
    post.castShadow = true;
    t.add(post);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.5), postM);
    foot.position.y = 0.025;
    t.add(foot);
    if (label) {
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.24), new THREE.MeshStandardMaterial({ roughness: 0.8, map: signTex(label) }));
      sign.position.set(-0.3, 0.3, z > 0 ? -0.4 : 0.4);
      sign.rotation.y = -Math.PI / 2;
      t.add(sign);
    }
    t.userData = { hinge, plate, swing: 0, vel: 0, kind };
    grp.add(t);
    targets.push(t);
    hitables.push(plate);
    return t;
  };
  const paperTex = canvasTex(256, 384, (g) => {
    g.fillStyle = "#b89a6c";
    g.fillRect(0, 0, 256, 384);
    g.fillStyle = "#cdb184";
    g.beginPath();
    g.moveTo(64, 380);
    g.lineTo(192, 380);
    g.lineTo(236, 320);
    g.lineTo(236, 130);
    g.lineTo(200, 96);
    g.lineTo(160, 96);
    g.lineTo(160, 20);
    g.lineTo(96, 20);
    g.lineTo(96, 96);
    g.lineTo(56, 96);
    g.lineTo(20, 130);
    g.lineTo(20, 320);
    g.closePath();
    g.fill();
    g.strokeStyle = "rgba(60,40,20,.7)";
    g.lineWidth = 2.5;
    g.strokeRect(88, 120, 80, 150);
    g.strokeRect(104, 32, 48, 48);
    g.strokeRect(60, 110, 136, 220);
    g.fillStyle = "rgba(60,40,20,.8)";
    g.font = "bold 20px Arial";
    g.textAlign = "center";
    g.fillText("A", 128, 200);
    g.fillText("C", 76, 300);
    g.fillText("D", 36, 200);
  });
  paperTex.wrapS = paperTex.wrapT = THREE.ClampToEdgeWrapping;
  const paperM = new THREE.MeshStandardMaterial({ map: paperTex, roughness: 0.95, side: THREE.DoubleSide });
  const railM = new THREE.MeshStandardMaterial({ color: 5593179, roughness: 0.45, metalness: 0.7 });
  const addPaper = (x, z) => {
    const t = new THREE.Group();
    t.position.set(x, 0, z);
    const hinge = new THREE.Group();
    hinge.position.y = 2.62;
    hinge.add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.5), railM));
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(6e-3, 6e-3, 0.5), railM);
    rod.position.y = -0.28;
    hinge.add(rod);
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.69), paperM);
    sheet.rotation.y = -Math.PI / 2;
    sheet.position.y = -0.9;
    sheet.castShadow = true;
    sheet.userData.surface = "paper";
    sheet.userData.target = t;
    hinge.add(sheet);
    t.add(hinge);
    t.userData = { hinge, plate: sheet, swing: 0, vel: 0, kind: "paper" };
    grp.add(t);
    targets.push(t);
    hitables.push(sheet);
    return t;
  };
  const railG = [];
  for (const z of [-2.4, 0, 2.4]) railG.push(new THREE.BoxGeometry(26, 0.08, 0.06).translate(line + 13, 2.7, z));
  grp.add(new THREE.Mesh(mergeGeometries(railG), railM));
  addPaper(line + 7, 0);
  addPaper(line + 15, 2.4);
  addPaper(line + 25, -2.4);
  addTarget(line + 10, -1.6, "plate", "10 м");
  addTarget(line + 25, 1, "ipsc", "25 м");
  addTarget(line + 25, 3.4, "plate");
  addTarget(line + 50, -0.8, "ipsc", "50 м");
  addTarget(line + 50, 2.2, "plate");
  addTarget(line + 75, 0.6, "ipsc", "75 м");
  addTarget(line + 100, -1, "ipsc", "100 м");
  addTarget(line + 100, 1.8, "plate");
  grp.traverse((o) => {
    if (o.isMesh) o.receiveShadow = !o.userData.noShadow;
  });
  const update = (dt) => {
    let moving = false;
    for (const t of targets) {
      const u = t.userData;
      if (Math.abs(u.vel) + Math.abs(u.swing) < 1e-5) continue;
      const k = u.kind === "paper" ? 14 : 60, d = u.kind === "paper" ? 1.8 : 4.5;
      u.vel += (-u.swing * k - u.vel * d) * dt;
      u.swing += u.vel * dt;
      u.hinge.rotation.z = -u.swing;
      moving = true;
    }
    return moving;
  };
  const hit = (t, energy) => {
    if (t) t.userData.vel += t.userData.kind === "paper" ? energy * 0.12 : energy;
  };
  const floorAt = (x, z) => x > line - 0.47 && x < line && Math.abs(z) < halfW - 0.1 ? 0.95 : 0;
  const setNight = (on) => {
    skyM.color.set(on ? 858672 : 14674679).multiplyScalar(on ? 0.12 : 5);
    fixM.emissiveIntensity = on ? 0 : 2.2;
    gapM.color.set(16769712).multiplyScalar(on ? 0.08 : 0.3);
    exitM.emissiveIntensity = on ? 0.35 : 0.9;
  };
  return { group: grp, targets, hitables, update, hit, floorAt, setNight, ground: floor, skylights };
}

