var common_exports = {};
__export(common_exports, {
  CAL: () => CAL,
  bulletGeo: () => bulletGeo,
  capScrew: () => capScrew,
  cartridge: () => cartridge,
  caseGeo: () => caseGeo,
  clampBody: () => clampBody,
  crimpStar: () => crimpStar,
  crossBolt: () => crossBolt,
  feedLips: () => feedLips,
  flipCap: () => flipCap,
  hashMarks: () => hashMarks,
  hollowLathe: () => hollowLathe,
  knob: () => knob,
  latheMod: () => latheMod,
  lensDisc: () => lensDisc,
  qdLever: () => qdLever,
  sectorRing: () => sectorRing,
  shotHead: () => shotHead,
  shotHull: () => shotHull,
  thumbNut: () => thumbNut,
  turret: () => turret
});
// Зажим на Пикатинни: в торце виден профиль планки (ласточкин хвост 45°), губки заходят под полки.
function clampBody(x0, x1, y1, o = {}) {
  const w = (o.w ?? 26) / 2, jaw = o.jaw ?? -6.6, r = o.r ?? 1.2;
  const tip = Math.max(7.9, 10.9 - Math.max(0, -3.3 - jaw));
  const sec = [[-w, jaw, 1], [-tip, jaw], [-10.9, -3.2], [-10.9, -2.9], [-8, 0.05], [8, 0.05], [10.9, -2.9], [10.9, -3.2], [tip, jaw], [w, jaw, 1], [w, y1, r], [-w, y1, r]];
  return extrudeX(sec, x0, x1, { bevel: o.bevel ?? 0.8 });
}
// Поперечный болт зажима: шестигранная гайка справа, головка под шестигранник слева.
function crossBolt(x, y = -2.5, w = 13, o = {}) {
  const out = [];
  const nutR = o.nutR ?? 4.2, nutH = o.nutH ?? 3.2;
  if (nutR > 0) {
    out.push(T(latheX([[0, 0], [0, nutR - 0.5], [0.4, nutR], [nutH - 0.4, nutR], [nutH, nutR - 0.5], [nutH, 0]], { seg: 6, crease: 30 }), { r: [0, -90, 0], p: [x, y, w] }));
    out.push(T(latheX([[0, 0], [0, 1.9], [1.1, 1.8], [1.4, 1.2], [1.4, 0]], { seg: 12 }), { r: [0, -90, 0], p: [x, y, w + nutH] }));
  }
  const hr = o.headR ?? 3.4, h = 2;
  out.push(T(latheX([[0, 0], [0, hr], [h - 0.5, hr], [h, hr - 0.5], [h, 1.7], [h - 0.9, 1.4], [h - 0.9, 0]], { seg: 18 }), { r: [0, 90, 0], p: [x, y, -w] }));
  return out;
}
// Быстросъёмный рычаг (ADM/LaRue): изогнутый рычаг вдоль левого борта, ось с гайкой натяжения.
function qdLever(x0, x1, y, w = 13) {
  const len = x1 - x0;
  const pro = [[0, 1.2, 1.2], [len * 0.55, -0.4, 6], [len, 0.6, 2.4], [len, 6.4, 3], [len * 0.62, 5.6, 8], [len * 0.12, 7.4, 2.6], [0, 5.2, 1.4]];
  const g = extrudeZ(pro, 3.2, { bevel: 0.9, curve: 8 });
  const pivot = latheX([[0, 0], [0, 4.2], [0.5, 4.6], [2.6, 4.6], [3.1, 4.1], [3.1, 2], [3.5, 1.6], [3.5, 0]], { seg: 20 });
  const grip = [];
  for (let i = 0; i < 4; i++) grip.push(T(box(0.9, 1, 1.2, { bevel: 0.25 }), { p: [x0 + 2.2 + i * 1.6, y - 3 + 5.6 - i * 0.05, -w - 3.4] }));
  return [T(g, { p: [x0, y - 3, -w - 1.6] }), T(pivot, { r: [0, 90, 0], p: [x1 - 3, y, -w - 0.6] }), ...grip];
}
// Рифлёный барабан вдоль +x: юбка, насечка, гладкая крышка с фаской и винтом по центру.
function knob(r, h, grooves = 24, o = {}) {
  const lip = o.lipH ?? 0.8;
  const gs = [latheX([[0, 0], [0, r - 0.9], [0.4, r - 0.6], [h - lip - 0.2, r - 0.6], [h - lip, r - 0.9], [h - 0.35, r - 1.1], [h, r - 1.5], [h, 1.2], [h - 0.35, 1.1], [h - 0.35, 0]], { seg: Math.max(24, grooves + 8) })];
  if (grooves) gs.push(flutesX(r - 0.9, 0.6, h - lip - 0.2, grooves, 1.1, 0.9));
  return merge(gs);
}
// Откидная крышка Butler Creek: чашка с бортиком, шарнир с осью и язычок под палец.
function flipCap(r, t = 2.4) {
  const disc = latheX([[0, 0], [0, r + 1.3], [0.4, r + 1.7], [t, r + 1.7], [t, r + 0.4], [t - 0.6, r], [t - 0.6, 0]], { seg: 32 });
  const hinge = T(box(6, 5, 10, { bevel: 1 }), { p: [t / 2, r + 3, 0] });
  const pinG = T(cylZ(1.4, -6, 6, { seg: 10 }), { p: [t / 2, r + 4.2, 0] });
  const tab = T(extrudeZ([[-1.5, 0, 0.5], [1.5, 0, 0.5], [1.2, 7, 1.2], [-1.8, 7, 1.2]], 8, { bevel: 0.8 }), { p: [t / 2, -r - 7.4, 0] });
  return merge([disc, hinge, pinG, tab]);
}
function lensDisc(r, x, t = 1.2) {
  return cylX(r, x - t / 2, x + t / 2, { c: 0.2, seg: 32 });
}
function hollowLathe(prof, rIn, o = {}) {
  const x0 = prof[0][0], x1 = prof[prof.length - 1][0];
  const inner = typeof rIn === "number" ? [[x1, rIn], [x0, rIn]] : rIn.slice().reverse();
  return latheX([[x0, inner[inner.length - 1][1]], ...prof, ...inner, [x0, inner[inner.length - 1][1]]], o);
}
// Винт с внутренним шестигранником, ось +y, головка над y=0.
function capScrew(r = 1.8, h = 1.2) {
  return T(latheX([[0, 0], [0, r], [h * 0.7, r], [h, r * 0.8], [h, r * 0.55], [h - 0.5, r * 0.45], [h - 0.5, 0]], { seg: 12, crease: 50 }), { r: [0, 0, 90] });
}
// Барашек/гайка с крупными лепестками, ось +x (зажимы кронштейнов, ПСО, сошки).
function thumbNut(r, h, lobes = 8) {
  const pts = [];
  for (let i = 0; i < lobes * 6; i++) {
    const a = i / (lobes * 6) * Math.PI * 2;
    const k = 0.84 + 0.16 * Math.pow(Math.abs(Math.cos(a * lobes / 2)), 0.6);
    pts.push([Math.cos(a) * r * k, Math.sin(a) * r * k]);
  }
  return merge([extrudeX(pts, 0, h, { bevel: 0.5, curve: 2 }), cylX(r * 0.55, h - 0.2, h + 1.2, { c: 0.4, seg: 20 })]);
}
// Штрихи шкалы по окружности радиуса r на участке оси x (ось +x). major — каждый n-й длиннее.
function hashMarks(r, xm, n, o = {}) {
  const gs = [], arc = o.arc ?? 360, a0 = o.a0 ?? 0, len = o.len ?? 1.6, maj = o.major ?? 5;
  for (let i = 0; i < n; i++) {
    const L = i % maj === 0 ? len * 1.9 : len;
    const g = T(box(L, 0.3, o.w ?? 0.34, { bevel: 0.08 }), { p: [xm + (o.dir ?? 1) * (L - len) / 2, r, 0] });
    gs.push(T(g, { r: [a0 + i / n * arc, 0, 0] }));
  }
  return merge(gs);
}
// Барабан поправок прицела (ось +y, основание на y=0): юбка-основание, нулевой упор,
// рифлёная крышка, штрихи шкалы и цифровые метки. Возвращает { m: металл, w: белая краска }.
function turret(o) {
  const r = o.r, h = o.h ?? r * 0.9, base = o.base ?? 3, rb = o.rb ?? r + 0.6;
  const m = [], w = [];
  const up = (g) => T(g, { r: [0, 0, 90] });
  if (o.cap) {
    // закрытый колпачок (ACOG, Aimpoint): гладкий цилиндр с насечкой и торцевой фаской
    m.push(up(latheX([[0, 0], [0, rb], [base, rb], [base, r], [base + h - 1, r], [base + h, r - 1], [base + h, 0]], { seg: 32 })));
    m.push(up(flutesX(r - 0.35, base + 1, base + h - 1.6, o.knurl ?? 28, 1, 0.7)));
    m.push(up(latheX([[base + h - 0.2, 0], [base + h - 0.2, r * 0.45], [base + h + 0.5, r * 0.45], [base + h + 0.5, r * 0.3], [base + h + 0.2, r * 0.25], [base + h + 0.2, 0]], { seg: 16 })));
    return { m, w };
  }
  const zs = o.zero ?? 1.2;
  m.push(up(latheX([[0, 0], [0, rb], [base, rb], [base, r - 0.8], [base + zs, r - 0.8], [base + zs, r], [base + h - 1.2, r], [base + h, r - 1.2], [base + h, r * 0.5], [base + h + 1.2, r * 0.45], [base + h + 1.2, 0]], { seg: 40, crease: 50 })));
  const kn0 = base + zs + h * 0.42, kn1 = base + h - 1.4;
  m.push(up(flutesX(r - 0.35, kn0, kn1, o.knurl ?? 40, 1.1, 0.75)));
  const marks = o.marks ?? 40;
  if (marks) {
    w.push(up(hashMarks(r + 0.02, base + zs + (o.markLen ?? 1.5) / 2 + 0.15, marks, { len: o.markLen ?? 1.5, major: o.major ?? 5, dir: 1 })));
    // индексная линия на основании
    w.push(up(T(box(base * 0.8, 0.35, 0.5, { bevel: 0.08 }), { p: [base * 0.45, rb + 0.02, 0] })));
  }
  return { m, w };
}
// Кольцевые секторы (сплошные, с боковыми стенками) вдоль оси x: прорези пламегасителей, окна ДТК.
// Углы в градусах: 0 — вверх (+y), 90 — вправо (+z).
function sectorRing(ri, ro, x0, x1, sectors, o = {}) {
  const gs = [];
  for (const [a0, a1] of sectors) {
    const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / (o.step ?? 8)));
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const a = (a0 + (a1 - a0) * i / n) * D2R;
      pts.push([Math.sin(a) * ro, Math.cos(a) * ro]);
    }
    for (let i = n; i >= 0; i--) {
      const a = (a0 + (a1 - a0) * i / n) * D2R;
      pts.push([Math.sin(a) * ri, Math.cos(a) * ri]);
    }
    gs.push(extrudeX(pts, x0, x1, { bevel: o.bevel ?? 0.3, curve: 2, crease: 40 }));
  }
  return merge(gs);
}
// Тело вращения с радиальной модуляцией dr(x, a) — рёбра гильзы, гофры; нормали по излому.
function latheMod(prof, seg, dr) {
  const pos = [], idx = [];
  const m = prof.length;
  for (let i = 0; i < m; i++) for (let j = 0; j <= seg; j++) {
    const a = j / seg * Math.PI * 2, [x, r] = prof[i];
    const rr = r + (r > 0.01 ? dr(x, a, r) : 0);
    pos.push(x, rr * Math.cos(a), rr * Math.sin(a));
  }
  for (let i = 0; i < m - 1; i++) for (let j = 0; j < seg; j++) {
    const a = i * (seg + 1) + j, b = a + 1, c = a + seg + 1, d = c + 1;
    idx.push(a, b, c, c, b, d);
  }
  const g = new THREE3.BufferGeometry();
  g.setAttribute("position", new THREE3.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  const ng = toCreasedNormals(g.toNonIndexed(), 40 * D2R);
  ng.setAttribute("uv", new THREE3.BufferAttribute(new Float32Array(ng.attributes.position.count * 2), 2));
  return ng;
}
// Звёздочная закрутка дробовой гильзы: вогнутый торец с n складками, смотрит в +x.
function crimpStar(R, x, n = 6, depth = 1.6) {
  const seg = n * 8, rings = 7, pos = [], idx = [];
  for (let i = 0; i <= rings; i++) {
    const t = i / rings, r = R * (1 - t);
    for (let j = 0; j <= seg; j++) {
      const a = j / seg * Math.PI * 2;
      const fold = Math.pow(Math.abs(Math.cos(a * n / 2)), 3);
      const d = depth * Math.pow(Math.sin(t * Math.PI * 0.5), 0.8) + fold * 0.55 * Math.sin(t * Math.PI);
      pos.push(x - d, r * Math.cos(a), r * Math.sin(a));
    }
  }
  for (let i = 0; i < rings; i++) for (let j = 0; j < seg; j++) {
    const a = i * (seg + 1) + j, b = a + 1, c = a + seg + 1, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE3.BufferGeometry();
  g.setAttribute("position", new THREE3.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  const ng = toCreasedNormals(g.toNonIndexed(), 50 * D2R);
  ng.setAttribute("uv", new THREE3.BufferAttribute(new Float32Array(ng.attributes.position.count * 2), 2));
  return ng;
}
// Калибры. Базовые поля (L, rim, sh, neck, shX, oal, steel, rimmed, base, shot, head) читает движок.
// Доп. поля: rimT — толщина закраины, groove — Ø проточки экстрактора, ang — угол ската (°),
// pr — Ø капсюля, bd/bl — Ø и длина пули, bt — длина «лодочки», ogL — длина оживала,
// mep — радиус притупления, seal — лак-герметик (капсюль и дульце), tip — окраска носика.
var CAL = {
  "556": { L: 44.7, rim: 9.6, sh: 9, neck: 6.43, shX: 36.5, oal: 57.4, steel: false, base: 9.58, rimT: 1.14, groove: 8.43, ang: 23, pr: 4.45, bd: 5.7, bl: 23.1, bt: 2.2, ogL: 12.4, mep: 0.35, tip: "paintWhite#3d7a3c" },
  "545": { L: 39.8, rim: 10, sh: 9.25, neck: 6.29, shX: 31.5, oal: 57, steel: true, base: 10, rimT: 1.5, groove: 8.6, ang: 28, pr: 4.5, bd: 5.62, bl: 25.5, bt: 2.8, ogL: 15.4, mep: 0.25, seal: "paintRed#8a1f3c" },
  "762x39": { L: 38.6, rim: 11.35, sh: 10.07, neck: 8.6, shX: 30.5, oal: 56, steel: true, base: 11.35, rimT: 1.5, groove: 9.6, ang: 18, pr: 5.5, bd: 7.91, bl: 26.8, bt: 3, ogL: 14.2, mep: 0.5, seal: "paintRed#8a1f3c" },
  "762x51": { L: 51.2, rim: 11.9, sh: 11.53, neck: 8.77, shX: 39.6, oal: 71.1, steel: false, base: 11.96, rimT: 1.37, groove: 10.39, ang: 20, pr: 5.33, bd: 7.82, bl: 28.6, bt: 3.2, ogL: 16.6, mep: 0.5 },
  // 9×19 — слегка коническая гильза без ската, пуля с круглой оживальной головкой, обжим «на конус»
  "9x19": { L: 19.15, rim: 9.96, sh: 9.93, neck: 9.65, shX: 18.4, oal: 29.7, steel: false, base: 9.93, rimT: 1.27, groove: 8.79, taper: true, pr: 4.45, bd: 9.01, bl: 15.5, bt: 0, ogL: 8.6, mep: 1.5 },
  // 7,62×54R — с выступающей закраиной, пуля ЛПС с «лодочкой», капсюль Бердана под лаком
  "762x54R": { L: 53.7, rim: 14.4, base: 12.37, sh: 11.61, neck: 8.53, shX: 42.8, oal: 77.2, steel: true, rimmed: true, rimT: 1.6, ang: 20, pr: 5.5, bd: 7.92, bl: 32.5, bt: 4, ogL: 19.5, mep: 0.5, seal: "paintRed#8a1f3c" },
  // 12/70: латунное донце + пластиковая гильза с рёбрами и звёздочной закруткой
  "12ga": { L: 65, rim: 22.3, sh: 20.5, neck: 20.5, shX: 60, oal: 65, head: 12, shot: true, rimT: 1.5, pr: 6.2 }
};
// Профиль гильзы от донца (x=0) к дульцу: капсюль в гнезде, закраина, проточка, скат, дульце.
function caseProfile(c) {
  const rr = c.rim / 2, rb = (c.base ?? c.rim) / 2, s = c.sh / 2, n = c.neck / 2, t = c.rimT ?? 1.2, pr = (c.pr ?? 4.5) / 2;
  const P = [[0.14, 0], [0.14, pr - 0.3], [0.2, pr - 0.08], [0.45, pr + 0.02], [0.1, pr + 0.28], [0, pr + 0.5], [0, rr - 0.35], [0.3, rr], [t - 0.22, rr], [t, rr - 0.28]];
  let x;
  if (c.rimmed) {
    P.push([t + 0.1, rb + 0.25], [t + 0.6, rb]);
    x = t + 0.6;
  } else {
    const rg = (c.groove ?? c.rim - 1.6) / 2;
    P.push([t + 0.08, rg], [t + 0.75, rg]);
    x = t + 0.75 + (rb - rg) / Math.tan(35 * D2R);
    P.push([x, rb]);
  }
  if (c.taper) {
    P.push([c.L - 1.6, n + 0.05], [c.L - 0.2, n - 0.07], [c.L, n - 0.12]);
  } else {
    const nx = c.shX + (s - n) / Math.tan((c.ang ?? 20) * D2R);
    P.push([c.shX - 0.5, s + 0.01], [c.shX, s - 0.02], [c.shX + 0.25 * (nx - c.shX), s - 0.3 * (s - n)], [nx - 0.3, n + 0.04], [nx, n], [c.L - 0.25, n], [c.L, n - 0.1]);
  }
  const wall = c.taper ? 0.28 : 0.33;
  P.push([c.L, n - wall], [c.L - 4, n - wall - 0.05], [c.L - 4, 0]);
  return P;
}
function caseGeo(cal) {
  const c = CAL[cal] || CAL["556"];
  if (c.shot) return merge([shotHead(c), shotHull(c)]);
  return latheX(caseProfile(c), { seg: 22, crease: 45 });
}
// Профиль пули: «лодочка», ведущая часть с канавкой-каннелюрой у дульца, касательное оживало.
function bulletPts(c) {
  const R = (c.bd ?? c.neck - 0.7) / 2, bl = c.bl ?? c.oal - c.L + 5, x0 = c.oal - bl, xt = c.oal;
  const bt = c.bt ?? 0, ogL = Math.min(c.ogL ?? bl * 0.55, bl - bt - 2), mep = Math.min(c.mep ?? 0.4, R * 0.6);
  const pts = [[x0, 0]];
  if (bt > 0) {
    const rb = R - bt * Math.tan(9 * D2R);
    pts.push([x0, rb - 0.25], [x0 + 0.25, rb], [x0 + bt, R - 0.02], [x0 + bt + 0.4, R]);
  } else pts.push([x0, R - 0.5], [x0 + 0.5, R]);
  const xo = xt - ogL, cx = c.L + 0.35;
  if (!c.taper && cx - 0.7 > x0 + bt + 0.5 && cx + 0.7 < xo) pts.push([cx - 0.6, R], [cx - 0.35, R - 0.14], [cx + 0.35, R - 0.14], [cx + 0.6, R]);
  pts.push([xo, R]);
  const rho = (ogL * ogL + R * R) / (2 * R);
  const um = Math.sqrt(Math.max(0, rho * rho - Math.pow(mep + rho - R, 2)));
  const N = 12;
  for (let i = 1; i <= N; i++) {
    const u = um * (1 - Math.pow(1 - i / N, 1.35));
    pts.push([xo + u * ogL / um, Math.sqrt(Math.max(0, rho * rho - u * u)) - (rho - R)]);
  }
  pts.push([xt, mep * 0.55], [xt, 0]);
  return { pts, R, xt };
}
function bulletGeo(cal) {
  const c = CAL[cal] || CAL["556"];
  return latheX(bulletPts(c).pts, { seg: 18, crease: 50 });
}
// Латунное донце 12 калибра: капсюль-«наковаленка» в чашечке, кольцо клейма, закраина, завальцовка.
function shotHead(c) {
  const r = c.rim / 2, s = c.sh / 2, hb = s + 0.2, t = c.rimT ?? 1.5, H = c.head, pr = (c.pr ?? 6.2) / 2;
  return latheX([
    [0.16, 0], [0.16, pr - 0.9], [0.05, pr - 0.75], [0.05, pr - 0.1], [0.35, pr], [0.02, pr + 0.3], [0, pr + 0.5],
    [0, 6.8], [0.14, 7], [0, 7.2], [0, r - 0.45], [0.4, r], [t - 0.3, r], [t, r - 0.3], [t + 0.35, hb],
    [H - 3.6, hb], [H - 3.3, hb + 0.12], [H - 2.6, hb + 0.12], [H - 2.3, hb], [H - 0.7, hb], [H - 0.15, hb - 0.12], [H, s + 0.02], [H, 0]
  ], { seg: 32, crease: 45 });
}
// Пластиковая гильза: продольные рёбра, закрутка (или раскрывшиеся лепестки у стреляной).
function shotHull(c, fired) {
  const s = c.sh / 2, L = c.L, H = c.head;
  const x0 = H - 0.8, rib0 = H + 1.5, rib1 = L - 3.2;
  const ribs = (x, a) => x > rib0 && x < rib1 ? 0.2 * Math.pow(Math.max(0, Math.cos(a * 12)), 6) : 0;
  if (fired) {
    const E = L + 6;
    return latheMod([[x0, 0], [x0, s - 0.1], [H + 0.2, s], [rib0, s], [(rib0 + rib1) / 2, s], [rib1, s], [E - 4, s + 0.05], [E - 1, s + 0.45], [E, s + 0.6], [E, s], [E - 3, s - 0.55], [H + 2, s - 0.6], [H + 2, 0]], 48, (x, a, r) => x > E - 5 ? 0.25 * Math.cos(a * 6) * (x - (E - 5)) / 5 : r > s - 0.3 ? ribs(x, a) : 0);
  }
  const R0 = s - 1.9;
  const body = latheMod([[x0, 0], [x0, s - 0.1], [H + 0.2, s], [rib0, s], [(rib0 + rib1) / 2, s], [rib1, s], [L - 2.2, s], [L - 1.1, s - 0.35], [L - 0.4, s - 1], [L, R0]], 48, ribs);
  return merge([body, crimpStar(R0, L, 6, 1.7)]);
}
function cartridge(k, cal, t) {
  const c = CAL[cal] || CAL["556"];
  const tt = () => t && { ...t };
  if (c.shot) {
    k.add("brass", shotHead(c), tt());
    k.add("hullRed", shotHull(c), tt());
    return;
  }
  k.add(c.steel ? "steelCase" : "brass", caseGeo(cal), tt());
  const b = bulletPts(c);
  k.add("copper", latheX(b.pts, { seg: 18, crease: 50 }), tt());
  const pr = (c.pr ?? 4.5) / 2, n = c.neck / 2;
  // капсюль: медный у стальных гильз, латунный — у латунных
  k.add(c.steel ? "copper" : "brass", latheX([[0.1, 0], [0.1, pr - 0.3], [0.2, pr - 0.1], [0.3, pr - 0.1], [0.3, 0]], { seg: 16 }), tt());
  if (c.seal) {
    k.add(c.seal, tubeX(pr + 0.35, pr - 0.15, -0.04, 0.06, { seg: 18, c: 0.01 }), tt());
    k.add(c.seal, tubeX(n - 0.05, b.R - 0.1, c.L - 0.05, c.L + 0.3, { seg: 18, c: 0.02 }), tt());
  }
  if (c.tip) {
    const x0 = b.xt - 4.2, tip = b.pts.filter((p) => p[0] > x0);
    let r0 = 0;
    for (let i = 1; i < b.pts.length; i++) if (b.pts[i][0] >= x0 && b.pts[i - 1][0] <= x0) {
      const [xa, ra] = b.pts[i - 1], [xb, rb2] = b.pts[i];
      r0 = ra + (rb2 - ra) * (x0 - xa) / (xb - xa || 1);
    }
    k.add(c.tip, latheX([[x0, 0], [x0, r0 + 0.03], ...tip.map(([x, r]) => [x + 0.02, r > 0 ? r + 0.03 : 0])], { seg: 18, crease: 50 }), tt());
  }
}
function feedLips(k, mat, x0, x1, y, hw, o = {}) {
  const rise = o.rise ?? 4.5, t = o.t ?? 1.1, curl = o.curl ?? 2.8;
  const sec = [[hw, y - 2], [hw, y + rise - 1.2], [hw - curl * 0.55, y + rise, 0.6], [hw - curl, y + rise - 0.6, 0.4], [hw - curl + 0.3, y + rise - 1.6], [hw - t - 0.4, y + rise - 1.4], [hw - t, y - 2]];
  for (const s of [-1, 1]) {
    k.add(mat, extrudeX(sec.map(([z, yy, r]) => [s * z, yy, r || 0]), x0, x1, { bevel: 0.3 }));
  }
  k.add(mat, extrudeX([[-hw, y - 2], [hw, y - 2], [hw, y + 1.2], [-hw, y + 1.2]], x0, x0 + 1.6, { bevel: 0.3 }));
}

