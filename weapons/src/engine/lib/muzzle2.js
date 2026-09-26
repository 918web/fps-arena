var DEG = Math.PI / 180;
function flatsX(r, cut, x0, x1, o = {}) {
  const lim = r - cut, pts = [];
  for (let i = 0; i < 40; i++) {
    const a = i / 40 * Math.PI * 2;
    pts.push([Math.max(-lim, Math.min(lim, Math.cos(a) * r)), Math.sin(a) * r]);
  }
  const clean = pts.filter((p, i) => {
    const q = pts[(i + 1) % pts.length];
    return Math.abs(p[0] - q[0]) > 1e-3 || Math.abs(p[1] - q[1]) > 1e-3;
  });
  return extrudeX(clean, x0, x1, { bevel: o.bevel ?? 0.6 });
}
function hexX(af, x0, x1, o = {}) {
  const R4 = af / 2 / Math.cos(30 * DEG), pts = [];
  for (let i = 0; i < 6; i++) {
    const a = (30 + i * 60) * DEG;
    pts.push([Math.cos(a) * R4, Math.sin(a) * R4, o.rc ?? 2]);
  }
  return extrudeX(pts, x0, x1, { bevel: o.bevel ?? 1, crease: 25 });
}
function slotOn(x0, x1, w, r, a, o = {}) {
  const g = extrudeY(slot(x0, x1, 0, w), r - (o.depth ?? 0.8), r + (o.lift ?? 0.12), { bevel: 0.2 });
  if (o.tilt) {
    T(g, { p: [-(x0 + x1) / 2, -r, 0] });
    T(g, { r: [0, 0, o.tilt] });
    T(g, { p: [(x0 + x1) / 2, r, 0] });
  }
  return T(g, { r: [a, 0, 0] });
}
function spiralBody(R4, x0, x1, o = {}) {
  const n = o.n ?? 8, depth = o.depth ?? 1.5, twist = (o.twist ?? 120) * DEG, width = o.width ?? 0.45;
  const m = n * 12, rings = [], steps = Math.max(12, Math.round((x1 - x0) / (o.dx ?? 3)));
  const fade = o.fade ?? 10;
  for (let s = 0; s <= steps; s++) {
    const x = x0 + s / steps * (x1 - x0);
    const ramp = Math.min(1, (x - x0) / fade, (x1 - x) / fade);
    const ph = twist * (x - x0) / (x1 - x0);
    const pts = [];
    for (let i = 0; i < m; i++) {
      const t0 = i / m * Math.PI * 2, t = t0 + ph;
      const c = Math.cos(n * t0);
      const g = c > 1 - width * 2 ? Math.min(1, (c - (1 - width * 2)) / (width * 0.9)) : 0;
      const r = R4 - depth * g * Math.max(0, ramp);
      pts.push([Math.cos(t) * r, Math.sin(t) * r]);
    }
    rings.push({ x, pts });
  }
  return loftX(rings, { caps: false, crease: 50, flip: true });
}
function faceHoles(k, x, rr, n, r, o = {}) {
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2 + (o.a0 ?? 0) * DEG;
    k.add("lensBlack", T(cylX(r, x - (o.depth ?? 1.6), x + 0.05, { seg: 10, c: 0.1 }), { p: [0, Math.cos(a) * rr, Math.sin(a) * rr] }));
  }
}
function flow556k(ctx) {
  const k = ctx.kit(), M = "cast#3b3d40";
  const R4 = 19.8, L = 169;
  k.add("steel", latheX([[0, 0], [0, 7.4], [2, 7.4], [2, 0]], { seg: 20 }));
  k.add(M, hexX(25.4, 0, 12, { rc: 1.2, bevel: 0.8 }));
  k.add(M, latheX([
    [11, 0],
    [11, 14.2],
    [13, 15.6],
    [19, R4 - 1.2],
    [22, R4],
    [L - 12, R4],
    [L - 8, R4 - 1.2],
    [L - 4, R4 - 3.4],
    [L, R4 - 4.4],
    [L, R4 - 6],
    [L - 1.4, R4 - 7],
    [L - 1.4, 8.2],
    [L, 7.2],
    [L, 4.3],
    [L - 3, 3.8],
    [L - 3, 0]
  ], { seg: 56, crease: 30 }));
  k.add(M, ringGrooves(R4 + 0.05, 24, 34, 5, 0.45, { seg: 56 }));
  for (let row = 0; row < 6; row++) {
    const x = 44 + row * 18;
    for (let i = 0; i < 12; i++) k.add("lensBlack", slotOn(x - 7, x + 7, 3.4, R4, i * 30 + row % 2 * 15));
  }
  for (let row = 0; row <= 6; row++) k.add(M, tubeX(R4 + 0.35, R4 - 0.5, 34.4 + row * 18, 36.2 + row * 18, { seg: 56, c: 0.3 }));
  for (let i = 0; i < 16; i++) k.add("lensBlack", T(box(1.6, 3.6, 2.4, { bevel: 0.5 }), { p: [L - 1.3, 10.6, 0], r: [i * 22.5, 0, 0] }));
  k.add("lensBlack", cylX(4.3, L - 2.9, L + 0.05, { seg: 20 }));
  return { root: k.build("flow556k"), muzzle: { x: L, kind: "supp", flash: 0.05, voice: { len: 169, loud: -24 } } };
}
function omega36m(ctx) {
  const k = ctx.kit(), M = "cast";
  const R4 = 21.85, L = 181;
  k.add("steel", latheX([[0, 0], [0, 10.6], [1, 11.2], [6, 11.2], [6, 0]], { seg: 28 }));
  k.add(M, latheX([
    [4, 0],
    [4, 15.4],
    [5.5, 17],
    [27, 17],
    [28, 18.4],
    [30, R4 - 0.8],
    [32, R4],
    [L - 26.5, R4],
    [L - 26, R4 - 0.7],
    [L - 25.5, R4],
    [L - 15, R4],
    [L - 3, R4 - 5.2],
    [L, R4 - 6.6],
    [L, R4 - 8.4],
    [L - 1, R4 - 9.4],
    [L - 1, 6.6],
    [L, 5.8],
    [L, 4.9],
    [L - 3, 4.4],
    [L - 3, 0]
  ], { seg: 60, crease: 30 }));
  k.add("steelPark", flutesX(17, 7, 26, 32, 1.7, 1));
  k.add("steelPark", ringGrooves(18.6, 27.6, 30, 1, 0.3, { seg: 48 }));
  k.add("steel", T(box(9, 2.6, 5, { bevel: 0.7 }), { p: [16, -18.6, 0] }));
  for (const x of [40, 43.5, L - 40]) k.add("cast#6b6e72", tubeX(R4 + 0.04, R4 - 0.3, x, x + 0.9, { seg: 60, c: 0.1 }));
  k.add("cast#5d6064", T(extrudeY(slot(58, 96, 0, 4.4), R4 - 0.6, R4 + 0.06, { bevel: 0.1 }), { r: [90, 0, 0] }));
  for (let i = 0; i < 4; i++) k.add("lensBlack", T(box(3, 3.2, 4, { bevel: 0.4 }), { p: [L - 0.9, R4 - 7.5, 0], r: [45 + i * 90, 0, 0] }));
  k.add("steelPark", tubeX(9.6, 7.4, L - 1.6, L - 0.6, { seg: 40, c: 0.2 }));
  k.add("lensBlack", cylX(4.9, L - 2.9, L + 0.05, { seg: 20 }));
  return { root: k.build("omega36m"), muzzle: { x: L, kind: "supp", flash: 0.03, voice: { len: 181, loud: -30 } } };
}
function spiral762(ctx) {
  const k = ctx.kit(), M = "cast#5a5040";
  const R4 = 22.25, L = 198, X0 = 42, X1 = L - 30;
  k.add("steel", latheX([[0, 0], [0, 11.8], [1, 12.4], [8, 12.4], [8, 0]], { seg: 28 }));
  k.add("steelPark", latheX([[5, 0], [5, 16.4], [6.5, 17.8], [30, 17.8], [31, 16.8], [31, 0]], { seg: 52 }));
  k.add("steelPark", flutesX(17.6, 9, 28, 36, 1.4, 0.8));
  k.add("steelPark", ringGrooves(18.3, 9, 28, 6, 0.5, { seg: 52 }));
  k.add(M, latheX([[30, 0], [30, 18.6], [32, 20], [37, R4 - 0.4], [39, R4], [X0 + 0.5, R4], [X0 + 0.5, 0]], { seg: 60, crease: 30 }));
  k.add(M, spiralBody(R4, X0, X1, { n: 10, depth: 1.7, twist: 150, width: 0.38 }));
  k.add(M, latheX([
    [X1 - 0.5, 0],
    [X1 - 0.5, R4],
    [L - 16, R4],
    [L - 15, R4 - 0.6],
    [L - 14, R4],
    [L - 5, R4 - 2.6],
    [L, R4 - 4.2],
    [L, R4 - 6.4],
    [L - 1.2, R4 - 7.2],
    [L - 1.2, 7.2],
    [L, 6.4],
    [L, 5.4],
    [L - 3, 4.9],
    [L - 3, 0]
  ], { seg: 60, crease: 30 }));
  k.add(M, flutesX(R4 - 0.3, L - 13, L - 6, 12, 2.6, 0.5));
  faceHoles(k, L - 1.2, 11.2, 8, 1.3, { a0: 22.5 });
  k.add("lensBlack", cylX(5.4, L - 2.9, L + 0.05, { seg: 20 }));
  return { root: k.build("spiral762"), muzzle: { x: L, kind: "supp", flash: 0.04, voice: { len: 198, loud: -29 } } };
}
function dtk4m(ctx) {
  const k = ctx.kit(), M = "steelPark";
  const R4 = 22, L = 192, XC = L - 38, RC = 14;
  k.add("steel", latheX([[0, 0], [0, 11.4], [1, 12.2], [10, 12.2], [10, 0]], { seg: 28 }));
  k.add(M, latheX([
    [6, 0],
    [6, 15.6],
    [7.5, 17.2],
    [34, 17.2],
    [36, 19],
    [38, R4 - 0.4],
    [40, R4],
    [XC, R4],
    [L - 6, RC],
    [L - 6, RC - 0.4],
    [L, RC],
    [L, 11],
    [L - 5.5, 8.4],
    [L - 5.5, 0]
  ], { seg: 60, crease: 25 }));
  k.add("steel", ringGrooves(17.5, 10, 24, 8, 0.45, { seg: 52 }));
  for (const a of [60, 180, 300]) k.add(M, T(box(8, 2.2, 3, { bevel: 0.6 }), { p: [30, 17.8, 0], r: [a, 0, 0] }));
  k.add("steel", T(extrudeZ([[0, -2.6, 1], [22, -2.2, 1.2], [25, 0, 1], [22, 2.8, 1.4], [0, 2.8, 1]], 2.4, { bevel: 0.5 }), { p: [12, 0, 18.4] }));
  k.add("steel", T(cylZ(2.8, 16.6, 19.8, { seg: 14 }), { p: [33, 0, 0] }));
  for (const x of [52, 96, 140]) k.add(M, tubeX(R4 + 0.6, R4 - 0.2, x, x + 3.2, { seg: 60, c: 0.6 }));
  k.add("steel", tubeX(R4 + 0.25, R4 - 0.2, 44, 45.6, { seg: 60, c: 0.4 }));
  const tilt = -Math.atan((R4 - RC) / (L - 6 - XC)) / DEG;
  for (let i = 0; i < 8; i++) k.add("lensBlack", slotOn(XC + 6, L - 12, 3.2, (R4 + RC) / 2 + 0.1, i * 45 + 22.5, { tilt }));
  for (let i = 0; i < 6; i++) k.add("lensBlack", T(box(3.6, 3.4, 2.6, { bevel: 0.4 }), { p: [L - 0.8, RC - 1.3, 0], r: [i * 60, 0, 0] }));
  k.add("lensBlack", cylX(8.4, L - 5.9, L - 5.3, { seg: 28 }));
  k.add("lensBlack", cylX(5, L - 6, L - 5.2, { seg: 20 }));
  return { root: k.build("dtk4m"), muzzle: { x: L, kind: "supp", flash: 0.04, voice: { len: 192, loud: -27 } } };
}
function wolverine(ctx) {
  const k = ctx.kit(), M = "cast#4a4c3c", POCKET = "cast#23241d";
  const AF = 42, L = 186, H0 = 24, H1 = L - 22;
  k.add("steel", latheX([[0, 0], [0, 11.4], [1, 12.2], [10, 12.2], [10, 0]], { seg: 28 }));
  k.add(M, latheX([[5, 0], [5, 16.6], [6.5, 18], [H0 + 1, 18], [H0 + 1, 0]], { seg: 52 }));
  k.add(M, ringGrooves(18.2, 7, 14, 4, 0.45, { seg: 52 }));
  k.add(M, flatsX(18.3, 1.6, 15, H0 - 1));
  k.add(M, hexX(AF, H0, H1, { rc: 3, bevel: 1.4 }));
  const ap = AF / 2;
  for (let i = 0; i < 6; i++) {
    const a = 90 - i * 60;
    k.add(POCKET, slotOn(H0 + 12, H0 + 62, 9, ap, a, { depth: 0.5, lift: 0.06 }));
    k.add(POCKET, slotOn(H0 + 70, H1 - 12, 9, ap, a, { depth: 0.5, lift: 0.06 }));
  }
  k.add(M, latheX([
    [H1 - 1, 0],
    [H1 - 1, 19.6],
    [H1 + 1, 20.4],
    [L - 8, 20.4],
    [L - 2, 17.6],
    [L, 16],
    [L, 13.6],
    [L - 1.2, 12.8],
    [L - 1.2, 6.8],
    [L, 6],
    [L, 5.2],
    [L - 3, 4.7],
    [L - 3, 0]
  ], { seg: 56, crease: 30 }));
  k.add(M, ringGrooves(20.4, H1 + 4, H1 + 12, 3, 0.4, { seg: 56 }));
  faceHoles(k, L - 1.2, 9.8, 6, 1.5, { a0: 30 });
  k.add("lensBlack", cylX(5.2, L - 2.9, L + 0.05, { seg: 20 }));
  return { root: k.build("wolverine"), muzzle: { x: L, kind: "supp", flash: 0.04, voice: { len: 186, loud: -26 } } };
}
function tripleTap(ctx) {
  const k = ctx.kit();
  const R4 = 11.1, L = 57;
  k.add("steel", flatsX(R4, 1.8, 0, 12.4, { bevel: 0.6 }));
  k.add("steel", latheX([[12, 0], [12, R4 - 0.5], [12.5, R4], [L - 1.6, R4], [L, R4 - 1.4], [L, 5.4], [L - 3, 4.8], [L - 3, 0]], { seg: 40, crease: 30 }));
  k.add("steel", ringGrooves(R4, 13.5, 17.5, 2, 0.35, { seg: 40 }));
  for (let i = 0; i < 3; i++) for (const a of [-90, 90]) k.add("lensBlack", slotOn(20 + i * 10.5, 28 + i * 11, 4.4 + i * 0.4, R4, a, { depth: 2.4, lift: 0.05 }));
  for (const x of [25, 33, 41]) k.add("lensBlack", T(cylY(1.7, R4 - 1.6, R4 + 0.2, { seg: 12 }), { p: [x, 0, 0] }));
  for (let i = 0; i < 3; i++) k.add("lensBlack", T(box(9, 3.4, 3.8, { bevel: 0.6 }), { p: [L - 3.6, R4 - 1.2, 0], r: [60 + i * 120, 0, 0] }));
  k.add("lensBlack", cylX(4.8, L - 2.9, L + 0.05, { seg: 18 }));
  return { root: k.build("tripletap"), muzzle: { x: L, kind: "fh", flash: 0.35 } };
}
function dtk3(ctx) {
  const k = ctx.kit(), M = "steelPark";
  const R4 = 15, L = 88, C0 = 38, C1 = L - 9;
  k.add(M, flatsX(R4, 2.2, 0, 14, { bevel: 0.8 }));
  k.add(M, latheX([[13.5, 0], [13.5, R4 - 0.6], [14.5, R4], [C0, R4], [C0, 0]], { seg: 44 }));
  k.add(M, flutesX(R4 - 0.2, 16, 24, 18, 1.6, 0.6));
  for (const x of [28, 33.5]) k.add("lensBlack", T(cylY(2.3, R4 - 2, R4 + 0.3, { seg: 14 }), { p: [x, 0, 0] }));
  k.add("lensBlack", T(box(6, 2, 4, { bevel: 0.4 }), { p: [6, -R4 + 0.7, 0] }));
  for (let i = 0; i < 4; i++) {
    const a = 45 + i * 90;
    k.add(M, T(extrudeZ([[C0 - 1, 0], [C1 + 1, 0], [C1 + 1, 4.2, 0.8], [C0 - 1, 4.2, 0.8]], 7, { bevel: 0.7 }), { p: [0, R4 - 4.2, 0], r: [a, 0, 0] }));
  }
  for (const x of [C0 + 9, C0 + 24]) k.add("steel", latheX([[x, 0], [x, 5], [x + 5, R4 - 4.4], [x + 7, R4 - 4.4], [x + 7, 5.4], [x + 5, 5], [x + 5, 0]], { seg: 32 }));
  k.add("lensBlack", tubeX(5, 4.2, C0, C1, { seg: 16, c: 0.1 }));
  k.add(M, latheX([[C1, 6.6], [C1, R4 - 0.8], [C1 + 0.8, R4], [L - 1.2, R4], [L, R4 - 1.2], [L, 7.6], [L - 3, 6], [C1, 6], [C1, 6.6]], { seg: 44, crease: 30 }));
  k.add("lensBlack", cylX(6.05, C1 - 0.2, L + 0.05, { seg: 20, c: 0.1 }));
  return { root: k.build("dtk3"), muzzle: { x: L, kind: "comp", flash: 0.45 } };
}
var MUZZLES2 = [
  { id: "hux_flow556k", cat: "muzzle", name: "HUXWRX FLOW 556k", desc: "Проточный глушитель из инконеля (3D-печать): меньше обратного газа, решётка окон, прямая резьба", fit: { thread: ["1/2x28"] }, stats: { weight: 414, length: 169, loud: -24, flash: -70, "recoilV%": -9, ergo: -7, adsTime: 22, velocity: 4 }, build: flow556k },
  { id: "omega36m", cat: "muzzle", name: "SilencerCo Omega 36M", desc: "Титановый мультикалиберный глушитель: крепление ASR, коническая дульная крышка", fit: { thread: ["1/2x28", "5/8x24"] }, stats: { weight: 400, length: 181, loud: -30, flash: -78, "recoilV%": -12, ergo: -8, adsTime: 25, velocity: 5 }, build: omega36m },
  { id: "spiral762", cat: "muzzle", name: "Спиральный глушитель 7,62", desc: "Корпус с винтовыми канавками (как у OSS): легче и лучше охлаждается, быстросъёмная муфта", fit: { thread: ["5/8x24"] }, stats: { weight: 590, length: 198, loud: -29, flash: -76, "recoilV%": -13, ergo: -10, adsTime: 30, velocity: 6 }, build: spiral762 },
  { id: "dtk4m", cat: "muzzle", name: "Зенитко ДТК-4М", desc: "Тактический глушитель к АК: стальной корпус, рычаг-фиксатор, пламегасящий конус", fit: { thread: ["m24x1.5", "m14x1L"] }, stats: { weight: 560, length: 192, loud: -27, flash: -85, "recoilV%": -14, ergo: -9, adsTime: 28, velocity: 3 }, build: dtk4m },
  { id: "hex_wolverine", cat: "muzzle", name: "Hexagon Wolverine", desc: "Глушитель к АК с шестигранным корпусом: не катится по столу, фрезерованные карманы", fit: { thread: ["m24x1.5", "m14x1L"] }, stats: { weight: 520, length: 186, loud: -26, flash: -80, "recoilV%": -12, ergo: -8, adsTime: 24, velocity: 3 }, build: wolverine },
  { id: "kac_tripletap", cat: "muzzle", name: "KAC Triple Tap", desc: "Пламегаситель-компенсатор: три окна сверху гасят подброс, трёхзубая корона", fit: { thread: ["1/2x28"] }, stats: { weight: 94, length: 57, flash: -40, "recoilV%": -7, "recoilH%": -5, loud: 1 }, build: tripleTap },
  { id: "dtk3", cat: "muzzle", name: "Зенитко ДТК-3", desc: "Компенсатор к АК с открытой передней клеткой: гасит подброс, громче штатного", fit: { thread: ["m24x1.5", "m14x1L"] }, stats: { weight: 170, length: 88, flash: -20, "recoilV%": -18, "recoilH%": -14, loud: 3 }, build: dtk3 }
];

