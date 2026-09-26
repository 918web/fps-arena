import * as THREE8 from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
var D2R2 = Math.PI / 180;
var Y_UP = new THREE8.Vector3(0, 1, 0);
var clamp = (v, a, b) => v < a ? a : v > b ? b : v;
var lerp = (a, b, t) => a + (b - a) * t;
var ease = (t) => t * t * (3 - 2 * t);
var KICK = { "556": 0.75, "545": 0.7, "762x39": 1.15, "762x51": 1.6, "9x19": 0.42, "762x54R": 1.9, "12ga": 2.6 };
// размер вспышки и энергия удара по гонгу — по патрону
var FLASH = { "762x51": 1.3, "762x39": 1.15, "762x54R": 1.45, "12ga": 1.5, "9x19": 0.7 };
var HIT = { "556": 2.5, "545": 2.5, "762x39": 3.2, "762x51": 4.5, "762x54R": 5, "9x19": 1.6, "12ga": 5.5 };
// дальность пристрелки прицела, м: пистолет-пулемёт/пистолет и ружьё — 25, винтовки — 100
var ZERO = { "9x19": 25, "12ga": 25 };
var TRACE_MODES = ["trace", "tracer", "off"];
var TRACE_LABEL = { trace: "след пули", tracer: "трассирующие", off: "трасса скрыта" };
// Луч и питание по умолчанию: кд, профиль отражателя (σ пятна и край засветки в радианах), ёмкость в минутах
var BEAM_DEF = { candela: 2e4, hot: 0.075, spill: 0.55, spillK: 0.035, ring: 0.06, color: 15922687, lensR: 0.014 };
var POWER_DEF = { light: 22, laser: 30, driver: "reg", cells: "2 × CR123A" };
var fract = (x) => x - Math.floor(x);
var hash1 = (i) => fract(Math.sin(i * 12.9898) * 43758.5453);
// мерцание почти севшего светодиода: плавный шум с провалами
function flicker(t, rate = 9) {
  const a = Math.floor(t * rate), f = t * rate - a, s = f * f * (3 - 2 * f);
  const v = hash1(a) * (1 - s) + hash1(a + 1) * s;
  return v > 0.38 ? 0.8 + 0.2 * v : 0.06 + 0.1 * v;
}
// Световой поток от заряда: «reg» — стабилизированный драйвер (ровно до ~12 %, дальше садится и желтеет),
// «step» — ступенчатый (18650: 100 % → 42 % → гаснет).
function lightOutput(lv, driver, t) {
  if (lv <= 0) return { k: 0, warm: 0 };
  let k, warm = 0;
  if (driver === "step") k = lv > 0.15 ? 1 : lv > 0.03 ? 0.42 : 0.42 * Math.sqrt(lv / 0.03);
  else {
    k = lv > 0.12 ? 1 - 0.04 * (1 - lv) : 0.95 * Math.pow(lv / 0.12, 0.9);
    warm = lv < 0.12 ? (1 - lv / 0.12) * 0.4 : 0;
  }
  if (lv < 0.035) k *= flicker(t);
  return { k, warm };
}
function laserOutput(lv, t) {
  if (lv <= 0) return 0;
  let k = lv > 0.1 ? 1 : 0.3 + 0.7 * (lv / 0.1);
  if (lv < 0.03) k *= flicker(t * 1.6, 13);
  return k;
}
// цветовая температура светодиода → hex (приближение Таннера Хелланда)
function kelvinHex(K) {
  const t = K / 100, c = (v) => Math.round(Math.min(255, Math.max(0, v)));
  const r = t <= 66 ? 255 : 329.7 * Math.pow(t - 60, -0.1332);
  const g = t <= 66 ? 99.47 * Math.log(t) - 161.12 : 288.12 * Math.pow(t - 60, -0.0755);
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04;
  return c(r) << 16 | c(g) << 8 | c(b);
}
// Луч фонаря в едином формате. У модулей набора M416 есть beam; у остальных — сила света (кд),
// размер пятна и засветки в долях конуса 0,62 рад и цветовая температура.
function beamOf(d) {
  if (d.beam) return { ...BEAM_DEF, ...d.beam, lensR: d.beam.lensR ?? (d.lensR ?? 13) / 1e3 };
  const lm = d.lumens || 500, cd = d.cd ?? lm * 22;
  const hot = d.hot ?? (cd / lm > 28 ? 0.15 : 0.21);
  return { ...BEAM_DEF, candela: cd, hot: hot * 0.45, spillK: (d.spill ?? 0.085) * 0.45, color: kelvinHex(d.kelvin ?? 6200), lensR: (d.lensR ?? 11) / 1e3 };
}
// м:сс — обратный отсчёт работы батареи
var mmss = (sec) => {
  const s = Math.max(0, Math.ceil(sec));
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
};
var Tweens = class {
  constructor() {
    this.list = [];
  }
  add(obj, key, to, dur, ease2 = (t) => t, done) {
    this.list = this.list.filter((t) => !(t.obj === obj && t.key === key));
    this.list.push({ obj, key, from: obj[key], to, dur: Math.max(dur, 1e-4), t: 0, ease: ease2, done });
  }
  wait(dur, done) {
    this.list.push({ obj: null, dur, t: 0, done });
  }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const w = this.list[i];
      w.t += dt;
      const k = Math.min(1, w.t / w.dur);
      if (w.obj) w.obj[w.key] = w.from + (w.to - w.from) * w.ease(k);
      if (k >= 1) {
        this.list.splice(i, 1);
        w.done && w.done();
      }
    }
  }
};
async function boot(def, lib) {
  const host = document.getElementById("app");
  const S = createScene(host);
  const mats = createMaterials(S.env);
  const ctx = makeCtx(mats);
  const asm = new Assembler(def, lib, ctx);
  const base = asm.base;
  const audio = new GunAudio();
  audio.profile = { ...def.audio, rpm: def.base.rpm, family: def.family || (def.id.startsWith("ak") ? "ak" : def.id) };
  const fx = new FX(S.scene, mats);
  const pip = new PipScope(S.renderer, S.scene);
  const ironRay = new THREE8.Raycaster();
  fx.floorAt = S.range.floorAt;
  const ball = new Ballistics();
  const tw = new Tweens();
  const aim = new THREE8.Group();
  aim.position.set(0, GUN_Y, 0);
  S.scene.add(aim);
  const rig = new THREE8.Group();
  aim.add(rig);
  const gun = asm.root;
  gun.scale.setScalar(1e-3);
  rig.add(gun);
  const pivotX = (base.pivotX ?? base.eyeX ?? -240) / 1e3;
  const st = {
    mode: def.modes.includes("auto") ? "auto" : def.modes[1] || "semi",
    mag: 0,
    cap: 30,
    chambered: true,
    magIn: true,
    busy: false,
    trigger: false,
    lastShot: 0,
    burst: 0,
    held: false,
    ads: false,
    adsT: 0,
    sightIdx: 0,
    zoom: 1,
    // кратность «сверх штатной» для прицелов без переменной кратности (колесо в прицеливании)
    zoomMul: 1,
    light: false,
    laser: false,
    emOn: {},
    trace: "trace",
    ret: {},
    lastHit: null,
    batt: {},
    folded: false,
    bipod: false,
    magAside: false,
    holdOpen: false,
    spent: false,
    handleLocked: false,
    burstLeft: 0,
    yaw: 0,
    pitch: 0,
    climb: 0,
    rec: { p: 0, y: 0, z: 0, vp: 0, vy: 0, vz: 0 },
    stats: {},
    baseStats: {},
    night: false,
    exposure: 1,
    expTarget: 1
  };
  let cfg = {};
  let ui = null;
  let sights = [];
  let lights = [], lasers = [];
  let stencilRef = 1;
  let lastOptic = null;
  function magKind() {
    const it = asm.installed.get("mag");
    const m = it?.obj;
    let steel = false;
    m?.traverse((o) => {
      if (o.isMesh && /steel|alu/.test(o.userData.mat || "")) steel = true;
    });
    return steel ? "steel" : "poly";
  }
  function applyConfig(next, opts = {}) {
    pip.release();
    cfg = asm.apply(next);
    const magInfo = asm.info("mag")?.mag;
    const prevCap = st.cap;
    st.cap = magInfo?.cap || def.base.mag || 30;
    if (opts.init || st.mag > st.cap || prevCap !== st.cap) st.mag = st.cap;
    if (!magInfo) st.magIn = false;
    else if (opts.init || def.feed === "tube") st.magIn = true;
    const ms = fireModes();
    if (!ms.includes(st.mode)) st.mode = ms.includes("auto") ? "auto" : ms.find((m) => m !== "safe") || ms[0];
    poseSelector(true);
    const mz = asm.info("muzzle")?.muzzle;
    audio.muzzle = mz ? mz.kind : "bare";
    if (audio.ctx && audio.shotBuffer) (window.requestIdleCallback || setTimeout)(() => audio.shotBuffer(audio.shotFamily(), audio.muzzle));
    // голос глушителя (звуковой стек M416/АК/SCAR): длина корпуса и заявленное снижение
    const mzPart = asm.installed.get("muzzle")?.part;
    audio.voice = mz?.kind === "supp" ? { len: mzPart?.stats?.length || 170, loud: mzPart?.stats?.loud ?? -27, ...mz.voice || {} } : null;
    st.stats = asm.stats();
    for (const it of asm.installed.values()) for (const s of [it.info?.sight, ...it.info?.alt || [], ...it.info?.sights || []]) {
      if (!s || !s.lens || s.lens.userData.stencilSet) continue;
      const ref = stencilRef++;
      const m = s.lens.material;
      m.stencilWrite = true;
      m.stencilRef = ref;
      m.stencilFunc = THREE8.AlwaysStencilFunc;
      m.stencilZPass = THREE8.ReplaceStencilOp;
      s.lens.userData.stencilSet = true;
      if (s.reticle) {
        s.retMesh = reticleMesh(s.reticle, s, ref);
        (s.node || it.obj).add(s.retMesh);
      }
    }
    const hasOptic = !!asm.info("optic")?.sight;
    for (const it of asm.installed.values()) {
      const f2 = it.info?.flip;
      if (f2) tw.add(f2.node.rotation, "z", hasOptic ? f2.angle * D2R2 : 0, opts.init ? 1e-3 : 0.35, ease);
      const fa = it.info?.flipAside;
      if (fa) fa.node.rotation.x = st.magAside ? fa.angle * D2R2 : 0;
      const fo = it.info?.fold;
      if (fo && fo.slide) fo.node.position.x = st.folded ? fo.slide : 0;
      else if (fo) fo.node.rotation[fo.axis || "y"] = st.folded ? fo.angle * D2R2 : 0;
      const bp = it.info?.bipod;
      if (bp) for (const l of bp.legs) l.rotation.z = st.bipod ? bp.angle * D2R2 : 0;
    }
    if (!asm.withInfo("bipod").length) st.bipod = false;
    if (!asm.withInfo("fold").length) st.folded = false;
    const slotOrder = (x) => {
      const i = def.slots.findIndex((s) => s.id === x.slotId);
      return i < 0 ? 99 : i;
    };
    lights = asm.withInfo("light").sort((a, b) => slotOrder(a) - slotOrder(b));
    lasers = asm.withInfo("laser").sort((a, b) => slotOrder(a) - slotOrder(b));
    // включённые излучатели, которых больше нет на оружии, забываем
    const alive = new Set([...lights.map((l) => emKey(l, "light")), ...lasers.map((l) => emKey(l, "laser"))]);
    for (const k of Object.keys(st.emOn)) if (!alive.has(k)) delete st.emOn[k];
    syncEmitterFlags();
    for (const it of [...lights, ...lasers]) if (st.batt[battKey(it)] == null) st.batt[battKey(it)] = 1;
    lensGlow();
    const mi = asm.info("mag")?.mag;
    if (mi?.rounds) mi.rounds.visible = st.mag > 0;
    const magObj = asm.installed.get("mag")?.obj;
    if (magObj) {
      magObj.visible = st.magIn;
      magObj.position.y = 0;
      magObj.rotation.z = 0;
    }
    buildSights();
    applyReticles();
    if (ui) ui.refresh();
    app?.invalidate?.();
  }
  function buildSights() {
    const prev = sights[st.sightIdx]?.id;
    sights = [];
    const m = new THREE8.Matrix4();
    const push = (id, label, obj, s, rkey) => {
      m.copy(toRoot(s.node || obj, gun));
      const eye = new THREE8.Vector3(s.x0 ?? 0, s.y, s.z || 0).applyMatrix4(m);
      const dir = new THREE8.Vector3(1, 0, 0).transformDirection(m);
      const up = new THREE8.Vector3(0, 1, 0).transformDirection(m);
      sights.push({ id, label, eye, dir, up, mag: s.mag || 1, zoom: s.zoom, reticle: s.reticle, eyeRelief: s.eyeRelief, magnifier: s.magnifier, x0: eye.x, src: s, rkey });
    };
    // дополнительные прицельные оси модуля (коллиматор поверх призмы/оптики): V переключает на них
    const pushAlt = (it) => (it.info?.alt || []).forEach((a, i) => push(it.slot.id + ":alt" + i, it.part.name + " — " + (a.label || "коллиматор"), it.obj, a, it.part.id + ":alt" + i));
    const opt = asm.installed.get("optic");
    if (opt?.info?.sight) push("optic", opt.part.name, opt.obj, opt.info.sight, opt.part.id);
    if (opt) pushAlt(opt);
    for (const it of asm.installed.values()) if (it !== opt) pushAlt(it);
    for (const it of asm.installed.values()) if (it.slot.id !== "optic" && it.info?.sight && !it.info.sight.magnifier) push(it.slot.id, it.part.name, it.obj, it.info.sight, it.part.id);
    const mg = asm.installed.get("magnifier");
    if (mg?.info?.sight && sights[0]) {
      m.copy(toRoot(mg.obj, gun));
      const eye = new THREE8.Vector3(mg.info.sight.x0, mg.info.sight.y, 0).applyMatrix4(m);
      sights.splice(1, 0, { ...sights[0], id: "magnifier", label: sights[0].label + (mg.info.sight.suffix || ""), eye, mag: mg.info.sight.mag, eyeRelief: mg.info.sight.eyeRelief, nv: !!mg.info.sight.nv, hide: mg.info.sight.hide, withMag: mg.info.sight.mag > 1 });
    }
    let rear = null, front = null;
    const pts = (it, key) => {
      const v = it.info?.irons?.[key];
      if (!v) return null;
      return new THREE8.Vector3(...v).applyMatrix4(toRoot(it.obj, gun));
    };
    let rearIt = null;
    for (const it of asm.installed.values()) {
      if (!rear && (rear = pts(it, "rear"))) rearIt = it;
      front = front || pts(it, "front");
    }
    if (base.irons?.rear && !rear) rear = new THREE8.Vector3(...base.irons.rear);
    if (base.irons?.front && !front) front = new THREE8.Vector3(...base.irons.front);
    const opticFolds = !!opt && [...asm.installed.values()].some((it) => it.info?.flip);
    // механика, перекрытая установленным модулем (ПСО-1 над коробкой, кронштейн оптики, ЛЦУ сверху),
    // в список прицелов не попадает: смотреть через неё нельзя
    const ironsClear = () => {
      gun.updateMatrixWorld(true);
      // от глаза (там же, где встанет камера), а не от целика: корпус ПСО бывает позади целика
      const type = rearIt ? rearIt.info.irons.type || "aperture" : base.irons?.type || "notch";
      const back = type === "aperture" ? (rearIt ? rearIt.info.irons.eye : base.irons?.eye) ?? 75 : 220;
      const eye = rear.clone().addScaledVector(front.clone().sub(rear).normalize(), -back);
      const a = gun.localToWorld(eye), b = gun.localToWorld(front.clone());
      const d = b.sub(a), len = d.length();
      ironRay.set(a, d.divideScalar(len));
      ironRay.near = 0;
      ironRay.far = len;
      const meshes = [];
      for (const it of asm.installed.values()) {
        if (it.info?.irons) continue;
        it.obj.traverseVisible((o) => {
          if (o.isMesh && !o.userData.lens && !o.userData.reticle && !o.material?.transparent) meshes.push(o);
        });
      }
      return !ironRay.intersectObjects(meshes, false).length;
    };
    if (rear && front && !opticFolds && ironsClear()) {
      const dir = front.clone().sub(rear).normalize();
      const type = rearIt ? rearIt.info.irons.type || "aperture" : base.irons?.type || "notch";
      const eyeDist = rearIt ? rearIt.info.irons.eye : base.irons?.eye;
      const apertureR = rearIt ? rearIt.info.irons.hole : base.irons?.hole;
      sights.push({ id: "irons", label: "Механический прицел", eye: rear, dir, mag: 1, irons: true, type, eyeDist, apertureR, rearObj: rearIt?.obj || base.nodes?.rearSight || null, x0: rear.x });
    }
    if (!sights.length) {
      const bs = boreSight();
      if (bs) sights.push(bs);
    }
    const optNow = sights.find((s) => s.id === "optic")?.label || null;
    const i = sights.findIndex((s) => s.id === prev);
    st.sightIdx = i >= 0 && optNow === lastOptic ? i : 0;
    lastOptic = optNow;
    if (sights[st.sightIdx]?.id === "magnifier" && st.magAside) st.sightIdx = 0;
  }
  // Без прицела целятся «по стволу»: глаз над верхом ствольной коробки, линия — параллельно оси
  // канала. Высота — наименьшая, при которой линия до дульного среза ничего не задевает.
  function boreSight() {
    gun.updateMatrixWorld(true);
    const mx = muzzleX(), ex = base.eyeX ?? -240;
    const meshes = [];
    gun.traverseVisible((o) => {
      if (o.isMesh && !o.userData.lens && !o.userData.reticle && !o.material?.transparent) meshes.push(o);
    });
    const a = new THREE8.Vector3(), b = new THREE8.Vector3();
    for (let h = 14; h <= 140; h += 3) {
      gun.localToWorld(a.set(ex, h, 0));
      gun.localToWorld(b.set(mx, h, 0));
      const d = b.sub(a), len = d.length();
      ironRay.set(a, d.divideScalar(len));
      ironRay.near = 0;
      ironRay.far = len;
      if (ironRay.intersectObjects(meshes, false).length) continue;
      // sightPose для механики ставит глаз на 220 мм позади «целика» — ровно в ex
      const eye = new THREE8.Vector3(ex + 220, h + 4, 0);
      return { id: "bore", label: "По стволу (без прицела)", eye, dir: new THREE8.Vector3(1, 0, 0), mag: 1, irons: true, type: "notch", bore: true, x0: eye.x };
    }
    return null;
  }
  const f = base.focus || { center: [0, 0, 0], size: 900 };
  const controls = new OrbitControls(S.camera, S.renderer.domElement);
  controls.target.set(f.center[0] / 1e3, GUN_Y + f.center[1] / 1e3, f.center[2] / 1e3);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 0.12;
  controls.maxDistance = 3.5;
  controls.mouseButtons = { LEFT: THREE8.MOUSE.ROTATE, MIDDLE: THREE8.MOUSE.DOLLY, RIGHT: null };
  const orbitHome = () => {
    S.camera.position.set(controls.target.x - 0.2, controls.target.y + 0.17, controls.target.z + f.size / 1e3 * 1.75);
    controls.update();
  };
  orbitHome();
  const focusTarget = new THREE8.Vector3().copy(controls.target);
  const homeTarget = controls.target.clone();
  let focusDist = null;
  const orbitPose = { pos: new THREE8.Vector3(), quat: new THREE8.Quaternion(), fov: 38 };
  const baseFov = 38;
  function sightPose(out) {
    const s = sights[st.sightIdx];
    if (!s) return null;
    let ex = base.eyeX ?? -240;
    if (s.eyeRelief) ex = s.eye.x - s.eyeRelief;
    else if (s.irons) ex = s.type === "aperture" ? s.eye.x - (s.eyeDist ?? 75) : Math.min(ex, s.eye.x - 220);
    else if (!s.irons) ex = Math.min(ex, s.eye.x - 60);
    const t = (ex - s.eye.x) / (s.dir.x || 1);
    const eyeGun = s.eye.clone().addScaledVector(s.dir, t);
    const m = new THREE8.Matrix4().makeScale(1e-3, 1e-3, 1e-3);
    out.pos.copy(eyeGun).applyMatrix4(m);
    const right = new THREE8.Vector3().crossVectors(s.dir, s.up || Y_UP).normalize();
    const up = new THREE8.Vector3().crossVectors(right, s.dir);
    const back = s.dir.clone().negate();
    out.quat.setFromRotationMatrix(new THREE8.Matrix4().makeBasis(right, up, back));
    const mag = s.zoom ? st.zoom : s.mag;
    // zoomMul меняет только поле зрения: режим (оптика/коллиматор) задаёт штатная кратность
    const zm = s.zoom ? 1 : st.zoomMul;
    out.fov = (s.irons ? baseFov * 0.78 : baseFov / Math.max(1, mag) * (mag > 1 ? 1 : 0.88)) / zm;
    out.mag = mag;
    out.s = s;
    return out;
  }
  const tmp = new THREE8.Vector3(), tmp2 = new THREE8.Vector3(), tq = new THREE8.Quaternion(), mzTmp = new THREE8.Vector3();
  function muzzleWorld(out, dir) {
    const mz = asm.mounts.get("muzzle");
    const len = asm.info("muzzle")?.muzzle?.x || 0;
    if (mz) mz.localToWorld(out.set(len, 0, 0));
    else gun.localToWorld(out.set(...base.muzzle || [400, 0, 0]));
    if (dir) dir.set(1, 0, 0).transformDirection(gun.matrixWorld).normalize();
    return out;
  }
  function canFire() {
    return st.mode !== "safe" && !st.busy;
  }
  /* ---------------------------------------------------------- баллистика и пристрелка */
  function ammoInfo() {
    return asm.info("ammo")?.ammo || def.ammo || {};
  }
  function bulletNow() {
    return bulletSpec(def.cal, asm.installed.get("ammo")?.part?.id);
  }
  function muzzleX() {
    const mz = asm.mounts.get("muzzle");
    if (!mz) return (base.muzzle || [400])[0];
    const p = mz.localToWorld(new THREE8.Vector3(asm.info("muzzle")?.muzzle?.x || 0, 0, 0));
    return gun.worldToLocal(p).x;
  }
  // Решение пристрелки для прицела s: линия прицеливания и траектория пересекаются на дальности Z.
  // Высота линии прицеливания над осью канала берётся в точке пересечения (для механики линия
  // «целик — мушка» слегка наклонена к оси ствола).
  function zeroFor(s) {
    const Z = def.zero ?? ZERO[def.cal] ?? 100;
    const v0 = st.stats.velocity || def.base.velocity || 800;
    if (!s) return { sol: zeroSolution(bulletNow(), v0, 0.03, 0, Z), v0, spec: bulletNow(), Z };
    const xm = muzzleX();
    const t = (xm + Z * 1e3 - s.eye.x) / (s.dir.x || 1);
    const h = (s.eye.y + s.dir.y * t) / 1e3, z = (s.eye.z + s.dir.z * t) / 1e3;
    const spec = bulletNow();
    return { sol: zeroSolution(spec, v0, h, z, Z), v0, spec, Z };
  }
  // функция поправок для BDC-сеток: R (м) → MOA ниже точки прицеливания
  function holdCtx(s) {
    const zf = zeroFor(s);
    const ranges = [100, 150, 200, 250, 300, 400, 500, 600, 700, 800, 1e3, 1100, 1200, 1300];
    const hs = holdovers(zf.spec, zf.v0, zf.sol, ranges);
    const map = new Map(ranges.map((R, i) => [R, hs[i]?.moa ?? null]));
    return { hold: (R) => map.get(R) ?? null, far: def.cal === "9x19" || def.cal === "12ga" ? 100 : 300, key: [zf.spec.name, zf.v0.toFixed(0), zf.sol.h.toFixed(3), zf.Z].join("|") };
  }
  function trailMode() {
    return st.trace;
  }
  const PUMP = def.action === "pump";
  const TUBE = def.feed === "tube";
  function roundsVisible() {
    const mi = asm.info("mag")?.mag;
    if (mi?.rounds) mi.rounds.visible = st.mag > 0;
  }
  function fireOnce() {
    const now = performance.now() / 1e3;
    if (!st.chambered) {
      audio.dryFire();
      st.held = false;
      if (ui) ui.toast(PUMP ? st.mag > 0 ? "Передёрните цевьё (T)" : "Магазин пуст — зарядить (R)" : st.magIn ? "Патронник пуст — перезарядка (R)" : "Нет магазина");
      return false;
    }
    st.lastShot = now;
    audio.shot();
    const mzInfo = asm.info("muzzle")?.muzzle;
    const kind = mzInfo ? mzInfo.kind : asm.info("barrel")?.muzzleKind || def.bareKind || "bare";
    const pos = muzzleWorld(new THREE8.Vector3(), tmp2);
    const bore = tmp2.clone();
    gun.getWorldQuaternion(tq);
    // холодный глушитель: первый выстрел даёт хлопок — кислород в камерах догорает
    const coldCan = kind === "supp" && now - (st.prevShot ?? -10) > 3;
    st.prevShot = now;
    fx.muzzleFlash(pos, bore, kind, def.flashSize ?? FLASH[def.cal] ?? 1, tq, { flash: mzInfo ? mzInfo.flash ?? 0.8 : 1, first: coldCan, smoke: def.cal === "12ga" ? 1.4 : 1 });
    const ammo = ammoInfo();
    const pellets = ammo.pellets || 1;
    const spreadMoa = (st.stats.moa || 1.5) + Math.min(st.burst, 10) * 0.7 * (st.stats.recoilV || 100) / 100 + (st.ads ? 0 : def.hipMoa ?? 60);
    // дробь: диаметр осыпи задаёт чок (сужение дульца) и сам патрон
    const pattern = pellets > 1 ? (ammo.pattern || 90) * (mzInfo?.pattern ?? 1) : 0;
    // ствол задран над линией прицеливания на угол пристрелки (+ боковой вынос для прицела сбоку)
    const zf = zeroFor(sights[st.sightIdx]);
    const elev = zf.sol.elev, wd = zf.sol.wind;
    const launch = new THREE8.Vector3(Math.cos(elev) * Math.cos(wd), Math.sin(elev), Math.cos(elev) * Math.sin(wd)).transformDirection(gun.matrixWorld);
    const right = new THREE8.Vector3().crossVectors(bore, Y_UP).normalize();
    const upV = new THREE8.Vector3().crossVectors(right, bore).normalize();
    const spec = zf.spec, v0 = zf.v0 * (pellets > 1 ? 0.99 + Math.random() * 0.02 : 1 + (Math.random() - 0.5) * 0.008);
    const shot = { hits: 0, steel: 0, dist: 0, thumped: false, reported: false };
    const tracerShot = st.trace === "tracer";
    const onHit = (hit, b, v, graze) => {
      const surf = hit.object.userData.surface || "dirt";
      fx.impact(hit, surf, { v, graze, pellet: pellets > 1, dir: b.v.clone().normalize(), mass: spec.mass });
      const E = 0.5 * spec.mass / 1e3 * v * v;
      if (surf === "steel") {
        S.range.hit(hit.object.userData.target, (HIT[def.cal] ?? 2.5) * (ammo.energy ?? 1) / Math.sqrt(pellets) * Math.min(1.4, Math.pow(v / b.v0, 2) * 1.15));
        audio.ding(b.dist, Math.min(1.3, 0.6 + ++shot.steel * 0.12));
      } else if (!shot.thumped && !graze) {
        // у звукового стека M416 свой звук на каждую поверхность; бумагу пуля пробивает — слышен вал
        if (audio.impact) audio.impact(surf === "paper" ? "trap" : surf, surf === "paper" ? Math.max(b.dist, 100) : b.dist);
        else audio.thump(b.dist);
        shot.thumped = true;
      }
      if (!shot.reported && !graze) {
        shot.reported = true;
        st.lastHit = { dist: b.dist, t: b.t, v, E, surf, name: spec.name, pellets };
        ui?.shot?.(st.lastHit);
      }
    };
    for (let i = 0; i < pellets; i++) {
      // рассеивание: круговое нормальное (кучность в MOA ≈ диаметр группы), дробь — осыпь чока
      const sp = spreadMoa / 60 * D2R2 * 0.25;
      const gx = Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(Math.random() * Math.PI * 2);
      const gy = Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(Math.random() * Math.PI * 2);
      const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * pattern / 60 * D2R2 * 0.5;
      const dir = launch.clone().addScaledVector(upV, gy * sp + Math.sin(a) * rr).addScaledVector(right, gx * sp + Math.cos(a) * rr).normalize();
      ball.fire({ pos, vel: dir.multiplyScalar(v0), spec, right, tracer: tracerShot && (pellets === 1 || i === 0), onHit });
    }
    cycleAction();
    const K = def.kick ?? KICK[def.cal] ?? 0.8;
    const kick = K * (ammo.recoil ?? 1) * (st.stats.recoilV || 100) / 100 * (st.bipod ? 0.45 : 1);
    const side = K * 0.5 * (st.stats.recoilH || 100) / 100 * (st.bipod ? 0.4 : 1);
    st.rec.vp += kick * 60 * (0.85 + Math.random() * 0.3);
    st.rec.vy += (Math.random() - 0.45) * side * 55;
    st.rec.vz += kick * 1.6;
    st.climb += kick * 0.55 * D2R2;
    st.burst++;
    if (PUMP) {
      // помповое ружьё: стреляная гильза остаётся в патроннике до передёргивания цевья
      st.chambered = false;
      st.spent = true;
      if (def.autoPump !== false) {
        st.busy = true;
        setTimeout(() => pump(() => {
          st.busy = false;
          ui?.hud();
        }), 170);
      }
    } else if (st.magIn && st.mag > 0) {
      st.mag--;
      st.chambered = true;
    } else {
      st.chambered = false;
      if (base.anim?.holdOpen !== false && def.boltHold !== false && st.magIn) st.holdOpen = true;
    }
    roundsVisible();
    if (ui) ui.hud();
    return true;
  }
  function ejectShell(live = false) {
    const ej = base.eject;
    if (!ej) return;
    const p = gun.localToWorld(new THREE8.Vector3(...ej.p));
    const d = new THREE8.Vector3(...ej.dir).normalize().transformDirection(gun.matrixWorld);
    const v = live ? d.multiplyScalar(1.5) : d.multiplyScalar((ej.speed ?? 3.2) + Math.random() * 1.2).add(new THREE8.Vector3((Math.random() - 0.5) * 0.4, Math.random() * 0.6, 0));
    gun.getWorldQuaternion(tq);
    fx.shell(p, v, def.cal, tq, live);
    if (!live) fx.portSmoke(p, d, audio.muzzle === "supp" ? 2.2 : 1);
  }
  function cycleAction() {
    const tr = base.nodes?.trigger;
    const cyc = 60 / (def.base.rpm || 700);
    if (tr) {
      tr.rotation.z = -(base.anim?.triggerAngle ?? 0.16);
      tw.add(tr.rotation, "z", 0, PUMP ? 0.25 : cyc * 0.9);
    }
    const ham = base.nodes?.hammer;
    if (ham) {
      ham.rotation.z = 0;
    }
    if (PUMP) return;
    const car = base.nodes?.carrier;
    const travel = base.anim?.carrierTravel || 80;
    if (car) {
      tw.add(car.position, "x", -travel, cyc * 0.32, (t) => 1 - (1 - t) * (1 - t), () => {
        if (!st.chambered && st.holdOpen) return;
        tw.add(car.position, "x", 0, cyc * 0.45, (t) => t * t);
      });
    }
    const pc = base.anim?.portCover;
    if (pc && pc.rotation.x < 1) tw.add(pc.rotation, "x", 1.9, 0.08, (t) => 1 - (1 - t) * (1 - t));
    if (base.eject) setTimeout(() => ejectShell(false), cyc * 300);
  }
  // Цикл помпы: цевьё с затвором назад (выброс гильзы/патрона), вперёд (подача из трубки).
  function pump(done) {
    const fe = base.nodes?.forend, car = base.nodes?.carrier;
    const travel = base.anim?.pumpTravel || 95;
    audio.pumpBack();
    if (fe) tw.add(fe.position, "x", -travel, 0.14, ease);
    if (car) tw.add(car.position, "x", -travel, 0.14, ease);
    setTimeout(() => {
      if (st.spent || st.chambered) ejectShell(!st.spent);
      st.spent = false;
      st.chambered = false;
      ui?.hud();
    }, 110);
    setTimeout(() => {
      audio.pumpForward();
      if (fe) tw.add(fe.position, "x", 0, 0.12, ease);
      if (car) tw.add(car.position, "x", 0, 0.12, ease);
      setTimeout(() => {
        if (st.mag > 0) {
          st.mag--;
          st.chambered = true;
        }
        ui?.hud();
        setTimeout(() => done && done(), 90);
      }, 90);
    }, 210);
  }
  function magNode() {
    return asm.installed.get("mag")?.obj || null;
  }
  function magMount() {
    return asm.mounts.get("magwell")?.userData.mount || {};
  }
  function dropMag(done) {
    const m = magNode();
    if (!m || !st.magIn) {
      done && done();
      return;
    }
    const kind = magKind();
    audio.magOut(kind);
    const rock = magMount().rock;
    const fall = () => {
      tw.add(m.position, "y", -420, 0.42, (t) => t * t, () => {
        m.visible = false;
        m.position.y = 0;
        m.rotation.z = 0;
        audio.magDropGround(kind, st.mag / Math.max(1, st.cap));
      });
      st.magIn = false;
      // СВД: затвор на задержке держит подаватель магазина — без магазина он уходит вперёд
      if (st.holdOpen && def.holdByFollower) {
        setTimeout(() => {
          audio.boltSlam();
          const car = base.nodes?.carrier;
          if (car) tw.add(car.position, "x", 0, 0.06, (t) => t * t);
          st.holdOpen = false;
          ui?.hud();
        }, 120);
      }
      if (ui) ui.hud();
      setTimeout(() => done && done(), 380);
    };
    if (rock) tw.add(m.rotation, "z", rock[2] * D2R2, 0.16, ease, fall);
    else fall();
  }
  function insertMag(done) {
    const m = magNode();
    if (!m) {
      done && done();
      return;
    }
    m.visible = true;
    m.position.y = -300;
    const rock = magMount().rock;
    m.rotation.z = rock ? rock[2] * D2R2 : 0;
    const kind = magKind();
    st.mag = st.cap;
    roundsVisible();
    setTimeout(() => audio.magInsert(kind), 190);
    tw.add(m.position, "y", 0, 0.35, (t) => 1 - Math.pow(1 - t, 3), () => {
      const fin = () => {
        if (!rock) audio.magIn(kind);
        // проверка рывком за магазин
        if (!rock && audio.tug) setTimeout(() => audio.tug(kind), 170);
        st.magIn = true;
        if (ui) ui.hud();
        setTimeout(() => done && done(), !rock && audio.tug ? 260 : 150);
      };
      if (rock) {
        setTimeout(() => audio.magIn(kind), 90);
        tw.add(m.rotation, "z", 0, 0.14, ease, fin);
      } else fin();
    });
  }
  function release() {
    if (st.magIn && st.mag > 0 && !st.chambered) {
      st.mag--;
      st.chambered = true;
    }
    st.holdOpen = false;
    roundsVisible();
    if (ui) ui.hud();
  }
  // Рукоять/затвор назад; lock — оставить открытым (HK: рукоять в вырезе трубки).
  function chargeBack(lock, done) {
    const car = base.nodes?.carrier, hd = base.nodes?.handle;
    const ch = asm.installed.get("charger");
    const travel = base.anim?.carrierTravel || 80;
    audio.chargeBack();
    const chObj = ch?.obj;
    const chTravel = ch?.info?.charger?.travel || 0;
    if (car) tw.add(car.position, "x", -travel, 0.2, ease);
    if (chObj) tw.add(chObj.position, "x", -chTravel, 0.2, ease);
    if (hd) tw.add(hd.position, "x", -(base.anim?.handleTravel ?? travel), 0.2, ease);
    const wasChambered = st.chambered;
    setTimeout(() => {
      if (wasChambered) {
        ejectShell(true);
        st.chambered = false;
      }
      if (lock) {
        audio.hkLock();
        const r = base.anim?.handleLock;
        if (hd && r) tw.add(hd.rotation, "x", r * D2R2, 0.08, ease);
        st.handleLocked = true;
        ui?.hud();
      }
      done && done();
    }, lock ? 240 : 330);
  }
  function chargeForward(done) {
    const car = base.nodes?.carrier, hd = base.nodes?.handle;
    const ch = asm.installed.get("charger");
    audio.chargeRelease();
    if (hd && base.anim?.handleLock) hd.rotation.x = 0;
    if (car) tw.add(car.position, "x", 0, 0.07, (t) => t * t);
    if (hd) tw.add(hd.position, "x", 0, 0.07, (t) => t * t);
    if (ch?.obj) tw.add(ch.obj.position, "x", 0, 0.12, ease);
    st.handleLocked = false;
    release();
    setTimeout(() => done && done(), 200);
  }
  function charge(done) {
    if (PUMP) return pump(done);
    if (st.holdOpen && def.boltCatch !== false) {
      audio.boltCatch();
      release();
      const car = base.nodes?.carrier;
      if (car) tw.add(car.position, "x", 0, 0.06, (t) => t * t);
      setTimeout(() => done && done(), 250);
      return;
    }
    if (st.handleLocked) return chargeForward(done);
    chargeBack(false, () => chargeForward(done));
  }
  // Патроны по одному в подствольный магазин через окно снизу.
  function loadTube(done) {
    const sh = base.nodes?.loadShell;
    const step = () => {
      if (st.mag >= st.cap || st.trigger) {
        if (sh) sh.visible = false;
        return done && done();
      }
      audio.shellLoad();
      if (sh) {
        sh.visible = true;
        sh.position.set(-60, -70, 0);
        tw.add(sh.position, "y", 0, 0.12, ease);
        tw.add(sh.position, "x", 90, 0.3, (t) => t * t, () => sh.visible = false);
      }
      setTimeout(() => {
        st.mag++;
        ui?.hud();
        setTimeout(step, 170);
      }, 300);
    };
    step();
  }
  function reload() {
    if (st.busy || !asm.info("mag")) return;
    if ((TUBE || st.magIn) && st.mag >= st.cap && st.chambered) {
      ui?.toast(TUBE ? "Магазин полный" : "Магазин полный");
      return;
    }
    st.busy = true;
    st.trigger = false;
    if (ui) ui.hud();
    const fin = () => {
      st.busy = false;
      ui?.hud();
    };
    const after = () => {
      if (!st.chambered) charge(fin);
      else fin();
    };
    if (TUBE) {
      loadTube(() => !st.chambered && st.mag > 0 ? pump(fin) : fin());
      return;
    }
    if (def.reload === "hk" && !st.chambered && !st.handleLocked) {
      // HK: рукоять назад и в вырез → смена магазина → удар ладонью по рукояти
      chargeBack(true, () => setTimeout(() => dropMag(() => setTimeout(() => insertMag(() => setTimeout(() => chargeForward(fin), 120)), 250)), 150));
      return;
    }
    dropMag(() => {
      if (audio.pouch) {
        audio.pouch(magKind());
        setTimeout(() => insertMag(after), 480);
      } else setTimeout(() => insertMag(after), 250);
    });
  }
  function toggleMag() {
    if (TUBE) {
      ui?.toast("Подствольный магазин не отстёгивается — R: зарядить");
      return;
    }
    if (st.busy || !asm.info("mag")) return;
    st.busy = true;
    if (st.magIn) dropMag(() => {
      st.busy = false;
      ui?.hud();
    });
    else insertMag(() => {
      st.busy = false;
      ui?.hud();
    });
  }
  function fireModes() {
    for (const it of asm.installed.values()) if (it.info?.modes) return it.info.modes;
    return def.modes;
  }
  function selectorAnim() {
    for (const it of asm.installed.values()) if (it.info?.selector) return it.info.selector;
    return { node: base.nodes?.selector, angles: base.anim?.selector, axis: base.anim?.selectorAxis };
  }
  function poseSelector(instant) {
    const sa = selectorAnim(), a = sa.angles?.[st.mode];
    if (!sa.node || a == null) return;
    const ax = sa.axis || "z";
    if (instant) sa.node.rotation[ax] = a * D2R2;
    else tw.add(sa.node.rotation, ax, a * D2R2, 0.12, ease);
  }
  function setMode(m) {
    st.mode = m;
    audio.selector();
    poseSelector(false);
    ui?.hud();
  }
  function cycleMode() {
    const ms = fireModes();
    setMode(ms[(ms.indexOf(st.mode) + 1) % ms.length]);
  }
  function setADS(on) {
    if (on && !sights.length) {
      ui?.toast("Нет прицельного приспособления");
      return;
    }
    if (on === st.ads) return;
    st.ads = on;
    if (on) {
      orbitPose.pos.copy(S.camera.position);
      orbitPose.quat.copy(S.camera.quaternion);
      controls.enabled = false;
      st.yaw = 0;
      st.pitch = 0;
      const s = sights[st.sightIdx];
      if (s?.zoom) st.zoom = clamp(st.zoom, s.zoom[0], s.zoom[1]);
    }
    audio.shoulder ? audio.shoulder(on) : audio.click();
    ui?.hud();
  }
  function cycleSight() {
    if (sights.length < 2) {
      ui?.toast(sights.length ? "Другого прицела нет" : "Нет прицела");
      return;
    }
    st.sightIdx = (st.sightIdx + 1) % sights.length;
    st.zoomMul = 1;
    if (sights[st.sightIdx].id === "magnifier" && st.magAside) toggleMagnifier(false);
    ui?.toast("Прицел: " + sights[st.sightIdx].label);
    ui?.hud();
  }
  function toggleMagnifier(aside) {
    const mg = asm.installed.get("magnifier");
    if (!mg?.info?.flipAside) return;
    st.magAside = aside ?? !st.magAside;
    const fa = mg.info.flipAside;
    tw.add(fa.node.rotation, "x", st.magAside ? fa.angle * D2R2 : 0, 0.22, ease);
    audio.click();
    const mi = sights.findIndex((s) => s.id === "magnifier");
    if (st.magAside && sights[st.sightIdx]?.id === "magnifier") st.sightIdx = 0;
    else if (!st.magAside && mi >= 0) st.sightIdx = mi;
    ui?.hud();
  }
  /* ---------------------------------------------------------- батареи, фонари, ЛЦУ */
  // Каждый модуль с фонарём/ЛЦУ — своя батарея (у комбо-блоков общая на оба излучателя).
  // Время работы на полной мощности — 20…30 мин; стабилизированный драйвер держит яркость
  // до ≈15 % заряда, дальше свет садится, под конец мерцает и гаснет.
  // Каждый излучатель включается отдельно: C/Z — основной (первый заряженный), Shift+C/Shift+Z —
  // второй. Если включённый сел, а второй того же типа заряжен — второй включается сам.
  const BATT_LS = "gunsmith:batt:" + def.id;
  try {
    Object.assign(st.batt, JSON.parse(localStorage.getItem(BATT_LS) || "{}"));
  } catch (e) {
  }
  function battKey(it) {
    return it.slotId + ":" + (it.part?.id || "base");
  }
  function emKey(it, kind) {
    return battKey(it) + ":" + kind;
  }
  function charged(it) {
    return (st.batt[battKey(it)] ?? 1) > 0;
  }
  function isOn(it, kind) {
    return !!st.emOn[emKey(it, kind)];
  }
  function syncEmitterFlags() {
    st.light = lights.some((l) => isOn(l, "light"));
    st.laser = lasers.some((l) => isOn(l, "laser"));
  }
  function slotLabel(it) {
    return def.slots.find((s) => s.id === it.slotId)?.label || it.part?.name || "";
  }
  function emName(kind, i, n) {
    return (kind === "light" ? "Фонарь" : "ЛЦУ") + (n > 1 ? " " + (i + 1) : "");
  }
  function powerOf(it) {
    return { ...POWER_DEF, ...it.part?.power || {} };
  }
  function lightSpec(it) {
    const d = it.data, lm = d.lumens || 500;
    const cd = d.cd ?? lm * 22;
    return {
      key: it.slotId + ":" + (it.part?.id || ""),
      lm,
      cd,
      hot: d.hot ?? (cd / lm > 28 ? 0.15 : 0.21),
      spill: d.spill ?? 0.085,
      angle: d.angle ?? 0.62,
      kelvin: d.kelvin ?? 6200,
      throw: Math.min(130, 2 * Math.sqrt(cd) * 0.45),
      lensR: (d.lensR ?? 11) / 1e3,
      batt: it.part?.power?.light ?? d.batt ?? (lm >= 1000 ? 21 : lm >= 600 ? 24 : 28)
    };
  }
  function laserBatt(it) {
    return it.part?.power?.laser ?? it.data.batt ?? (it.info?.light ? 26 : 30);
  }
  // расход заряда в секунду: доля батареи; у комбо-блока складывается из включённых излучателей
  function drainRate(k, assumeOn = false) {
    let r = 0;
    for (const l of lights) if (battKey(l) === k && (assumeOn || isOn(l, "light"))) r += 1 / (lightSpec(l).batt * 60);
    for (const l of lasers) if (battKey(l) === k && (assumeOn || isOn(l, "laser"))) r += 1 / (laserBatt(l) * 60);
    return r;
  }
  function battLevel(c) {
    if (c <= 0) return 0;
    let v = c > 0.15 ? 1 : 0.2 + 0.8 * Math.pow(c / 0.15, 1.6);
    if (c < 0.04) v *= Math.random() < 0.12 ? 0.15 : 0.75 + Math.random() * 0.25;
    return v;
  }
  function lensGlow() {
    const t = performance.now() / 1e3;
    for (const l of lights) {
      const k = isOn(l, "light") ? lightOutput(st.batt[battKey(l)] ?? 1, powerOf(l).driver, t).k : 0;
      l.data.lens.material.emissiveIntensity = 7 * k;
      if (l.data.refl) l.data.refl.material.emissiveIntensity = 0.9 * k;
    }
    for (const l of lasers) l.data.lens.material.emissiveIntensity = isOn(l, "laser") ? 5 * laserOutput(st.batt[battKey(l)] ?? 1, t) : 0;
  }

  function saveBatt() {
    try {
      localStorage.setItem(BATT_LS, JSON.stringify(st.batt));
    } catch (e) {
    }
  }
  let battSaveT = 0, battHudT = 0;
  function drainBatteries(dt) {
    if (!st.light && !st.laser) return;
    const used = /* @__PURE__ */ new Set();
    for (const l of lights) if (isOn(l, "light")) used.add(battKey(l));
    for (const l of lasers) if (isOn(l, "laser")) used.add(battKey(l));
    const died = [];
    for (const k of used) {
      const before = st.batt[k] ?? 1;
      st.batt[k] = Math.max(0, before - drainRate(k) * dt);
      if (before > 0 && st.batt[k] === 0) died.push(k);
    }
    if (died.length) {
      const msgs = [];
      for (const [kind, list] of [["light", lights], ["laser", lasers]]) {
        const dead = list.filter((l) => died.includes(battKey(l)) && isOn(l, kind));
        if (!dead.length) continue;
        for (const l of dead) st.emOn[emKey(l, kind)] = false;
        const name = emName(kind, list.indexOf(dead[0]), list.length);
        // резерв: другой излучатель того же типа с зарядом — включается сам, если ничего не светит
        const spare = list.find((l) => !isOn(l, kind) && charged(l));
        if (spare && !list.some((l) => isOn(l, kind))) {
          st.emOn[emKey(spare, kind)] = true;
          msgs.push(`${name}: батарея села — включён ${emName(kind, list.indexOf(spare), list.length).toLowerCase()}`);
        } else msgs.push(`${name}: батарея села — U: заменить`);
      }
      syncEmitterFlags();
      if (msgs.length) ui?.toast(msgs.join(" · "));
      audio.click();
    }
    lensGlow();
    battSaveT += dt;
    battHudT += dt;
    if (battSaveT > 5) {
      battSaveT = 0;
      saveBatt();
    }
    if (battHudT > 1 || died.length) {
      battHudT = 0;
      ui?.hud();
    }
  }
  // Состояние батарей для HUD: заряд, оставшееся время (обратный отсчёт м:сс при текущем расходе;
  // для выключенного — на полной мощности), клавиша управления.
  function battInfo() {
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    for (const [kind, list] of [["light", lights], ["laser", lasers]]) list.forEach((l, i) => {
      const k = battKey(l);
      if (seen.has(k)) return;
      seen.add(k);
      const c = st.batt[k] ?? 1;
      const both = lights.some((x) => battKey(x) === k) && lasers.some((x) => battKey(x) === k);
      const onNow = drainRate(k) > 0;
      const rate = onNow ? drainRate(k) : 1 / ((kind === "light" ? lightSpec(l).batt : laserBatt(l)) * 60);
      const sec = c / rate;
      const li = lights.findIndex((x) => battKey(x) === k), zi = lasers.findIndex((x) => battKey(x) === k);
      const keysTxt = [li >= 0 ? (li ? "⇧C" : "C") : null, zi >= 0 ? (zi ? "⇧Z" : "Z") : null].filter(Boolean).join("/");
      out.push({
        key: k,
        label: both ? "Фонарь+ЛЦУ" + (lights.length > 1 || lasers.length > 1 ? " " + (Math.max(li, zi) + 1) : "") : emName(kind, i, list.length),
        slot: slotLabel(l),
        pct: Math.round(c * 100),
        sec,
        time: mmss(sec),
        min: Math.round(sec / 60),
        on: onNow,
        keys: keysTxt
      });
    });
    return out;
  }
  function replaceBatteries() {
    const all = [...lights, ...lasers];
    if (!all.length) {
      ui?.toast("Нет модулей с батареями");
      return;
    }
    for (const l of all) st.batt[battKey(l)] = 1;
    const cells = [...new Set(all.map((l) => powerOf(l).cells))];
    audio.batteryChange ? audio.batteryChange(cells[0]) : audio.click();
    saveBatt();
    lensGlow();
    ui?.toast("Батареи заменены: " + cells.join(", ") + " — 100 %");
    ui?.hud();
  }
  // which: "main" — основной (C/Z): выключает все излучатели типа или включает первый заряженный;
  // число — конкретный излучатель (Shift — второй).
  function toggleEmitter(kind, which = "main") {
    const list = kind === "light" ? lights : lasers;
    const noun = kind === "light" ? "Фонарь" : "ЛЦУ";
    if (!list.length) {
      ui?.toast(noun + " не установлен");
      return;
    }
    let msg = null;
    if (which === "main") {
      if (list.some((l) => isOn(l, kind))) for (const l of list) st.emOn[emKey(l, kind)] = false;
      else {
        const l = list.find(charged);
        if (!l) {
          audio.click();
          ui?.toast(`Батарея ${kind === "light" ? "фонаря" : "ЛЦУ"} разряжена — U: заменить`);
          return;
        }
        st.emOn[emKey(l, kind)] = true;
        if (l !== list[0]) msg = `${emName(kind, 0, list.length)} разряжен — включён ${emName(kind, list.indexOf(l), list.length).toLowerCase()}`;
      }
    } else {
      const l = list[Math.min(which, list.length - 1)];
      if (!isOn(l, kind) && !charged(l)) {
        audio.click();
        ui?.toast(`${emName(kind, list.indexOf(l), list.length)}: батарея разряжена — U: заменить`);
        return;
      }
      st.emOn[emKey(l, kind)] = !isOn(l, kind);
    }
    syncEmitterFlags();
    if (kind === "light") audio.tailcap?.(st.light) ?? audio.click();
    else audio.click();
    lensGlow();
    if (msg) ui?.toast(msg);
    ui?.hud();
  }
  const toggleLight = (which) => toggleEmitter("light", which);
  const toggleLaser = (which) => toggleEmitter("laser", which);
  function emitterList() {
    return { lights: lights.map((l, i) => ({ i, on: isOn(l, "light"), charged: charged(l), slot: slotLabel(l) })), lasers: lasers.map((l, i) => ({ i, on: isOn(l, "laser"), charged: charged(l), slot: slotLabel(l) })) };
  }
  /* ---------------------------------------------------------- прицельные сетки */
  // Выбор сетки и цвета подсветки хранится по модулю прицела (у всех образцов оружия общий).
  const RET_LS = "gunsmith:reticle";
  try {
    Object.assign(st.ret, JSON.parse(localStorage.getItem(RET_LS) || "{}"));
  } catch (e) {
  }
  function retOf(s) {
    if (!s || !s.reticle) return null;
    const set = reticleSet(s.reticle);
    const saved = st.ret[s.rkey || s.id] || {};
    return { set, id: set.includes(saved.id) ? saved.id : set[0], color: saved.color || RET_DEFAULT_COLOR[s.reticle] || "red" };
  }
  function applyReticles() {
    for (const s of sights) {
      const r = retOf(s);
      if (r && s.src?.retMesh) reticleApply(s.src.retMesh, r.id, r.color, holdCtx(s));
    }
    ui?.scope(null, null, true);
    app?.invalidate?.();
  }
  // текущий прицел с сеткой (увеличитель — сетка основного коллиматора)
  function retSight() {
    const s = sights[st.sightIdx];
    if (s?.id === "magnifier") return sights[0];
    return s?.reticle ? s : null;
  }
  function cycleReticle() {
    const s = retSight();
    if (!s) {
      ui?.toast(sights[st.sightIdx]?.irons ? "У механического прицела сетки нет" : "Нет прицела с сеткой");
      return;
    }
    const r = retOf(s);
    if (r.set.length < 2) {
      ui?.toast("У этого прицела одна сетка");
      return;
    }
    const id = r.set[(r.set.indexOf(r.id) + 1) % r.set.length];
    st.ret[s.rkey || s.id] = { ...st.ret[s.rkey || s.id], id };
    try {
      localStorage.setItem(RET_LS, JSON.stringify(st.ret));
    } catch (e) {
    }
    applyReticles();
    audio.click();
    ui?.toast(`Сетка: ${RETICLES[id]?.name || id} (${r.set.indexOf(id) + 1}/${r.set.length})`);
    ui?.hud();
  }
  function cycleReticleColor() {
    const s = retSight();
    if (!s) {
      ui?.toast("Нет прицела с подсветкой");
      return;
    }
    const r = retOf(s);
    const i = RET_COLORS.findIndex((c) => c.id === r.color);
    const c = RET_COLORS[(i + 1) % RET_COLORS.length];
    st.ret[s.rkey || s.id] = { ...st.ret[s.rkey || s.id], id: r.id, color: c.id };
    try {
      localStorage.setItem(RET_LS, JSON.stringify(st.ret));
    } catch (e) {
    }
    applyReticles();
    audio.click();
    ui?.toast("Подсветка: " + c.name);
    ui?.hud();
  }
  function reticleInfo() {
    const s = retSight();
    const r = retOf(s);
    if (!r) return null;
    return { id: r.id, name: RETICLES[r.id]?.name || r.id, color: r.color, n: r.set.length, i: r.set.indexOf(r.id), ctx: holdCtx(s), sight: s };
  }
  function cycleTrace() {
    st.trace = TRACE_MODES[(TRACE_MODES.indexOf(st.trace) + 1) % TRACE_MODES.length];
    try {
      localStorage.setItem("gunsmith:trace", st.trace);
    } catch (e) {
    }
    audio.click();
    ui?.toast("Трасса: " + TRACE_LABEL[st.trace]);
    ui?.hud();
  }
  try {
    const tm = localStorage.getItem("gunsmith:trace");
    if (TRACE_MODES.includes(tm)) st.trace = tm;
  } catch (e) {
  }
  /* ---------------------------------------------------------- освещение тира: день / ночь */
  const TIME_LABEL = { day: "День", night: "Ночь" };
  function setNight(on, silent) {
    st.night = !!on;
    S.setNight(st.night);
    fx.night = st.night;
    try {
      localStorage.setItem("gunsmith:night", st.night ? "1" : "0");
    } catch (e) {
    }
    if (!silent) {
      audio.lightSwitch ? audio.lightSwitch() : audio.click();
      ui?.toast(st.night ? "Ночь: освещение тира выключено" + (lights.length ? "" : " — поставьте фонарь") : "День: освещение тира включено");
    }
    app?.invalidate?.();
    ui?.hud();
  }
  function cycleTime() {
    setNight(!st.night);
  }
  function toggleBipod() {
    const b = asm.withInfo("bipod")[0];
    if (!b) {
      ui?.toast("Сошки не установлены");
      return;
    }
    st.bipod = !st.bipod;
    for (const l of b.data.legs) tw.add(l.rotation, "z", st.bipod ? b.data.angle * D2R2 : 0, 0.3, ease);
    audio.bipod();
    ui?.hud();
  }
  function toggleFold() {
    const f2 = asm.withInfo("fold")[0];
    if (!f2) {
      ui?.toast("Приклад не складывается");
      return;
    }
    st.folded = !st.folded;
    const ax = f2.data.axis || "y";
    // телескопический приклад: сдвиг вдоль оси вместо поворота
    if (f2.data.slide) tw.add(f2.data.node.position, "x", st.folded ? f2.data.slide : 0, 0.3, ease);
    else tw.add(f2.data.node.rotation, ax, st.folded ? f2.data.angle * D2R2 : 0, 0.4, ease);
    audio.fold();
    ui?.hud();
  }
  function setPart(slotId, partId, pos) {
    const next = { ...cfg, [slotId]: partId ? { id: partId, pos: pos ?? (cfg[slotId]?.id === partId ? cfg[slotId].pos : null) } : null };
    const slotDef = def.slots.find((s) => s.id === slotId);
    // слот, которому нужен определённый модуль-носитель (резьба на стволе Glock): ставим его сами
    let via = null;
    if (partId && slotDef?.via && !asm.mounts.has(slotDef.mount) && cfg[slotDef.via.slot]?.id !== slotDef.via.part) {
      next[slotDef.via.slot] = { id: slotDef.via.part };
      via = asm.part(slotDef.via.part)?.name;
    }
    const newPart = partId && asm.part(partId);
    if (newPart && slotDef?.behind && !asm.railPositions(slotDef, newPart, slotId).some((p) => !p.clash)) {
      const room = asm.roomBehind(slotDef, newPart);
      if (room) next[slotDef.behind] = { id: cfg[slotDef.behind].id, pos: { rail: room.rail, i: room.i } };
    }
    const before = JSON.stringify(cfg);
    applyConfig(next);
    const part = partId && asm.part(partId);
    if (part) {
      const slot2 = def.slots.find((s) => s.id === slotId);
      audio.attach(slot2?.mount === "muzzle" ? "thread" : /poly/.test(part.cat) ? "poly" : "rail");
    } else audio.click();
    const lost = def.slots.filter((s) => next[s.id]?.id && !cfg[s.id]).map((s) => asm.part(next[s.id].id)?.name).filter(Boolean);
    if (partId && !cfg[slotId]) ui?.toast("Не помещается: " + (asm.part(partId)?.name || ""));
    else if (via && cfg[slotId]) ui?.toast("Установлен " + via.charAt(0).toLowerCase() + via.slice(1));
    else if (lost.length && before !== JSON.stringify(cfg)) ui?.toast("Снято: " + lost.join(", "));
    saveCfg();
  }
  function railMove(slotId, dir) {
    const it = asm.installed.get(slotId);
    if (!it?.railPos) return;
    const slot2 = def.slots.find((s) => s.id === slotId);
    const ps = asm.railPositions(slot2, it.part, slotId).filter((p) => !p.clash);
    const i = ps.findIndex((p) => p.rail === it.railPos.rail && p.i === it.railPos.i);
    const n = ps[clamp(i + dir, 0, ps.length - 1)];
    if (!n || n === ps[i]) return;
    applyConfig({ ...cfg, [slotId]: { id: it.part.id, pos: { rail: n.rail, i: n.i } } });
    audio.click();
    saveCfg();
  }
  function railInfo(slotId) {
    const it = asm.installed.get(slotId);
    if (!it?.railPos) return null;
    const slot2 = def.slots.find((s) => s.id === slotId);
    const ps = asm.railPositions(slot2, it.part, slotId).filter((p) => !p.clash);
    const i = ps.findIndex((p) => p.rail === it.railPos.rail && p.i === it.railPos.i);
    return { i, n: ps.length };
  }
  const LS = "gunsmith:" + def.id;
  function saveCfg() {
    try {
      localStorage.setItem(LS, JSON.stringify(cfg));
    } catch (e) {
    }
  }
  function resetCfg() {
    applyConfig(def.defaults, { init: true });
    saveCfg();
    audio.click();
  }
  function focusSlot(slotId) {
    if (st.ads) return;
    const it = asm.installed.get(slotId);
    const slot2 = def.slots.find((s) => s.id === slotId);
    let obj = it?.obj;
    if (!obj) {
      const mid = slot2?.mount || slot2?.rails?.find((r) => asm.mounts.get(r));
      obj = mid && asm.mounts.get(mid);
    }
    if (!obj) {
      focusTarget.copy(homeTarget);
      focusDist = null;
      return;
    }
    const box2 = boundsOf(obj);
    if (box2.isEmpty()) obj.getWorldPosition(focusTarget);
    else box2.getCenter(focusTarget);
    focusDist = 0.55;
  }
  // Габарит модуля без сеток коллиматоров: плоскость сетки вынесена на 60 м вперёд
  // (так она не зависит от параллакса), и в Box3.setFromObject камера улетала за стрельбище.
  function boundsOf(obj) {
    const box2 = new THREE8.Box3(), b = new THREE8.Box3();
    obj.updateWorldMatrix(true, true);
    obj.traverse((o) => {
      if (!o.isMesh || o.userData.reticle || !o.geometry) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      box2.union(b.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld));
    });
    return box2;
  }
  function unfocus() {
    focusTarget.copy(homeTarget);
    focusDist = null;
  }
  const pointer = { x: 0.5, y: 0.5 };
  const cvs = S.renderer.domElement;
  cvs.addEventListener("contextmenu", (e) => e.preventDefault());
  cvs.addEventListener("pointerdown", (e) => {
    audio.init();
    if (e.button === 2) {
      setADS(!st.ads);
      e.preventDefault();
      return;
    }
    if (e.button === 0 && st.ads) {
      triggerDown();
      e.preventDefault();
    }
  });
  addEventListener("pointerup", (e) => {
    if (e.button === 0) triggerUp();
  });
  cvs.addEventListener("pointermove", (e) => {
    pointer.x = e.clientX / innerWidth;
    pointer.y = e.clientY / innerHeight;
    hover(e);
  });
  cvs.addEventListener("wheel", (e) => {
    if (!st.ads) return;
    zoomStep(e.deltaY < 0 ? 1 : -1);
    e.preventDefault();
  }, { passive: false });
  cvs.addEventListener("click", (e) => {
    if (!st.ads && !dragged) pick(e);
  });
  let downAt = null, dragged = false;
  cvs.addEventListener("pointerdown", (e) => {
    downAt = [e.clientX, e.clientY];
    dragged = false;
  });
  cvs.addEventListener("pointermove", (e) => {
    if (downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) dragged = true;
  });
  function triggerDown() {
    audio.init();
    if (st.trigger) return;
    st.trigger = true;
    st.held = true;
    st.burst = 0;
    if (st.mode === "safe") {
      audio.click();
      ui?.toast("Предохранитель (X — режим огня)");
      return;
    }
    if (!canFire()) return;
    if (fireOnce()) {
      st.nextShot = performance.now() / 1e3 + 60 / (st.stats.rpm || def.base.rpm);
      if (st.mode === "burst") st.burstLeft = (def.burstN || 3) - 1;
    }
  }
  function triggerUp() {
    st.trigger = false;
    st.burst = 0;
  }
  // Кратность в прицеливании: у переменной — её диапазон; у постоянной — 0,75…2 от штатной;
  // у коллиматора, механики и «по стволу» — до 2× (прищур, как ближе к мишени).
  function zoomRange(s) {
    if (!s) return [1, 1];
    if (s.zoom) return s.zoom;
    return s.mag > 1.2 ? [0.75, 2] : [1, 2];
  }
  function zoomStep(dir) {
    const s = sights[st.sightIdx];
    if (!s) return;
    const [lo, hi] = zoomRange(s);
    const k = dir > 0 ? 1.18 : 1 / 1.18;
    if (s.zoom) st.zoom = clamp(st.zoom * k, lo, hi);
    else {
      st.zoomMul = clamp(st.zoomMul * k, lo, hi);
      if (Math.abs(st.zoomMul - 1) < 0.05) st.zoomMul = 1;
    }
    ui?.hud();
    app?.invalidate?.();
  }
  const keys = {
    Equal: () => zoomStep(1),
    NumpadAdd: () => zoomStep(1),
    Minus: () => zoomStep(-1),
    NumpadSubtract: () => zoomStep(-1),
    KeyR: reload,
    KeyX: cycleMode,
    KeyF: () => setADS(!st.ads),
    KeyV: cycleSight,
    KeyN: () => toggleMagnifier(),
    KeyC: (e) => toggleLight(e?.shiftKey ? 1 : "main"),
    KeyZ: (e) => toggleLaser(e?.shiftKey ? 1 : "main"),
    KeyG: (e) => e?.shiftKey ? cycleReticleColor() : cycleReticle(),
    KeyY: cycleTrace,
    KeyL: cycleTime,
    KeyQ: () => app.cycleQuality?.(),
    KeyU: replaceBatteries,
    KeyB: toggleBipod,
    KeyK: toggleFold,
    KeyT: () => {
      if (!st.busy) {
        st.busy = true;
        charge(() => {
          st.busy = false;
          ui?.hud();
        });
      }
    },
    KeyM: toggleMag,
    Escape: () => setADS(false),
    KeyH: () => ui?.toggleHelp()
  };
  addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT") return;
    audio.init();
    if (e.code === "Space") {
      if (!e.repeat) triggerDown();
      e.preventDefault();
      return;
    }
    if (e.repeat && !/^(Equal|Minus|NumpadAdd|NumpadSubtract)$/.test(e.code)) return;
    const fn = keys[e.code];
    if (fn) {
      fn(e);
      e.preventDefault();
    }
  });
  addEventListener("keyup", (e) => {
    if (e.code === "Space") triggerUp();
  });
  const ray = new THREE8.Raycaster();
  let hoverT = 0;
  function partUnder(e) {
    const p = new THREE8.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(p, S.camera);
    const hs = ray.intersectObject(gun, true);
    for (const h of hs) {
      if (!h.object.visible || h.object.userData.reticle) continue;
      let o = h.object;
      while (o && !o.userData.slotId && o !== gun) o = o.parent;
      if (o && o.userData.slotId) return o.userData;
      return { base: true };
    }
    return null;
  }
  function hover(e) {
    if (st.ads || e.buttons) {
      ui?.tip(null);
      return;
    }
    const now = performance.now();
    if (now - hoverT < 60) return;
    hoverT = now;
    const u = partUnder(e);
    if (u && u.partId) ui?.tip(asm.part(u.partId)?.name, e.clientX, e.clientY);
    else if (u && u.base) ui?.tip(def.title, e.clientX, e.clientY);
    else ui?.tip(null);
  }
  function pick(e) {
    const u = partUnder(e);
    if (u?.slotId) ui?.openSlot(u.slotId);
  }
  const adsPose = { pos: new THREE8.Vector3(), quat: new THREE8.Quaternion(), fov: baseFov };
  const clock = new THREE8.Clock();
  const camKick = new THREE8.Quaternion();
  const eulerTmp = new THREE8.Euler();
  function applyViewOffset() {
    const o = Math.round(st.viewOff || 0);
    if (o === lastViewOff) return;
    lastViewOff = o;
    camDirty = true;
    if (Math.abs(o) < 1) {
      if (S.camera.view) S.camera.clearViewOffset();
      return;
    }
    S.camera.setViewOffset(innerWidth, innerHeight, -o, 0, innerWidth, innerHeight);
  }
  let lastViewOff = null;
  addEventListener("resize", () => {
    lastViewOff = null;
  });
  let defocused = null;
  function restoreFocus() {
    defocused?.traverse((m) => {
      if (m.userData.sharpMat) {
        m.material.dispose();
        m.material = m.userData.sharpMat;
        delete m.userData.sharpMat;
      }
    });
    defocused = null;
  }
  function defocus(obj, k) {
    if (defocused && defocused !== obj) restoreFocus();
    if (!obj || k < 0.01) {
      if (defocused) restoreFocus();
      return;
    }
    defocused = obj;
    obj.traverse((m) => {
      if (!m.isMesh || m.userData.reticle) return;
      if (!m.userData.sharpMat) {
        m.userData.sharpMat = m.material;
        m.material = m.material.clone();
        m.material.transparent = true;
        m.material.depthWrite = false;
      }
      // глаз сфокусирован на мушке: близкий диоптр размыт и «просвечивает»
      m.material.opacity = 1 - 0.62 * k;
    });
  }
  // Диоптр вблизи глаза: глаз держит в фокусе мушку, барабан вокруг отверстия размыт.
  // Размытие — backdrop-filter по маске-кольцу, радиус отверстия считается из геометрии.
  const ghost = document.createElement("div");
  ghost.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:5;opacity:0;transition:none";
  document.body.appendChild(ghost);
  let ghostKey = "";
  function ghostRing(p, k) {
    if (!p || k < 0.02) {
      if (ghostKey) ghost.style.opacity = "0", ghostKey = "";
      return;
    }
    const rh = p.s.apertureR ?? 1.8, d = (p.s.eyeDist ?? 75) + 0.5;
    const px = Math.atan(rh / d) / Math.tan(S.camera.fov * D2R2 / 2) * innerHeight / 2;
    const key = Math.round(px) + "|" + k.toFixed(2);
    if (key === ghostKey) return;
    ghostKey = key;
    const r0 = px * 0.92, r1 = px * 1.35;
    const m = `radial-gradient(circle at 50% 50%, transparent ${r0}px, #000 ${r1}px)`;
    ghost.style.backdropFilter = ghost.style.webkitBackdropFilter = `blur(${(9 * k).toFixed(1)}px) brightness(${(1 - 0.25 * k).toFixed(2)})`;
    ghost.style.maskImage = ghost.style.webkitMaskImage = m;
    ghost.style.opacity = String(Math.min(1, k * 1.2));
  }
  function update(dt) {
    tw.update(dt);
    const now = performance.now() / 1e3;
    if (st.burstLeft > 0 && st.mode === "burst" && now >= (st.nextShot || 0)) {
      if (st.chambered && canFire()) {
        fireOnce();
        st.nextShot = Math.max(now, st.nextShot || now) + 60 / (st.stats.rpm || def.base.rpm);
        st.burstLeft--;
      } else st.burstLeft = 0;
    }
    if (st.trigger && st.held && st.mode === "auto" && canFire() && st.chambered && now >= (st.nextShot || 0)) {
      fireOnce();
      st.nextShot = Math.max(now, st.nextShot || now) + 60 / (st.stats.rpm || def.base.rpm);
    }
    if (st.trigger && st.mode === "auto" && !st.chambered && st.held && now >= (st.nextShot || 0)) {
      audio.dryFire();
      st.held = false;
    }
    const r = st.rec;
    const k = 180, d = 20;
    r.vp += (-k * r.p - d * r.vp) * dt;
    r.p += r.vp * dt;
    r.vy += (-k * r.y - d * r.vy) * dt;
    r.y += r.vy * dt;
    r.vz += (-260 * r.z - 26 * r.vz) * dt;
    r.z += r.vz * dt;
    st.climb *= Math.pow(0.12, dt);
    if (st.ads) {
      const ty = -(pointer.x - 0.5) * 0.55, tp = -(pointer.y - 0.5) * 0.35;
      st.yaw = lerp(st.yaw, ty, 1 - Math.pow(1e-3, dt));
      st.pitch = lerp(st.pitch, tp, 1 - Math.pow(1e-3, dt));
    } else {
      st.yaw = lerp(st.yaw, 0, 1 - Math.pow(0.01, dt));
      st.pitch = lerp(st.pitch, 0, 1 - Math.pow(0.01, dt));
    }
    const cs = sights[st.sightIdx];
    const cant = st.adsT > 0 && cs?.up ? -Math.atan2(cs.up.z, cs.up.y) * ease(st.adsT) : 0;
    aim.rotation.set(cant, st.yaw, st.pitch + st.climb, "YZX");
    rig.position.set(-r.z * 1e-3 * 12 + pivotX * 0, 0, 0);
    rig.rotation.set(0, r.y * D2R2 * 0.6, r.p * D2R2 * 0.5);
    rig.position.x -= pivotX * (Math.cos(r.p * D2R2 * 0.5) - 1);
    rig.position.y = -pivotX * Math.sin(r.p * D2R2 * 0.5);
    st.adsT = clamp(st.adsT + (st.ads ? 1 : -1) * dt / ((st.stats.adsTime || 280) / 1e3 + 0.05), 0, 1);
    if (st.adsT > 0) {
      const p = sightPose(adsPose);
      if (p) {
        aim.updateMatrixWorld();
        const wpos = p.pos.clone().applyMatrix4(aim.matrixWorld);
        eulerTmp.set(0, r.y * D2R2 * 0.15, r.p * D2R2 * 0.22, "YZX");
        camKick.setFromEuler(eulerTmp);
        const wq = aim.getWorldQuaternion(new THREE8.Quaternion()).multiply(camKick).multiply(p.quat);
        const e = ease(st.adsT);
        S.camera.position.lerpVectors(orbitPose.pos, wpos, e);
        S.camera.quaternion.slerpQuaternions(orbitPose.quat, wq, e);
        S.camera.fov = lerp(baseFov, p.fov, e);
        st.viewOff = lerp(st.viewOff || 0, 0, e);
        applyViewOffset();
        S.camera.updateProjectionMatrix();
        const magnified = p.mag > 1.5 && st.adsT > 0.92;
        gun.visible = !magnified;
        ui?.scope(magnified ? p : null, st.adsT > 0.92 ? p : null);
        const nv = !!p.s.nv && !st.magAside && st.adsT > 0.85;
        ui?.nv(nv);
        for (const q of sights) if (q.hide) q.hide.visible = !(nv && q === p.s);
        ghostRing(p.s.irons && p.s.type === "aperture" ? p : null, e);
      }
      if (!st.ads && st.adsT === 0) {
        controls.enabled = true;
      }
    } else {
      if (S.camera.fov !== baseFov) {
        S.camera.fov = baseFov;
        S.camera.updateProjectionMatrix();
      }
      const off = ui ? ui.viewOffset() : 0;
      st.viewOff = lerp(st.viewOff || 0, off, 1 - Math.pow(0.01, dt));
      gun.visible = true;
      ui?.scope(null, null);
      ui?.nv(false);
      for (const q of sights) if (q.hide) q.hide.visible = true;
      if (defocused) restoreFocus();
      ghostRing(null, 0);
      controls.enabled = true;
      controls.target.lerp(focusTarget, 1 - Math.pow(0.02, dt));
      if (focusDist) {
        const off2 = S.camera.position.clone().sub(controls.target);
        const l = off2.length();
        if (Math.abs(l - focusDist) > 0.01) S.camera.position.copy(controls.target).addScaledVector(off2.normalize(), lerp(l, focusDist, 1 - Math.pow(0.05, dt)));
      }
      applyViewOffset();
      controls.update();
    }
    gun.updateMatrixWorld(true);
    drainBatteries(dt);
    // каждый включённый излучатель — свой луч (до двух фонарей и двух ЛЦУ)
    const tNow = performance.now() / 1e3;
    let ti = 0, beamE = 0;
    for (const L of lights) {
      if (!isOn(L, "light") || ti > 1) continue;
      const p = L.obj.localToWorld(new THREE8.Vector3(...L.data.p));
      const dv = new THREE8.Vector3(1, 0, 0).transformDirection(L.obj.matrixWorld);
      const b = beamOf(L.data);
      b.cd = b.candela * LUX;
      const lo = lightOutput(st.batt[battKey(L)] ?? 1, powerOf(L).driver, tNow + ti * 3.7);
      ray.set(p, dv);
      ray.far = 150;
      const h = ray.intersectObjects(S.range.hitables, false)[0];
      const dist = h ? h.distance : 150;
      fx.setLight({ pos: p, dir: dv, beam: b, k: lo.k, warm: lo.warm, dist, hit: h?.point, hitColor: h?.object.material?.color, cam: S.camera, exposure: st.exposure }, ti++);
      // освещённость в кадре от пятна — для адаптации глаза
      const half = Math.tan(S.camera.fov * D2R2 / 2);
      const cover = Math.min(1, (Math.tan(b.hot * 1.6) / half) ** 2);
      const E = b.cd * lo.k / Math.max(0.35, dist) ** 2;
      beamE += E * 0.5 * (cover + b.spillK) + E * 0.6 * 0.35;
    }
    for (; ti < 2; ti++) fx.setLight(null, ti);
    let zi = 0;
    for (const L of lasers) {
      if (!isOn(L, "laser") || zi > 1) continue;
      const p = L.obj.localToWorld(new THREE8.Vector3(...L.data.p));
      const dv = new THREE8.Vector3(1, 0, 0).transformDirection(L.obj.matrixWorld);
      const zk = laserOutput(st.batt[battKey(L)] ?? 1, tNow + zi * 2.3);
      fx.setLaser({ pos: p, dir: dv, hitables: S.range.hitables, color: L.data.color ?? 16722458, k: zk, night: st.night }, zi++);
    }
    for (; zi < 2; zi++) fx.setLaser(null, zi);
    // адаптация глаза: к темноте — секунды, к яркому — доли секунды
    const amb = S.ambient();
    const Lsc = amb * 0.5 + beamE;
    st.expTarget = clamp(Math.pow(1.2 / Math.max(1e-5, Lsc), 0.62), 0.32, 11);
    const nvOn = document.body.classList.contains("nv");
    const tgt = st.expTarget * (nvOn ? 18 : 1);
    const tau = tgt > st.exposure ? 2.2 : 0.22;
    st.exposure += (tgt - st.exposure) * (1 - Math.exp(-dt / tau));
    if (Math.abs(tgt - st.exposure) < 1e-3) st.exposure = tgt;
    S.renderer.toneMappingExposure = st.exposure;
    fx.setAmbient(amb / 2.2);
    ball.update(dt, S.range.hitables, fx.wind);
    fx.bullets(ball.list, st.trace, S.camera);
    fx.update(dt, (s, n) => audio.casing(0, s.kind, n > 1 ? 0.35 : 0.8), S.camera, fx.heat > 0.3 ? muzzleWorld(mzTmp) : null);
    S.range.update(dt);
  }
  const app = {
    def,
    asm,
    st,
    S,
    gun,
    rig,
    aim,
    fx,
    audio,
    mats,
    get cfg() {
      return cfg;
    },
    get sights() {
      return sights;
    },
    setPart,
    railMove,
    railInfo,
    resetCfg,
    focusSlot,
    unfocus,
    triggerDown,
    triggerUp,
    reload,
    cycleMode,
    setADS,
    cycleSight,
    toggleMagnifier,
    toggleLight,
    toggleLaser,
    emitterList,
    cycleReticle,
    cycleReticleColor,
    reticleInfo,
    cycleTrace,
    get ball() {
      return ball;
    },
    replaceBatteries,
    battInfo,
    cycleTime,
    setNight,
    get time() {
      return st.night ? "night" : "day";
    },
    timeLabel: () => TIME_LABEL[st.night ? "night" : "day"],
    toggleBipod,
    toggleFold,
    toggleMag,
    charge: () => keys.KeyT(),
    toggleSound: () => {
      audio.init();
      audio.setMuted(!audio.muted);
      ui?.hud();
    },
    defaultStats: null
  };
  let start = def.defaults;
  try {
    const sv = JSON.parse(localStorage.getItem(LS) || "null");
    if (sv) start = { ...def.defaults, ...sv };
  } catch (e) {
  }
  const qs = new URLSearchParams(location.search);
  if (qs.get("cfg")) {
    try {
      start = { ...def.defaults, ...JSON.parse(qs.get("cfg")) };
    } catch (e) {
      console.error("cfg", e);
    }
  }
  {
    let tm = qs.get("time") || qs.get("night");
    try {
      tm = tm || (localStorage.getItem("gunsmith:night") === "1" ? "night" : "day");
    } catch (e) {
    }
    setNight(tm === "night" || tm === "1", true);
  }
  applyConfig(def.defaults, { init: true });
  app.defaultStats = { ...st.stats };
  applyConfig(start, { init: true });
  poseSelector(true);
  ui = new UI(app);
  ui.refresh();
  const setView = (v, zoom = 1) => {
    const t = controls.target, dd = f.size / 1e3 * 1.25 / zoom;
    const V = { right: [0, 0.05, 1], left: [0, 0.05, -1], top: [0, 1, 1e-3], front: [1, 0.1, 0.02], back: [-1, 0.1, 0.02], iso: [-0.5, 0.35, 0.8], isoL: [-0.5, 0.35, -0.8], under: [0, -1, 1e-3] }[v] || [-0.15, 0.13, 1];
    const l = Math.hypot(...V);
    S.camera.position.set(t.x + V[0] / l * dd, t.y + V[1] / l * dd, t.z + V[2] / l * dd);
    controls.update();
  };
  if (qs.get("at")) {
    const a = qs.get("at").split(",").map(Number);
    controls.target.set(a[0] / 1e3, GUN_Y + a[1] / 1e3, (a[2] || 0) / 1e3);
    focusTarget.copy(controls.target);
    homeTarget.copy(controls.target);
  }
  if (qs.get("view") || qs.get("zoom") || qs.get("at")) setView(qs.get("view"), +(qs.get("zoom") || 1));
  if (qs.get("ads")) {
    setADS(true);
    st.adsT = 1;
  }
  if (qs.get("ui") === "0") document.body.classList.add("noui");
  app.setView = setView;
  // Прогрев шейдеров: вспышка, дым, искры, гильзы, пробоины и следы пуль компилировались в момент
  // первого выстрела — фриз на секунды на слабой видеокарте. Прогоняем их один кадр под экраном загрузки.
  function prewarm() {
    const V = THREE8.Vector3, p = muzzleWorld(new V(), tmp2), d = tmp2.clone();
    gun.getWorldQuaternion(tq);
    fx.muzzleFlash(p, d, "brake", 1, tq, {});
    fx.shell(p.clone(), new V(0, 1, 0), def.cal, tq, false);
    fx.shell(p.clone(), new V(0, 1, 0), def.cal, tq, true);
    const tgt = S.range.hitables[0];
    if (tgt) {
      tgt.updateWorldMatrix(true, false);
      const hp = new V().setFromMatrixPosition(tgt.matrixWorld);
      for (const surf of ["steel", "dirt"]) fx.impact({ point: hp, object: tgt }, surf, { v: 800 });
    }
    const fake = { p: p.clone().addScaledVector(d, 30), v: d.clone().multiplyScalar(800), origin: p.clone(), alive: true, tracer: true, spec: bulletNow() };
    fx.bullets([fake, { ...fake, tracer: false }], "trace", S.camera);
    const vis = fx.flash.visible;
    S.render();
    fx.flash.visible = vis;
    // всё созданное — убрать
    fx.flash.visible = false;
    fx.flashT = 0;
    fx.flashLight.intensity = 0;
    fx.heat = fx.haze = 0;
    fx.smoke.pool.push(...fx.smoke.list.splice(0));
    fx.fire.pool.push(...fx.fire.list.splice(0));
    fx.smoke.mesh.geometry.instanceCount = fx.fire.mesh.geometry.instanceCount = 0;
    for (const s of fx.shells) s.alive = false;
    for (const m of fx.inst.values()) m.count = 0;
    for (const h of fx.holes.splice(0)) h.parent?.remove(h);
    fx.bullets([], "off", S.camera);
  }
  try {
    prewarm();
  } catch (e) {
    console.warn("prewarm", e);
  }
  if (window.requestIdleCallback) requestIdleCallback(() => audio.prewarm?.(), { timeout: 4e3 });
  else setTimeout(() => audio.prewarm?.(), 1500);
  const bootEl = document.getElementById("boot");
  if (bootEl) bootEl.classList.add("off");
  window.__app = app;
  const R4 = S.renderer;
  R4.shadowMap.autoUpdate = false;
  R4.shadowMap.needsUpdate = true;
  let camDirty = true, sceneDirty = true, idleT = 0;
  controls.addEventListener("change", () => {
    camDirty = true;
  });
  addEventListener("resize", () => {
    camDirty = true;
    sceneDirty = true;
  });
  app.invalidate = () => {
    sceneDirty = true;
  };
  /* ---------------------------------------------------------- качество картинки */
  // Стартовый уровень — по видеокарте: программный рендер и телефоны — «низкое», встроенная графика —
  // «среднее», дискретная — «высокое» (исходная картинка). Дальше уровень подстраивается по времени
  // кадра: сначала снижается плотность пикселей, потом уровень. Q — авто/высокое/среднее/низкое.
  function gpuTier() {
    try {
      const gl = R4.getContext(), ext = gl.getExtension("WEBGL_debug_renderer_info");
      const r = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER)).toLowerCase();
      if (/swiftshader|llvmpipe|softpipe|basic render|software/.test(r)) return 0;
      if (/android|iphone|ipad|mobile/i.test(navigator.userAgent)) return 0;
      if ((navigator.deviceMemory || 8) <= 2 || (navigator.hardwareConcurrency || 8) <= 2) return 0;
      // старая встроенная графика (HD/UHD 5xx–6xx, Vega 3/8) — с «низкого»: дальше уровень сам
      // поднимется, если кадр стабильно быстрый
      if (/hd graphics|uhd graphics [56]\d\d|uhd graphics\)|gma|vega [38] graphics|radeon r[2-5]/.test(r)) return 0;
      if (/intel|uhd|iris|mali|adreno|powervr|radeon\(tm\) graphics|vega \d+ graphics/.test(r)) return 1;
      if ((navigator.deviceMemory || 8) <= 4 || (navigator.hardwareConcurrency || 8) <= 4) return 1;
      return 2;
    } catch (e) {
      return 1;
    }
  }
  const Q_MODES = ["auto", "high", "mid", "low"], Q_LABEL = { auto: "авто", high: "высокое", mid: "среднее", low: "низкое" };
  const Q_INDEX = { low: 0, mid: 1, high: 2 };
  let qMode = qs.get("q");
  try {
    qMode = qMode || localStorage.getItem("gunsmith:quality");
  } catch (e) {
  }
  if (!Q_MODES.includes(qMode)) qMode = "auto";
  const qAuto = gpuTier();
  let qLevel = qMode === "auto" ? qAuto : Q_INDEX[qMode];
  let maxDpr = 1, minDpr = 0.6, fastStreak = 0;
  function applyQuality(i) {
    qLevel = i;
    const q = S.setQuality(i);
    fx.setQuality(q);
    // картинка в оптике: на «низком» — до 256² и через кадр, пока камера движется
    pip.maxSize = i === 0 ? 256 : i === 1 ? 384 : 512;
    pip.every = i === 0 ? 2 : 1;
    maxDpr = Math.min(devicePixelRatio || 1, q.dpr);
    minDpr = Math.max(0.6, maxDpr * 0.6);
    activeDpr = Math.min(Math.max(activeDpr, minDpr), maxDpr);
    R4.shadowMap.needsUpdate = true;
    sceneDirty = true;
  }
  function cycleQuality() {
    qMode = Q_MODES[(Q_MODES.indexOf(qMode) + 1) % Q_MODES.length];
    try {
      localStorage.setItem("gunsmith:quality", qMode);
    } catch (e) {
    }
    activeDpr = 9;
    applyQuality(qMode === "auto" ? qAuto : Q_INDEX[qMode]);
    ui?.toast("Качество: " + Q_LABEL[qMode] + (qMode === "auto" ? " (" + S.quality.label.toLowerCase() + ")" : ""));
  }
  let activeDpr = 9, curDpr = R4.getPixelRatio(), fts = [], ftT = 0, slowStreak = 0, adaptN = 0;
  // потолок авто-подъёма: не выше уровня, с которого уже пришлось спускаться
  let qCeil = 2;
  applyQuality(qLevel);
  const bootT = performance.now();
  const gunPrev = new THREE8.Matrix4();
  const setDpr = (v) => {
    if (Math.abs(v - curDpr) < 0.01) return;
    curDpr = v;
    R4.setPixelRatio(v);
    R4.setSize(innerWidth, innerHeight);
    S.resize();
  };
  function simBusy() {
    const r = st.rec;
    if (st.ads || st.adsT > 0 || st.trigger || st.busy || st.burstLeft || st.light || st.laser || tw.list.length || ball.active || fx.active()) return true;
    if (Math.abs(r.p) + Math.abs(r.y) + Math.abs(r.z) + Math.abs(r.vp) + Math.abs(r.vy) + Math.abs(r.vz) > 1e-3 || st.climb > 1e-4) return true;
    for (const t of S.range.targets) if (Math.abs(t.userData.vel) + Math.abs(t.userData.swing) > 1e-4) return true;
    return false;
  }
  function adapt(raw) {
    if (performance.now() - bootT < 1500) return;
    if (raw < 0.25) fts.push(raw);
    ftT += raw;
    // первые замеры — короче: на слабой машине лаг не должен тянуться секундами
    const win = adaptN < 3 ? 0.6 : 1.5;
    if (ftT < win || fts.length < 8) return;
    adaptN++;
    fts.sort((a, b) => a - b);
    const med = fts[fts.length >> 1];
    fts = [];
    ftT = 0;
    let next = activeDpr;
    if (med > 1 / 40) {
      slowStreak++;
      fastStreak = 0;
      next = Math.max(minDpr, activeDpr * (med > 1 / 25 ? 0.8 : 0.9));
    } else {
      slowStreak = 0;
      if (med < 1 / 55) {
        next = Math.min(maxDpr, activeDpr * 1.1);
        fastStreak++;
      } else fastStreak = 0;
    }
    activeDpr = next;
    // в режиме «авто»: сильно медленно (< 25 к/с) — сразу уровень ниже; упёрлись в минимальную
    // плотность — уровень ниже; стабильно быстро — выше, вплоть до «высокого» (исходная картинка)
    const verySlow = med > 1 / 25 && adaptN <= 4;
    if (qMode === "auto" && qLevel > 0 && (verySlow || slowStreak >= 3 && activeDpr <= minDpr + 1e-3)) {
      slowStreak = 0;
      applyQuality(qLevel - 1);
      activeDpr = verySlow ? minDpr : maxDpr;
      qCeil = Math.min(qCeil, qLevel);
    } else if (qMode === "auto" && fastStreak >= 6 && activeDpr >= maxDpr - 1e-3 && qLevel < qCeil) {
      fastStreak = 0;
      applyQuality(qLevel + 1);
    }
  }
  // пошаговый кадр для отладки и скриншотов (при window.__pause основной цикл стоит)
  app.step = (dt = 1 / 60, n = 1) => {
    for (let i = 0; i < n; i++) update(dt);
    gun.updateMatrixWorld();
    R4.shadowMap.needsUpdate = true;
    pipFrame();
    S.render();
  };
  app.quality = () => ({ mode: qMode, level: S.quality.id, auto: qAuto, activeDpr, curDpr, maxDpr, shadow: S.sun.shadow.mapSize.x });
  app.cycleQuality = cycleQuality;
  app.setQuality = (m) => {
    qMode = Q_MODES[(Q_MODES.indexOf(m) + Q_MODES.length - 1) % Q_MODES.length];
    cycleQuality();
  };
  /* ---------------------------------------------------------- картинка в оптике вне прицеливания */
  const pipDir = new THREE8.Vector3(), pipUp = new THREE8.Vector3();
  function pipFrame() {
    const cur = sights[st.sightIdx];
    const mags = st.adsT > 0 ? [] : sights.filter((s) => (s.zoom || s.mag > 1.2) && !(s.id === "magnifier" && st.magAside));
    const s = mags.includes(cur) ? cur : mags[0];
    const lens = s && (s.id === "magnifier" ? asm.installed.get("magnifier")?.info?.sight?.lens : s.src?.lens);
    if (!lens) return pip.release();
    const bs = s.id === "magnifier" ? sights[0] : s;
    const x0 = bs.src?.x0 ?? 0, x1 = bs.src?.x1 ?? x0 + 60;
    const pos = gun.localToWorld(bs.eye.clone().addScaledVector(bs.dir, x1 - x0 + 4));
    pipDir.copy(s.dir).transformDirection(gun.matrixWorld);
    pipUp.copy(s.up || Y_UP).transformDirection(gun.matrixWorld);
    const mag = (s.zoom ? st.zoom : s.mag) * (s === cur && !s.zoom ? st.zoomMul : 1);
    // поле как у круга оптики в прицеливании: 0,84 высоты кадра при baseFov / кратность
    const fov = 0.84 * baseFov / Math.max(1, mag);
    const rs = s.id === "magnifier" ? sights[0] : s;
    const r = retOf(rs), rdef = r && RETICLES[r.id];
    let retK = 1;
    if (rdef) {
      const sfp = s.zoom && !s.withMag ? s.zoom[1] / mag : 1;
      retK = fov * 60 / (rdef.field * sfp * (rdef.mag ? 1 : rdef.boost || 1));
      // окуляр на экране мал: сетка в честном масштабе (шеврон ACOG — 1 % линзы) не видна
      retK = Math.min(retK, 3.2);
    }
    pip.render({ lens, gun, pos, dir: pipDir, up: pipUp, fov, retTex: rs.src?.retMesh?.material.map, retK, retMesh: s.id === "magnifier" ? null : rs.src?.retMesh }, S.camera, innerHeight);
  }
  app.pip = pip;
  const loop = () => {
    requestAnimationFrame(loop);
    if (window.__pause) return;
    const raw = clock.getDelta();
    const dt = Math.min(raw, 0.05);
    update(dt);
    const busy = simBusy();
    const active = busy || camDirty;
    idleT = active ? 0 : idleT + raw;
    const still = !active && idleT > 0.35 && curDpr !== maxDpr;
    if (!active && !sceneDirty && !still) return;
    if (active) {
      setDpr(activeDpr);
      adapt(raw);
    } else {
      setDpr(maxDpr);
      fts = [];
      ftT = 0;
    }
    gun.updateMatrixWorld();
    if (busy || sceneDirty || !gunPrev.equals(gun.matrixWorld)) R4.shadowMap.needsUpdate = true;
    gunPrev.copy(gun.matrixWorld);
    camDirty = false;
    sceneDirty = false;
    pipFrame();
    S.render();
  };
  loop();
  return app;
}

