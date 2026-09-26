// Глушитель SureFire SOCOM-RC2: хвостовик с храповым стопорным кольцом (QD), корпус с
// валиками сварных швов у торцевых крышек, лыски под ключ, передняя крышка с отверстием и
// каналами сброса газа.
function socom(ctx, o) {
  const k = ctx.kit();
  const R4 = 19.05, L = o.len;
  k.add("steel", latheX([[0, 0], [0, 10.4], [1, 11], [14, 11], [15, 10], [15, 0]], { seg: 28 }));
  k.add("cast", latheX([[10, 0], [10, 14.6], [12, 16.4], [30, 16.4], [31, 18.2], [36, R4 - 0.2], [L - 6, R4], [L - 3, R4 - 1.2], [L, R4 - 3], [L, 5.4], [L - 2, 4.6], [L - 2, 0]], { seg: 48, crease: 30 }));
  k.add("cast", flutesX(16.2, 12, 30, 30, 1.8, 1));
  k.add("steel", ringGrooves(17.2, 31, 36, 3, 0.4, { seg: 40 }));
  // храповик стопорного кольца и защёлка
  for (let i = 0; i < 12; i++) k.add("steel", T(T(box(3, 1.6, 2.2, { bevel: 0.3 }), { p: [33.5, 18.4, 0] }), { r: [i * 30, 0, 0] }));
  k.add("steel", T(box(10, 2.4, 5, { bevel: 0.8 }), { p: [26, 17.2, 0] }));
  // сварные швы у крышек
  for (const x of [38, L - 8]) k.add("cast", latheX([[x - 1.2, 0], [x - 1.2, R4], [x - 0.6, R4 + 0.45], [x + 0.6, R4 + 0.45], [x + 1.2, R4], [x + 1.2, 0]], { seg: 48 }));
  k.add("cast", flutesX(R4 - 0.3, L - 22, L - 11, 12, 3.2, 0.7));
  // передняя крышка: каналы сброса вокруг отверстия
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    k.add("lensBlack", cylX(1.1, L - 0.4, L + 0.05, { seg: 8 }), { p: [0, Math.cos(a) * 10.5, Math.sin(a) * 10.5] });
  }
  k.add("lensBlack", cylX(5.2, L - 2.2, L + 0.05, { seg: 20 }));
  return { root: k.build("socom"), muzzle: { x: L, kind: "supp", flash: 0.04 } };
}
// «Птичья клетка» A2: пять продольных прорезей сверху и по бокам, низ закрыт — не пылит лёжа.
function a2(ctx) {
  const k = ctx.kit();
  k.add("steel", latheX([[0, 0], [0, 10.5], [1, 11], [9, 11], [9.5, 10.6], [14, 10.6], [14, 0]], { seg: 32 }));
  const slots = [-72, -36, 0, 36, 72], hw = 6;
  const sec = [];
  for (let i = 0; i < slots.length - 1; i++) sec.push([slots[i] + hw, slots[i + 1] - hw]);
  sec.push([slots[slots.length - 1] + hw, 360 + slots[0] - hw]);
  k.add("steel", sectorRing(6.2, 10.6, 13.8, 40.2, sec, { bevel: 0.25 }));
  k.add("steel", latheX([[40, 0], [40, 10.6], [43, 10.6], [44, 9.8], [44, 5.6], [40, 5.6]], { seg: 32 }));
  k.add("lensBlack", tubeX(6.3, 5.6, 13, 41, { seg: 24 }));
  k.add("steel", flutesX(10.6, 2, 8, 2, 5, 0.6, { a0: 90 }));
  return { root: k.build("a2"), muzzle: { x: 44, kind: "fh", flash: 0.4 } };
}
// SureFire WarComp: три зубца (открытые прорези), компенсаторные окна сверху, лыски, резьба под QD.
function warcomp(ctx, R4) {
  const k = ctx.kit();
  k.add("steel", latheX([[0, 0], [0, R4 - 0.5], [1, R4], [26, R4], [27, R4 - 1.5], [30, R4 - 1.5], [30, R4 * 0.5], [0, R4 * 0.5]], { seg: 32 }));
  k.add("steel", ringGrooves(R4 - 1.4, 26.6, 30, 4, 0.3, { seg: 32 }));
  const sec = [];
  for (let i = 0; i < 3; i++) sec.push([i * 120 + 14, i * 120 + 106]);
  k.add("steel", sectorRing(R4 * 0.55, R4 - 0.6, 30, 57, sec, { bevel: 0.3 }));
  for (let i = 0; i < 3; i++) k.add("steel", T(T(box(4, 2.4, (R4 - 0.6) * 1.2, { bevel: 0.6 }), { p: [57.6, R4 - 2.4, 0] }), { r: [i * 120 + 60, 0, 0] }));
  for (const a of [-40, 0, 40]) k.add("lensBlack", T(box(3.2, 3, 6, { bevel: 0.6 }), { p: [18, R4 - 1.2, 0], r: [a, 0, 0] }));
  k.add("lensBlack", tubeX(R4 * 0.56, R4 * 0.5, 29, 57, { seg: 24 }));
  k.add("steel", flutesX(R4, 2, 10, 2, 6, 0.5, { a0: 90 }));
  return { root: k.build("warcomp"), muzzle: { x: 59, kind: "fh", flash: 0.3 } };
}
function linear(ctx, r) {
  const k = ctx.kit();
  const R4 = 14.3, L = 62;
  k.add("steel", latheX([[0, 0], [0, r + 1.5], [1, r + 3], [14, r + 3], [15, R4 - 0.6], [16, R4], [L - 1.5, R4], [L, R4 - 1.4], [L, 10.2], [L - 3, 9.6], [L - 3, 0]], { seg: 40 }));
  k.add("steel", flutesX(r + 3, 3, 12, 2, 8, 0.8, { a0: 90 }));
  k.add("steel", ringGrooves(R4, 18, 24, 2, 0.4, { seg: 40 }));
  // внутренний ствол-дефлектор виден в торце
  k.add("steel", tubeX(r + 1.6, r + 0.4, L - 14, L - 1.5, { seg: 24 }));
  k.add("lensBlack", tubeX(9.7, r + 1.7, L - 3.2, L + 0.05, { seg: 28 }));
  return { root: k.build("linear"), muzzle: { x: L, kind: "linear", flash: 0.15 } };
}
// Дульный тормоз Precision Armament: три пары боковых окон с перегородками, верхние порты.
function brake(ctx, R4) {
  const k = ctx.kit();
  k.add("steel", latheX([[0, 0], [0, R4 - 0.4], [0.8, R4], [12, R4], [12, 4.5], [0, 4.5]], { seg: 32 }));
  k.add("steel", latheX([[52, 0], [52, R4], [56, R4], [57, R4 - 1], [57, 4.5], [52, 4.5]], { seg: 32 }));
  // верх и низ корпуса — секторы, окна по бокам открыты
  k.add("steel", sectorRing(R4 - 2.4, R4, 11.8, 52.2, [[-50, 50], [130, 230]], { bevel: 0.3 }));
  for (let i = 0; i < 3; i++) k.add("steel", latheX([[22 + i * 12, 0], [22 + i * 12, R4 - 0.2], [24.6 + i * 12, R4 - 0.2], [24.6 + i * 12, 0]].map(([x, rr], j) => [x, j === 0 || j === 3 ? 4.6 : rr]).concat([[22 + i * 12, 4.6]]), { seg: 32 }));
  k.add("lensBlack", tubeX(4.7, 4.2, 11, 53, { seg: 16 }));
  for (let i = 0; i < 3; i++) k.add("lensBlack", T(cylY(1.6, 0, 3, { seg: 10 }), { p: [17 + i * 12, R4 - 2.4, 0] }));
  k.add("steel", flutesX(R4, 2, 10, 2, 6, 0.5, { a0: 90 }));
  return { root: k.build("brake"), muzzle: { x: 57, kind: "brake", flash: 0.7 } };
}
function rotexV(ctx) {
  const k = ctx.kit();
  const R4 = 20, L = 158;
  k.add("steel", latheX([[0, 0], [0, 10.4], [1, 11], [16, 11], [17, 10], [17, 0]], { seg: 28 }));
  k.add("steelPark", latheX([[8, 0], [8, 15.2], [10, 17], [34, 17], [35, 18.6], [38, R4 - 0.3], [L - 10, R4], [L - 5, R4 - 1], [L - 1.5, R4 - 3.6], [L, R4 - 5], [L, 5.2], [L - 3, 4.6], [L - 3, 0]], { seg: 52, crease: 30 }));
  k.add("steelPark", flutesX(17.3, 12, 32, 36, 1.6, 0.9));
  k.add("steel", ringGrooves(R4, 42, 46, 2, 0.35, { seg: 48 }));
  k.add("steel", ringGrooves(R4, L - 18, L - 14, 2, 0.35, { seg: 48 }));
  k.add("steel", T(box(10, 3, 6, { bevel: 0.8 }), { p: [22, -17.8, 0] }));
  k.add("lensBlack", cylX(5, L - 3.2, L + 0.05, { seg: 20 }));
  return { root: k.build("rotex"), muzzle: { x: L, kind: "supp", flash: 0.03 } };
}
function nt4(ctx) {
  const k = ctx.kit();
  const R4 = 19.05, L = 168;
  k.add("steel", latheX([[0, 0], [0, 10.4], [1, 11], [14, 11], [15, 10], [15, 0]], { seg: 28 }));
  k.add("cast", latheX([[6, 0], [6, 14.5], [8, 16.5], [30, 16.5], [34, R4 - 0.4], [L - 14, R4], [L - 6, R4 - 2], [L - 2, R4 - 5.5], [L, R4 - 8], [L, 4.8], [L - 2, 4.4], [L - 2, 0]], { seg: 52, crease: 30 }));
  k.add("cast", flutesX(16.7, 10, 28, 24, 2, 1.1));
  k.add("steel", T(extrudeZ([[0, -3, 1], [26, -2.4, 1.5], [28, 0, 1], [26, 2.4, 1.5], [0, 3, 1]], 2.6, { bevel: 0.6 }), { p: [8, 0, 17.6] }));
  k.add("steel", T(cylZ(3, 15.5, 19.4, { seg: 14 }), { p: [10, 0, 0] }));
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    k.add("lensBlack", T(cylX(1.3, L - 4, L + 0.05, { seg: 10 }), { p: [0, Math.cos(a) * 8, Math.sin(a) * 8] }));
  }
  k.add("lensBlack", cylX(4.6, L - 2.2, L + 0.05, { seg: 20 }));
  return { root: k.build("nt4"), muzzle: { x: L, kind: "supp", flash: 0.03 } };
}
var MUZZLES = [
  { id: "sf_socom556", cat: "muzzle", name: "SureFire SOCOM556-RC2", desc: "Глушитель 5,56, быстросъёмный", fit: { thread: ["1/2x28"] }, stats: { weight: 620, length: 168, loud: -28, flash: -70, "recoilV%": -10, ergo: -8, adsTime: 25, velocity: 6 }, build: (c) => socom(c, { len: 168 }) },
  { id: "bt_rotex_hk", cat: "muzzle", only: ["m416"], name: "B&T Rotex-V (HK416)", desc: "Штатный глушитель к HK416: ставится на пламегаситель HK, стопорное кольцо", fit: { thread: ["1/2x28"] }, stats: { weight: 560, length: 158, loud: -29, flash: -72, "recoilV%": -11, ergo: -7, adsTime: 22, velocity: 5 }, build: rotexV },
  { id: "kac_nt4", cat: "muzzle", only: ["m416"], name: "Knight's Armament NT4 QDSS", desc: "Глушитель M27 IAR (USMC, база HK416): быстросъёмный, рычаг-защёлка", fit: { thread: ["1/2x28"] }, stats: { weight: 640, length: 168, loud: -30, flash: -75, "recoilV%": -12, ergo: -8, adsTime: 25, velocity: 6 }, build: nt4 },
  { id: "sf_socom762", cat: "muzzle", name: "SureFire SOCOM762-RC2", desc: "Глушитель 7,62, быстросъёмный", fit: { thread: ["5/8x24"] }, stats: { weight: 720, length: 188, loud: -27, flash: -70, "recoilV%": -12, ergo: -10, adsTime: 30, velocity: 6 }, build: (c) => socom(c, { len: 188 }) },
  { id: "a2_fh", cat: "muzzle", name: "Пламегаситель A2", desc: "Классическая «птичья клетка»", fit: { thread: ["1/2x28"] }, stats: { weight: 50, length: 34, flash: -35, "recoilV%": -3 }, build: a2 },
  { id: "warcomp556", cat: "muzzle", name: "SureFire WarComp 5,56", desc: "Пламегаситель-компенсатор", fit: { thread: ["1/2x28"] }, stats: { weight: 90, length: 49, flash: -45, "recoilV%": -8, "recoilH%": -6, loud: 1 }, build: (c) => warcomp(c, 11) },
  { id: "warcomp762", cat: "muzzle", name: "SureFire WarComp 7,62", desc: "Пламегаситель-компенсатор", fit: { thread: ["5/8x24"] }, stats: { weight: 110, length: 49, flash: -45, "recoilV%": -8, "recoilH%": -6, loud: 1 }, build: (c) => warcomp(c, 12) },
  { id: "pa_brake556", cat: "muzzle", name: "Precision Armament M4-72", desc: "Дульный тормоз: меньше отдача, громче", fit: { thread: ["1/2x28"] }, stats: { weight: 85, length: 47, flash: 25, "recoilV%": -22, "recoilH%": -18, loud: 5 }, build: (c) => brake(c, 11.2) },
  { id: "pa_brake762", cat: "muzzle", name: "Precision Armament M11", desc: "Дульный тормоз 7,62", fit: { thread: ["5/8x24"] }, stats: { weight: 120, length: 47, flash: 25, "recoilV%": -24, "recoilH%": -18, loud: 5 }, build: (c) => brake(c, 12.5) },
  { id: "linear556", cat: "muzzle", name: "Линейный компенсатор KAK", desc: "Уводит газы вперёд: тише для стрелка, чуть больше отдача", fit: { thread: ["1/2x28"] }, stats: { weight: 115, length: 62, flash: -30, loud: -3, "recoilV%": 3 }, build: (c) => linear(c, 6.4) },
  { id: "linear762", cat: "muzzle", name: "Линейный компенсатор KAK 7,62", desc: "Уводит газы вперёд: тише для стрелка, чуть больше отдача", fit: { thread: ["5/8x24"] }, stats: { weight: 130, length: 62, flash: -30, loud: -3, "recoilV%": 3 }, build: (c) => linear(c, 7.9) },
  { id: "linear_ak", cat: "muzzle", name: "Линейный компенсатор (АК)", desc: "Уводит газы вперёд: тише для стрелка, чуть больше отдача", fit: { thread: ["m14x1L", "m24x1.5"] }, stats: { weight: 125, length: 62, flash: -30, loud: -3, "recoilV%": 3 }, build: (c) => linear(c, 8.5) }
];

