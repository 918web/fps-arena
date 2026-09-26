// Боковой «ласточкин хвост» (АК/СВД): кронштейн под Пикатинни и прицелы на прямом креплении.
// Система координат — у планки на левом борту ствольной коробки: z<0 — наружу, z>0 — к оси.
// Зажимной рычаг на наружной стороне колодки: лежит вдоль борта, ось с гайкой натяжения.
function dovetailLever(k, x0, x1, o = {}) {
  const z = o.z ?? -11, len = x1 - x0;
  k.add("steel", extrudeZ([[0, -3.2, 1.6], [len - 6, -2.6, 3], [len, -1.2, 2.4], [len, 3.6, 2.4], [len - 6, 5.2, 3], [4, 4.4, 2], [0, 2.6, 1.6]], 3, { bevel: 0.8, curve: 6 }), { p: [x0, o.y ?? 0, z - 1.5] });
  for (let i = 0; i < 5; i++) k.add("steel", T(box(0.9, 5.6, 1, { bevel: 0.25 }), { p: [x0 + len - 2 - i * 1.7, (o.y ?? 0) + 1.2, z - 3.2] }));
  k.add("steel", latheX([[0, 0], [0, 4.4], [0.6, 5], [2.4, 5], [3, 4.4], [3, 2.2], [3.6, 1.8], [3.6, 0]], { seg: 20 }), { r: [0, 90, 0], p: [x0 + 3.5, o.y ?? 0, z] });
}
function dovetailClamp(k, x0, x1, o = {}) {
  k.add("steel", extrudeX(shape([[-3, -9, 1], [4, -9], [4, 9], [-3, 9, 1], [-11, 7, 2], [-11, -7, 2]]), x0, x1, { bevel: 0.8 }));
  // канавка-упор и винты крепления колодки
  k.add("lensBlack", extrudeX([[-11.1, -0.3], [-10.6, -0.3], [-10.6, 0.3], [-11.1, 0.3]], x0 + 4, x1 - 4, { bevel: 0.05 }));
  for (const x of o.screws ?? []) k.add("steel", T(capScrew(2, 0.9), { r: [-90, 0, 0] }), { p: [x, 4, -11] });
  // гайка натяжения на заднем торце
  k.add("steel", T(thumbNut(6, 4, 8), { r: [0, 180, 0] }), { p: [x0, 0, -4] });
}
function sideMount(ctx) {
  const k = ctx.kit();
  dovetailClamp(k, -55, 55, { screws: [-40, 40] });
  dovetailLever(k, 14, 46);
  const riser = shape([[-55, 8, 2], [55, 8, 2], [55, 20, 3], [40, 46, 4], [-40, 46, 4], [-55, 20, 3]], [slot(-30, 30, 26, 14)]);
  k.add("alu", T(extrudeZ(riser, 8, { bevel: 1.2 }), { p: [0, 0, -5] }));
  const top = 58, cz = 19;
  k.add("alu", extrudeX(shape([[-6, 42, 2], [cz + 11, 42, 2], [cz + 11, top - 9, 2], [-6, top - 9, 2]]), -52, 52, { bevel: 1 }));
  for (const x of [-26, 0, 26]) k.add("lensBlack", extrudeZ(rrect(x, 45.5, 14, 3, 1.5), 0.6, { bevel: 0.1, z: cz + 11.2 }));
  const r = picatinny(104, { base: 9.4 });
  k.add("alu", r.geo, { p: [-52, top, cz] });
  const m = ctx.railMount("sideRail", [-52 + r.first, top, cz], "top", r.slots, { axis: "top" });
  return { root: node("sidemount", [k.build(), m]) };
}
// ПСО-1 4×24: трубка с длинным резиновым наглазником, корпус механизмов с маховичком
// углов прицеливания (цифры 0–10) сверху и боковых поправок слева, осветитель сетки
// с батарейным отсеком и тумблером, кронштейн с зажимным рычагом и гайкой.
function pso1(ctx) {
  const k = ctx.kit();
  dovetailClamp(k, -60, 40, { screws: [-48, 28] });
  dovetailLever(k, -46, -12);
  const Y = 60, Z = 13;
  const at = (g) => g.translate(0, Y, Z);
  // кронштейн: наклонная стенка от колодки к корпусу механизмов, рёбра жёсткости
  k.add("steel", extrudeX(shape([[-12, 6, 2], [4, 6, 2], [Z + 6, Y - 22, 4], [Z - 8, Y - 14, 4], [-12, 18, 2]]), -58, 36, { bevel: 1.5 }));
  for (const x of [-40, 18]) k.add("steel", extrudeX(shape([[-8, 8, 1], [2, 8, 1], [Z + 2, Y - 20, 2], [Z - 6, Y - 18, 2]]), x - 2, x + 2, { bevel: 0.6 }));
  // трубка: окулярная часть, корпус, объектив с блендой
  k.add("steel", at(latheX([[-150, 0], [-150, 17], [-146, 19], [-136, 19], [-135.4, 18.4], [-133.8, 18.4], [-133.2, 19], [-120, 19], [-114, 16], [-96, 16], [-92, 17.2], [100, 17.2], [104, 18.4], [134, 18.4], [136, 20], [150, 20], [150.6, 20.5], [153, 20.5], [153.6, 20], [176, 20], [177, 18.8], [177, 0]], { seg: 44 })));
  k.add("lensBlack", at(tubeX(18.9, 17.8, 136, 177.2, { seg: 32 })));
  // резиновый наглазник: складки у основания, раструб
  const cup = [[-151, 16], [-151, 19.6], [-156, 20.4], [-158, 19.8], [-161, 20.6], [-163, 20], [-166, 20.8], [-170, 21], [-190, 22.6], [-204, 24], [-209, 24.6], [-212, 24], [-212, 22]];
  k.add("rubber", at(latheX(cup.map(([x, r]) => [x, r]).reverse(), { seg: 40 })));
  k.add("lensBlack", at(tubeX(22.1, 16.2, -212.2, -150, { seg: 32 })));
  // корпус механизмов вокруг трубки
  k.add("steel", extrudeX(shape(rrect(Z, Y + 1, 36, 40, 9)), -34, 24, { bevel: 1.8 }));
  k.add("steel", extrudeX(shape(rrect(Z, Y + 1, 37.2, 41.2, 9.5)), -35, -32, { bevel: 0.6 }));
  // маховичок углов прицеливания: шкала 0–10, рифлёный верхний обод, стопорный винт
  const ey = Y + 21;
  k.add("steel", T(latheX([[0, 0], [0, 16], [2, 16], [2, 15.2], [11, 15.2], [11, 16.2], [15, 16.2], [15.6, 15.4], [15.6, 6], [16.8, 5.4], [16.8, 0]], { seg: 48 }), { r: [0, 0, 90], p: [-5, ey, Z] }));
  k.add("steel", T(flutesX(15.9, 11.4, 15, 44, 1.2, 0.8), { r: [0, 0, 90], p: [-5, ey, Z] }));
  k.add("paintWhite", T(hashMarks(15.22, 3.8, 11, { arc: 300, a0: 30, major: 1, len: 2 }), { r: [0, 0, 90], p: [-5, ey, Z] }));
  k.add("paintWhite", T(hashMarks(15.22, 7.6, 22, { arc: 315, a0: 30, major: 1000, len: 0.8 }), { r: [0, 0, 90], p: [-5, ey, Z] }));
  k.add("steel", T(screwHead(4.5, 1.6), { r: [-90, 0, 0] }), { p: [-5, ey + 16.6, Z] });
  // маховичок боковых поправок — слева
  const wz = Z - 18;
  k.add("steel", T(latheX([[0, 0], [0, 13.6], [1.6, 13.6], [1.6, 13], [9, 13], [9, 13.8], [12, 13.8], [12.6, 13], [12.6, 5], [13.6, 4.4], [13.6, 0]], { seg: 44 }), { r: [0, 90, 0], p: [-5, Y + 1, wz] }));
  k.add("steel", T(flutesX(13.5, 9.3, 12.1, 40, 1.1, 0.7), { r: [0, 90, 0], p: [-5, Y + 1, wz] }));
  k.add("paintWhite", T(hashMarks(13.02, 3.4, 21, { arc: 300, a0: 30, major: 5, len: 1.5 }), { r: [0, 90, 0], p: [-5, Y + 1, wz] }));
  // осветитель сетки: батарейный отсек вдоль трубы сверху-слева, рифлёная крышка, тумблер
  const by = Y + 14, bz = Z - 13;
  k.add("steel", T(cylX(6.2, 22, 50, { c: 0.8, seg: 24 }), { p: [0, by, bz] }));
  k.add("steel", T(ctx.C.knob(7, 7, 18), { p: [50, by, bz] }));
  k.add("steel", extrudeX(shape(rrect(bz + 5, by - 4, 8, 8, 2)), 22, 44, { bevel: 0.8 }));
  k.add("steel", T(cylY(2.6, 0, 3, { seg: 14 }), { p: [34, by + 5.6, bz] }));
  k.add("steelWorn", T(cylY(0.9, 2, 8, { seg: 8 }), { r: [0, 0, -20], p: [34, by + 6.4, bz] }));
  // упор-«бровь» объектива (отражатель бликов снизу) и винты корпуса
  for (const [x, y] of [[-28, Y + 16], [18, Y + 16], [-28, Y - 14], [18, Y - 14]]) k.add("steel", T(screwHead(1.8, 0.8), { r: [0, 180, 0] }), { p: [x, y, Z + 18] });
  const root = node("pso1", [k.build()]);
  const oc = lens(ctx, at(ctx.C.lensDisc(15, -148)), "glassBlue");
  const ob = lens(ctx, at(ctx.C.lensDisc(17.4, 134)), "glassAmber");
  root.add(oc, ob);
  return { root, sight: { y: Y, z: Z, x0: -150, x1: 177, r: 15, mag: 4, reticle: "pso1", eyeRelief: 68, lens: oc } };
}
// ЭКП-1С-03 «Кобра»: корпус-короб с наклонным стеклом в защитной рамке, переключатель сеток
// и яркости справа, батарейный отсек сзади, кронштейн с рычагом.
function kobra(ctx) {
  const k = ctx.kit();
  dovetailClamp(k, -50, 40, { screws: [-38, 26] });
  dovetailLever(k, -40, -8);
  const Y = 54, Z = 19;
  k.add("alu", extrudeX(shape([[-12, 4, 2], [4, 4, 2], [Z + 16, 26, 3], [Z + 16, 34, 3], [-12, 18, 2]]), -48, 38, { bevel: 1.4 }));
  // корпус-короб
  k.add("alu", extrudeX(shape([[Z - 18, 28, 3], [Z + 18, 28, 3], [Z + 18, 38, 3], [Z - 18, 38, 3]]), -50, 40, { bevel: 1.4 }));
  k.add("alu", extrudeX(shape([[Z - 14, 37, 2], [Z + 14, 37, 2], [Z + 12, 41, 2], [Z - 12, 41, 2]]), -38, 26, { bevel: 1 }));
  const frame = shape([[Z - 19, 36, 2], [Z + 19, 36, 2], [Z + 19, Y + 20, 6], [Z - 19, Y + 20, 6]], [rrect(Z, Y + 1, 30, 30, 4)]);
  k.add("alu", T(extrudeX(frame, -6, 6, { bevel: 1.2 }), { p: [28, 0, 0] }));
  k.add("alu", T(extrudeX(frame, -3, 3, { bevel: 0.8 }), { p: [-40, 0, 0] }));
  k.add("alu", extrudeX(shape([[Z - 19, Y + 16, 3], [Z + 19, Y + 16, 3], [Z + 19, Y + 21, 4], [Z - 19, Y + 21, 4]]), -42, 34, { bevel: 1 }));
  for (const s of [-1, 1]) k.add("alu", extrudeZ([[-40, 36], [-34, 36], [22, Y + 16], [22, Y + 18], [-40, Y + 18]], 2.4, { bevel: 0.6, z: Z + s * 17.8 }));
  // переключатель: 4 сетки × яркость, риски на торце
  k.add("alu", T(cylZ(7, Z + 17, Z + 19.4, { seg: 24 }), { p: [-18, 33, 0] }));
  dialZ(k, "alu", 10, 8, [-18, 33, Z + 18], 1, 8);
  k.add("paintWhite", T(box(1, 0.8, 3.2), { p: [-18, 43.8, Z + 18.6] }));
  // батарейный отсек сзади
  k.add("alu", T(cylX(7.5, -50, -38, { c: 1, seg: 24 }), { p: [0, 33, Z] }));
  k.add("alu", T(ctx.C.knob(8.2, 5, 22), { r: [0, 180, 0], p: [-50, 33, Z] }));
  for (const [x, z] of [[-32, Z - 14], [-32, Z + 14], [18, Z - 14], [18, Z + 14]]) k.add("steel", capScrew(1.5, 0.6), { p: [x, 41, z] });
  const root = node("kobra", [k.build()]);
  const win = lens(ctx, T(extrudeX(rrect(Z, Y + 1, 30, 30, 4), -0.6, 0.6, { bevel: 0.2 }), { p: [28, 0, 0] }), "glassAmber");
  root.add(win);
  return { root, sight: { y: Y + 1, z: Z, x0: -42, x1: 28, r: 14, mag: 1, reticle: "kobra", lens: win } };
}
// ПОСП 4–12×42: переменная кратность, штатный кронштейн на «ласточкин хвост» с кольцами.
function posp(ctx) {
  const k = ctx.kit();
  dovetailClamp(k, -70, 50, { screws: [-58, 38] });
  dovetailLever(k, -52, -18);
  const Y = 62, Z = 13;
  const at = (g, t = {}) => T(g, { ...t, p: [t.p?.[0] || 0, Y + (t.p?.[1] || 0), Z + (t.p?.[2] || 0)] });
  k.add("steel", extrudeX(shape([[-12, 6, 2], [4, 6, 2], [Z + 6, Y - 24, 4], [Z - 8, Y - 16, 4], [-12, 18, 2]]), -66, 46, { bevel: 1.5 }));
  for (const x of [-48, 26]) {
    k.add("steel", T(tubeX(19.5, 15.1, x - 9, x + 9, { seg: 44, c: 1 }), { p: [0, Y, Z] }));
    for (const s of [-1, 1]) k.add("steel", T(box(16, 4.4, 6, { bevel: 1 }), { p: [x, Y, Z + s * 19.6] }));
    for (const s of [-1, 1]) k.add("lensBlack", T(box(17, 0.4, 7.2, { bevel: 0.1 }), { p: [x, Y, Z + s * 19.3] }));
    for (const s of [-1, 1]) for (const d of [-4, 4]) k.add("steel", capScrew(1.8, 1), { p: [x + d, Y + 2.2, Z + s * 19.6] });
  }
  scopeBody(ctx, k, at, { tube: 15, obj: 21, turret: 13, x0: -186, x1: 116, saddle: -8, mat: "steel" });
  const root = node("posp", [k.build()]);
  const oc = lens(ctx, at(ctx.C.lensDisc(18.5, -184)), "glassBlue");
  const ob = lens(ctx, at(ctx.C.lensDisc(21, 114)), "glassAmber");
  root.add(oc, ob);
  return { root, sight: { y: Y, z: Z, x0: -186, x1: 116, r: 15, mag: 4, zoom: [4, 12], reticle: "pso1", eyeRelief: 80, lens: oc } };
}
var DOVETAIL = [
  { id: "side_mount", cat: "sidemount", name: "Кронштейн «ласточкин хвост» — Пикатинни", desc: "Боковое крепление с планкой над крышкой", only: ["svd", "ak74", "akm"], mountTypes: ["dovetail"], stats: { weight: 190 }, build: sideMount },
  { id: "pso1", cat: "optic", name: "ПСО-1 4×24", desc: "Снайперский прицел с дальномерной шкалой и подсветкой", only: ["svd", "ak74", "akm"], mountTypes: ["dovetail"], foot: [-60, 40], body: [-212, 177], needs: (cfg) => !cfg.sidemount, stats: { weight: 580, ergo: -8, adsTime: 45 }, build: pso1 },
  { id: "posp", cat: "optic", name: "ПОСП 4–12×42 В", desc: "Переменная кратность, сетка типа ПСО, колесо — кратность", only: ["svd", "ak74", "akm"], mountTypes: ["dovetail"], foot: [-70, 50], body: [-186, 116], needs: (cfg) => !cfg.sidemount, stats: { weight: 760, ergo: -10, adsTime: 55 }, build: posp },
  { id: "kobra", cat: "optic", name: "ЭКП-1С-03 «Кобра»", desc: "Коллиматор, четыре сетки, крепление на боковую планку", only: ["svd", "ak74", "akm"], mountTypes: ["dovetail"], foot: [-50, 40], body: [-50, 40], needs: (cfg) => !cfg.sidemount, stats: { weight: 380, ergo: -3, adsTime: 15 }, build: kobra }
];

