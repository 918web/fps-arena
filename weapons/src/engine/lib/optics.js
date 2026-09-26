function lens(ctx, geo, mat = "glass") {
  const m = new ctx.THREE.Mesh(geo, ctx.mats.get(mat).clone());
  m.renderOrder = 10;
  m.userData.lens = true;
  return m;
}
// Барабан из общего конструктора: металл + белые штрихи шкалы. t — поворот/перенос оси +y.
function optTurret(k, mat, o, t) {
  const tt = turret(o);
  k.add(mat, tt.m, t);
  if (tt.w.length) k.add(o.paint || "paintWhite", tt.w, t);
}
// Радиальные риски на торце ручки (ось +x, торец в плоскости x).
function faceTicks(r0, r1, n, x, o = {}) {
  const gs = [], arc = o.arc ?? 360, a0 = o.a0 ?? 0;
  for (let i = 0; i < n; i++) {
    const L = (i % (o.major ?? 1000) === 0 ? 1.4 : 1) * (r1 - r0);
    gs.push(T(T(box(0.3, L, o.w ?? 0.5, { bevel: 0.08 }), { p: [x, r1 - L / 2, 0] }), { r: [a0 + i / n * arc, 0, 0] }));
  }
  return merge(gs);
}
// Ручка яркости с рисками на торце, ось +z (правый борт) или -z (dir=-1).
function dialZ(k, mat, r, h, p, dir = 1, n = 12) {
  const t = { r: [0, dir > 0 ? -90 : 90, 0], p };
  k.add(mat, knob(r, h, Math.round(r * 2.8)), t);
  k.add("paintWhite", faceTicks(r * 0.45, r * 0.78, n, h + 0.05, { arc: 300, a0: 30, major: 4 }), { ...t });
}
function t2(ctx, A) {
  const k = ctx.kit();
  const at = (g, t = {}) => T(g, { ...t, p: [t.p?.[0] || 0, A + (t.p?.[1] || 0), t.p?.[2] || 0] });
  k.add("alu", clampBody(-18, 18, 5.5));
  if (A > 30) {
    // LaRue LT660: башня с окном облегчения, рычаг QD слева, гайка натяжения справа
    const tower = shape([[-17, 5], [17, 5], [17, A - 12, 3], [-17, A - 12, 3]], [slot(-9, 9, (A - 7) / 2 + 3, 9)]);
    k.add("alu", extrudeZ(tower, 18, { bevel: 1.2 }));
    k.add("steel", qdLever(-14, 12, -1));
    k.add("steel", crossBolt(0, -2.5, 13).slice(0, 2));
    for (const x of [-12, 12]) k.add("steel", capScrew(1.8, 1), { p: [x, A - 12, 5] });
  } else {
    k.add("steel", crossBolt(0));
  }
  // корпус: трубка с фирменным пояском, расширенная бленда спереди
  k.add("alu", at(hollowLathe([[-34, 14], [-33.4, 15.2], [-25, 15.2], [-24.4, 15.7], [-21, 15.7], [-20.4, 15.2], [16, 15.2], [18, 16], [20.5, 16.6], [32.6, 16.6], [33.6, 16.1], [34, 15.2]], 12.2, { seg: 44 })));
  k.add("lensBlack", at(tubeX(12.3, 11.6, -32, 32, { seg: 32 })));
  // интегральное основание и блок барабанов
  k.add("alu", extrudeX([[-11, A - 16, 2], [11, A - 16, 2], [11, A - 8], [-11, A - 8]], -17, 17, { bevel: 1 }));
  // блок барабанов охватывает трубку: канал на оси открыт
  k.add("alu", extrudeX(shape(rrect(0, A, 31.4, 31.4, 10), [circle(0, A, 15.1, 40)]), -6, 12, { bevel: 1.2 }));
  optTurret(k, "alu", { cap: true, r: 7, h: 6.2, base: 1, knurl: 24 }, { p: [3, A + 15.4, 0] });
  optTurret(k, "alu", { cap: true, r: 7, h: 6.2, base: 1, knurl: 24 }, { r: [90, 0, 0], p: [3, A, 15.4] });
  // ручка яркости (12 положений) справа сзади
  k.add("alu", at(cylZ(6.5, 12, 14.6, { seg: 24 }), { p: [-17, -1, 0] }));
  dialZ(k, "alu", 10, 6.2, [-17, A - 1, 14.2]);
  k.add("steel", at(cylZ(3.2, -16.6, -15, { seg: 16 }), { p: [-17, -1, 0] }));
  const capR = T(flipCap(12.5).translate(0, -15.5, 0), { r: [0, 0, -100], p: [-35, 15.5, 0] });
  const capF = T(flipCap(13.5).translate(0, -16.5, 0), { r: [0, 0, 100], p: [34, 16.5, 0] });
  k.add("rubber", at(capR));
  k.add("rubber", at(capF));
  k.add("rubber", at(tubeX(16.8, 15.1, -31, -25.6, { seg: 32 })));
  k.add("rubber", at(tubeX(17.8, 16.5, 25, 31, { seg: 32 })));
  const root = node("t2", [k.build()]);
  const rear = lens(ctx, at(ctx.C.lensDisc(12.4, -31)), "glassBlue");
  const front = lens(ctx, at(ctx.C.lensDisc(12.6, 31)), "glassRed");
  root.add(rear, front);
  return { root, sight: { y: A, z: 0, x0: -34, x1: 34, r: 12, mag: 1, reticle: "dot", lens: front } };
}
// EOTech EXPS3 / XPS2: основание с батарейным отсеком CR123 поперёк, капюшон с плоскими бортами,
// кнопки (EXPS — слева сзади, XPS — на заднем торце), винты поправок справа под окном.
function exps3(ctx, o = {}) {
  const k = ctx.kit();
  const A = 39, xs = !!o.xps2, X0 = xs ? -40 : -48;
  k.add("alu", clampBody(xs ? -16 : -22, xs ? 16 : 22, 6));
  if (xs) {
    k.add("steel", crossBolt(0, -2.5, 13, { nutR: 0 }));
    k.add("steel", T(thumbNut(6.6, 4.2), { r: [0, -90, 0], p: [0, -2.5, 13] }));
  } else k.add("steel", qdLever(-16, 12, -1.5));
  k.add("alu", extrudeX([[-17, 5, 1], [17, 5, 1], [17, 15, 3], [-17, 15, 3]], X0, 46, { bevel: 1.2 }));
  k.add("alu", extrudeX([[-17, 12], [17, 12], [17, 28, 6], [-17, 28, 6]], X0, -21, { bevel: 2 }));
  if (xs) {
    for (const [y, z] of [[21, -7], [21, 7], [15.5, 0]]) k.add("rubber", cylX(2.9, X0 - 2.2, X0 + 1, { c: 0.8, seg: 16 }), { p: [0, y, z] });
  } else {
    for (const [x, y] of [[-42, 22], [-34, 22], [-38, 16]]) k.add("rubber", cylZ(3.1, -19.4, -16.5, { c: 0.8, seg: 16 }), { p: [x, y, 0] });
    k.add("alu", extrudeZ(rrect(-38, 19.5, 18, 15, 3), 1.2, { bevel: 0.4, z: -17.2 }));
  }
  // винты поправок справа: утоплены в прилив, шлиц + стрелки
  k.add("alu", extrudeZ(rrect(-35, 20, 16, 11, 4), 3, { bevel: 0.8, z: 17.5 }));
  for (const x of [-40, -30]) {
    k.add("steel", cylZ(3.3, 18.5, 19.6, { c: 0.5, seg: 18 }), { p: [x, 21, 0] });
    k.add("lensBlack", T(box(0.8, 4.2, 0.6, { bevel: 0.1 }), { p: [x, 21, 19.6] }));
    k.add("paintWhite", T(box(2.2, 0.4, 0.3), { p: [x, 25.3, 19.1] }));
  }
  // капюшон: прямые борта, скруглённая крыша; утолщённые рамки у окон
  const outer = [[-21, 12, 0], [21, 12, 0], [21, 63, 13], [-21, 63, 13]];
  const inner = [[-16.4, 21, 2], [16.4, 21, 2], [16.4, 58, 9], [-16.4, 58, 9]];
  const hx0 = xs ? -19 : -22;
  k.add("alu", extrudeX(shape(outer, [inner]), hx0, 44, { bevel: 1.2 }));
  k.add("alu", extrudeX(shape(outer.map(([z, y, r]) => [z * 1.03, y === 12 ? 12 : y + 0.6, r]), [inner]), 40.5, 44.6, { bevel: 0.8 }));
  k.add("alu", extrudeX(shape(outer.map(([z, y, r]) => [z * 1.03, y === 12 ? 12 : y + 0.6, r]), [inner]), hx0 - 0.4, hx0 + 3, { bevel: 0.8 }));
  // фирменная площадка на бортах капюшона
  for (const s of [-1, 1]) k.add("aluGrey", extrudeZ(rrect(12, 44, 30, 9, 2), 0.8, { bevel: 0.2, z: s * 21.2 }));
  // батарейный отсек CR123 поперёк, рифлёная крышка справа
  k.add("alu", T(cylZ(9.5, -17, 17, { c: 1, seg: 28 }), { p: [34, 16, 0] }));
  k.add("alu", T(ctx.C.knob(9.8, 6, 24), { r: [0, -90, 0], p: [34, 16, 17] }));
  k.add("steel", T(capScrew(1.6, 1), { r: [90, 0, 0], p: [34, 16, 23.1] }));
  const root = node(xs ? "xps2" : "exps3", [k.build()]);
  const rp = rrect(0, A - 1, 30, 28, 8);
  const rear = lens(ctx, extrudeX(rp, -14, -12.8, { bevel: 0.2 }), "glassBlue");
  const front = lens(ctx, extrudeX(rp, 36, 37.2, { bevel: 0.2 }), "glassAmber");
  root.add(rear, front);
  return { root, sight: { y: A, z: 0, x0: -14, x1: 37, r: 14, mag: 1, reticle: "holo", lens: front } };
}
// Trijicon MRO: короткая трубка с расширяющимся объективом 25 мм, колпачки сверху и справа,
// крупная ручка яркости слева, быстросъёмное основание.
function mro(ctx, A) {
  const k = ctx.kit();
  const at = (g, t = {}) => T(g, { ...t, p: [t.p?.[0] || 0, A + (t.p?.[1] || 0), t.p?.[2] || 0] });
  k.add("alu", clampBody(-20, 20, 5.5));
  k.add("steel", qdLever(-14, 14, -1));
  k.add("alu", extrudeZ(shape([[-18, 4, 2], [18, 4, 2], [16, A - 12, 3], [-16, A - 12, 3]], [slot(-8, 8, (A - 8) / 2 + 2, 8)]), 16, { bevel: 1.2 }));
  k.add("alu", extrudeX([[-9, A - 14, 2], [9, A - 14, 2], [9, A - 9], [-9, A - 9]], -15, 15, { bevel: 1 }));
  k.add("alu", at(hollowLathe([[-30, 11.6], [-29, 12.8], [-24, 12.9], [-23.6, 13.3], [-20.5, 13.4], [-20, 13], [-8, 13.4], [14, 16.2], [26, 17.6], [30, 17.6], [31, 16.6]], 10.8, { seg: 44 })));
  k.add("lensBlack", at(tubeX(10.9, 10.2, -29, 30, { seg: 32 })));
  // поясок барабанов — кольцо вокруг трубки, канал на оси открыт
  k.add("alu", at(hollowLathe([[-9, 13.8], [-8, 14.4], [8, 15.2], [9, 14.6]], 12.9, { seg: 32 })));
  optTurret(k, "alu", { cap: true, r: 6.6, h: 5.6, base: 1, knurl: 22 }, { p: [0, A + 14, 0] });
  optTurret(k, "alu", { cap: true, r: 6.6, h: 5.6, base: 1, knurl: 22 }, { r: [90, 0, 0], p: [0, A, 14.2] });
  dialZ(k, "alu", 8.6, 5.5, [-6, A, -13.8], -1, 8);
  k.add("paintWhite", at(box(0.6, 3, 0.6), { p: [-6, -9.6, -19.4] }));
  const root = node("mro", [k.build()]);
  const rear = lens(ctx, at(ctx.C.lensDisc(10.8, -28)), "glassBlue");
  const front = lens(ctx, at(ctx.C.lensDisc(16.6, 29.5)), "glassRed");
  root.add(rear, front);
  return { root, sight: { y: A, z: 0, x0: -30, x1: 31, r: 10, mag: 1, reticle: "dot", lens: front } };
}
// Holosun HS510C: открытая рамка-щит, солнечная панель сверху, батарейный лоток справа,
// кнопки слева, излучатель в основании за стеклом.
function hs510c(ctx) {
  const k = ctx.kit();
  const A = 35;
  k.add("alu", clampBody(-22, 22, 6));
  k.add("steel", qdLever(-16, 12, -1.5));
  k.add("alu", extrudeX([[-17, 5, 1], [17, 5, 1], [17, 17, 3], [-17, 17, 3]], -34, 30, { bevel: 1.2 }));
  const fr = shape([[-19, 14], [19, 14], [19, 50, 7], [-19, 50, 7]], [[[-14.5, 20, 3], [14.5, 20, 3], [14.5, 45, 5], [-14.5, 45, 5]]]);
  k.add("alu", extrudeX(fr, 6, 16, { bevel: 1.2 }));
  for (const s of [-1, 1]) k.add("alu", extrudeZ([[-30, 14], [16, 14], [16, 48, 4], [4, 50, 3], [-20, 20, 4]], 3, { bevel: 0.8, z: s * 17.5 }));
  // солнечная панель в рамке
  k.add("alu", extrudeX(rrect(0, 50.2, 30, 2.4, 1), -9, 13, { bevel: 0.5 }));
  k.add("lensBlack", extrudeX(rrect(0, 51.5, 24, 0.8, 0.3), -8, 12, { bevel: 0.2 }));
  k.add("glassBlue", extrudeX(rrect(0, 51.9, 22, 0.4, 0.15), -7, 11, { bevel: 0.1 }));
  // кнопки +/− слева, батарейный лоток CR2032 справа
  for (const x of [-22, -12]) k.add("rubber", cylZ(3.2, -20.4, -18, { c: 0.8, seg: 16 }), { p: [x, 12, 0] });
  k.add("alu", T(extrudeX(rrect(0, 0, 4, 12, 1.5), -28, -6, { bevel: 0.8 }), { p: [0, 11, 18.8] }));
  k.add("steel", T(capScrew(1.8, 1), { r: [90, 0, 0], p: [-10, 11, 20.8] }));
  // излучатель и винты поправок
  k.add("alu", extrudeX(rrect(0, 20, 9, 6, 2), -24, -16, { bevel: 0.8 }));
  k.add("lensBlack", cylX(1.6, -16.2, -15.6, { seg: 12 }), { p: [0, 20.5, 0] });
  k.add("steel", T(capScrew(2, 1), {}), { p: [-4, 17, 0] });
  k.add("steel", T(capScrew(2, 1), { r: [90, 0, 0] }), { p: [-2, 12, 17] });
  const root = node("hs510c", [k.build()]);
  const glass = lens(ctx, extrudeX(rrect(0, A - 2.4, 29, 25, 4), 10.4, 11.4, { bevel: 0.2 }), "glassBlue");
  root.add(glass);
  return { root, sight: { y: A, z: 0, x0: -30, x1: 16, r: 12, mag: 1, reticle: "holo", lens: glass } };
}
// Trijicon ACOG TA31RCO + RMR: кованый корпус со скруглённым сечением, окуляр с рёбрами,
// раструб объектива 32 мм, оптоволокно в канале сверху, колпачки поправок, основание TA51
// с двумя барашками слева, RMR на переходнике над корпусом.
function acog(ctx) {
  const k = ctx.kit();
  const A = 38;
  const at = (g, t = {}) => T(g, { ...t, p: [t.p?.[0] || 0, A + (t.p?.[1] || 0), t.p?.[2] || 0] });
  k.add("alu", clampBody(-32, 32, 7));
  for (const x of [-18, 18]) {
    k.add("steel", T(thumbNut(7.6, 5, 8), { r: [0, 90, 0], p: [x, -2, -13] }));
    k.add("steel", cylZ(2.6, -13, 16.6, { seg: 12 }), { p: [x, -2, 0] });
    k.add("steel", crossBolt(x, -2, 13).slice(0, 1));
  }
  k.add("alu", extrudeX([[-12, 6], [12, 6], [12, A - 14, 3], [-12, A - 14, 3]], -34, 34, { bevel: 1.2 }));
  for (const s of [-1, 1]) k.add("alu", extrudeZ([[-30, 10, 2], [30, 10, 2], [22, A - 16, 3], [-22, A - 16, 3]], 2, { bevel: 0.5, z: s * 12.6 }));
  // окуляр с рёбрами
  const oc = [[-75, 15.6], [-74.6, 18.2], [-73.4, 19.4]];
  for (let i = 0; i < 6; i++) { const x = -71.5 + i * 3.4; oc.push([x, 19.4], [x + 0.6, 18.6], [x + 1.6, 18.6], [x + 2.2, 19.4]); }
  oc.push([-50, 19.4], [-48.5, 18.2], [-44, 18.2]);
  k.add("alu", at(hollowLathe(oc, 15.9, { seg: 44 })));
  // корпус призмы: скруглённое сечение
  const ring = (x, a, b, cy = 0) => ({ x, pts: superEllipse(a, b, 3.2, 40, A + cy, 0) });
  k.add("alu", loftX([ring(-46, 16.6, 17.4, 0.6), ring(-43, 18, 19.2, 0.8), ring(22, 18, 19.2, 0.8), ring(30, 17, 18.6, 0.4)], { crease: 60 }));
  k.add("alu", at(hollowLathe([[28, 18.6], [36, 19.2], [44, 21.5], [60, 24.2], [66, 24.2], [66.6, 24.6], [71, 24.6], [71.6, 24.2], [74, 24.2], [75.5, 23]], 16.5, { seg: 48 })));
  k.add("lensBlack", at(tubeX(16.6, 15.5, -72, 73, { seg: 32 })));
  // колпачки поправок: сверху и справа, за RMR
  optTurret(k, "alu", { cap: true, r: 7.4, h: 7.5, base: 1.4, knurl: 26 }, { p: [-31, A + 19.4, 0] });
  optTurret(k, "alu", { cap: true, r: 7.4, h: 7.5, base: 1.4, knurl: 26 }, { r: [90, 0, 0], p: [-31, A + 0.8, 17.6] });
  // оптоволокно: канал с поперечными перемычками над объективом
  k.add("alu", extrudeX(shape([[-7, A + 16, 2], [7, A + 16, 2], [7, A + 26.5, 2], [-7, A + 26.5, 2]], [rrect(0, A + 26.5, 5.4, 4, 1)]), 29, 62, { bevel: 1.2 }));
  k.add("emGreen", extrudeX(rrect(0, A + 25, 3.4, 2.4, 1.1), 30, 61, { bevel: 0.3 }));
  for (let i = 0; i < 7; i++) k.add("alu", T(box(1.6, 1.6, 6.4, { bevel: 0.3 }), { p: [32.5 + i * 4.6, A + 26.4, 0] }));
  // переходник RMR и сам RMR
  const rb = A + 19.2;
  k.add("alu", extrudeX(shape([[-13, rb - 3, 2], [13, rb - 3, 2], [13, rb + 2.4, 1.5], [-13, rb + 2.4, 1.5]]), -22, 27, { bevel: 1 }));
  for (const x of [-15, 20]) k.add("steel", capScrew(1.7, 0.8), { p: [x, rb + 2.4, 8.5] });
  const m = ctx.kit();
  const RA = rmrBody(ctx, m);
  const rm = m.build();
  rm.position.set(4, rb + 2.4, 0);
  const root = node("acog", [k.build(), rm]);
  const ocL = lens(ctx, at(ctx.C.lensDisc(15.8, -72)), "glassBlue");
  const ob = lens(ctx, at(ctx.C.lensDisc(17, 73)), "glassAmber");
  const ry = rb + 2.4 + RA + 0.5;
  const rmr = lens(ctx, extrudeX(shape(rrect(0, ry, 18.6, 13.4, 5)), 10, 11, { bevel: 0.2 }), "glassAmber");
  root.add(ocL, ob, rmr);
  return {
    root,
    sight: { y: A, z: 0, x0: -74, x1: 75, r: 15, mag: 4, reticle: "chevron", eyeRelief: 38, lens: ocL },
    alt: [{ label: "RMR сверху", y: ry, z: 0, x0: -18, x1: 11, r: 6, mag: 1, reticle: "dot", lens: rmr }]
  };
}
// Прицел 1–6×24 (класс Vortex Razor/Nightforce ATACR): трубка 30 мм, окуляр с диоптрийным кольцом,
// кольцо кратности с рычагом и цифрами, открытые барабаны, подсветка слева, моноблок-кронштейн.
function lpvo(ctx) {
  const k = ctx.kit();
  const A = 40;
  const at = (g, t = {}) => T(g, { ...t, p: [t.p?.[0] || 0, A + (t.p?.[1] || 0), t.p?.[2] || 0] });
  k.add("alu", at(hollowLathe([
    [-132, 18], [-131, 21.6], [-126, 22.2], [-98, 22.2], [-92, 20], [-74, 18.2], [-72, 19.4], [-54, 19.4], [-52, 15.2],
    [-30, 15.2], [-28, 18], [14, 18], [16, 15.2], [30, 15.2], [46, 18.6], [96, 18.6], [96.6, 19], [100, 19], [100.6, 18.6], [104, 17.8]
  ], 14.5, { seg: 48 })));
  k.add("rubber", at(tubeX(22.8, 21.5, -125, -106, { seg: 44 })));
  k.add("alu", at(flutesX(21.8, -130.6, -127, 44, 1, 0.8)));
  k.add("paintWhite", at(hashMarks(22.25, -101, 9, { arc: 80, a0: -40, major: 4, len: 1.2 })));
  k.add("lensBlack", at(tubeX(14.6, 13.6, -130, 102, { seg: 32 })));
  k.add("rubber", at(flutesX(19.2, -71, -56, 24, 1.6, 0.9)));
  k.add("paintWhite", at(hashMarks(19.3, -72.6, 6, { arc: 120, a0: -60, major: 1, len: 1.1 })));
  // рычаг смены кратности с рифлёным пальцевым упором
  k.add("alu", at(extrudeZ([[-70, 17], [-60, 17], [-61.4, 27, 3], [-68.6, 27, 3]], 5, { bevel: 1 }), { r: [-25, 0, 0] }));
  k.add("alu", at(extrudeZ([[-71.5, 26, 2], [-58.5, 26, 2], [-58.5, 31, 2.4], [-71.5, 31, 2.4]], 7, { bevel: 1.4 }), { r: [-25, 0, 0] }));
  // седло и барабаны
  optTurret(k, "alu", { r: 11.6, h: 11, base: 2, marks: 40, knurl: 40 }, { p: [-8, A + 17.6, 0] });
  optTurret(k, "alu", { r: 11.6, h: 10, base: 2, marks: 40, knurl: 40 }, { r: [90, 0, 0], p: [-8, A, 17.6] });
  dialZ(k, "alu", 10.5, 8, [-8, A, -17.2], -1, 11);
  k.add("paintWhite", at(box(0.6, 3, 0.6), { p: [-8, 11.6, -17.4] }));
  // моноблок: две полукольца на общей базе, облегчающие выборки
  k.add("alu", clampBody(-38, 34, 7));
  k.add("steel", crossBolt(-20));
  k.add("steel", crossBolt(18));
  k.add("alu", extrudeX([[-12, 6, 1], [12, 6, 1], [12, A - 16], [-12, A - 16]], -40, 36, { bevel: 1.5 }));
  for (const s of [-1, 1]) for (const x of [-12, 2]) k.add("lensBlack", extrudeZ(rrect(x, 14, 10, 6, 3), 0.8, { bevel: 0.2, z: s * 12.2 }));
  for (const x of [-44, 20]) {
    k.add("alu", at(tubeX(20.5, 15.3, x, x + 16, { seg: 44, c: 1.2 })));
    k.add("alu", extrudeX([[-13, A - 18], [13, A - 18], [13, A - 8], [-13, A - 8]], x, x + 16, { bevel: 1 }));
    for (const s of [-1, 1]) k.add("lensBlack", T(box(15.2, 0.5, 2.2, { bevel: 0.1 }), { p: [x + 8, A, s * 19.6] }));
    for (const s of [-1, 1]) for (const d of [4, 12]) k.add("steel", capScrew(2.1, 1.2), { p: [x + d, A + 19.7, s * 9] });
  }
  const root = node("lpvo", [k.build()]);
  const oc = lens(ctx, at(ctx.C.lensDisc(20, -129)), "glassBlue");
  const ob = lens(ctx, at(ctx.C.lensDisc(16.6, 101)), "glassAmber");
  root.add(oc, ob);
  return { root, sight: { y: A, z: 0, x0: -132, x1: 104, r: 15, mag: 1, zoom: [1, 6], reticle: "lpvo", eyeRelief: 95, lens: oc } };
}
// Aimpoint 3XMag-1 на FTS: откидной кронштейн с кнопкой, винты выверки, резиновый наглазник.
function magnifier(ctx) {
  const k = ctx.kit(), f = ctx.kit();
  const A = 39;
  k.add("alu", clampBody(-16, 16, 6));
  k.add("steel", crossBolt(0));
  k.add("alu", extrudeZ([[-14, 5], [14, 5], [14, 16, 3], [-14, 16, 3]], 24, { bevel: 1.2 }));
  k.add("alu", extrudeX([[-18, 10, 2], [-8, 10, 2], [-8, 22, 3], [-18, 22, 3]], -14, 14, { bevel: 1 }));
  k.add("steel", cylX(3.6, -16, 16, { seg: 16 }), { p: [0, 17, -17] });
  for (const x of [-16, 16]) k.add("steel", cylX(4.4, x - 0.8, x + 0.8, { seg: 16 }), { p: [0, 17, -17] });
  k.add("steel", T(ctx.C.knob(6, 5, 16), { r: [0, -90, 0], p: [0, 10, 12] }));
  // кнопка откидывания справа
  k.add("rubber", cylZ(3.2, 11.5, 14.4, { c: 1, seg: 18 }), { p: [10, 9, 0] });
  f.add("alu", extrudeX(shape([[-17, 12, 2], [-10, 12, 2], [4, A - 20, 4], [12, A - 12, 3], [-6, A - 10, 3], [-19, 22, 2]]), -12, 12, { bevel: 1.2 }));
  f.add("alu", hollowLathe([[-56, 15], [-55, 17.5], [-40, 17.5], [-36, 16.4], [48, 16.4], [54, 15.2]], 12.5, { seg: 44 }).translate(0, A, 0));
  const eye = [[-56.5, 16.5], [-56, 19.6]];
  for (let i = 0; i < 4; i++) { const x = -55 + i * 3.6; eye.push([x, 19.6], [x + 0.8, 18.9], [x + 2, 18.9], [x + 2.8, 19.6]); }
  eye.push([-40, 19.6], [-39.5, 16.5]);
  f.add("rubber", hollowLathe(eye, 16.5, { seg: 44 }).translate(0, A, 0));
  f.add("alu", T(flutesX(16.2, 0, 12, 20, 1.4, 0.8), { p: [20, A, 0] }));
  // башенки выверки сверху и справа (на корпусе увеличителя)
  optTurret(f, "alu", { cap: true, r: 5.6, h: 4.5, base: 1, knurl: 18 }, { p: [-8, A + 16, 0] });
  optTurret(f, "alu", { cap: true, r: 5.6, h: 4.5, base: 1, knurl: 18 }, { r: [90, 0, 0], p: [-8, A, 16] });
  f.add("alu", T(latheX([[-15, 0], [-15, 16.2], [-14, 17.4], [-2, 17.4], [-1, 16.2], [-1, 0]], { seg: 40 }), { p: [0, A, 0] }));
  f.add("alu", extrudeX([[-6, A - 17], [6, A - 17], [6, A - 12], [-6, A - 12]], -12, 12, { bevel: 0.8 }));
  const lensM = lens(ctx, ctx.C.lensDisc(12.6, -53).translate(0, A, 0), "glassBlue");
  const lensF = lens(ctx, ctx.C.lensDisc(12.6, 51).translate(0, A, 0), "glassAmber");
  const body = node("magBody", [f.build(), lensM, lensF]);
  const flip = node("flip", [body]);
  flip.position.set(0, 17, -17);
  body.position.set(0, -17, 17);
  return { root: node("mag3x", [k.build(), flip]), sight: { y: A, z: 0, x0: -56, x1: 54, r: 12, mag: 3, eyeRelief: 70, magnifier: true, suffix: " + 3×", lens: lensM }, flipAside: { node: flip, angle: -88 } };
}
// Trijicon RMR Type 2: корпус-«клин» с закруглённым капюшоном, ушки защиты стекла,
// винты поправок сверху и справа, кнопки с обеих сторон, окно излучателя сзади.
function rmrBody(ctx, k) {
  const A = 15;
  // основание: трапециевидное сечение, скос к затылку
  k.add("alu", loftX([{ x: -22, pts: superEllipse(10.6, 3.4, 5, 32, 4, 0) }, { x: -19.5, pts: superEllipse(12.3, 4.5, 5, 32, 4.5, 0) }, { x: 23, pts: superEllipse(12.3, 4.5, 5, 32, 4.5, 0) }], { crease: 50 }));
  k.add("alu", extrudeZ([[-21, 8], [-6, 8], [-6, 10.8, 1.5], [-10, 11.8, 2], [-19, 11.2, 2], [-21, 9.5, 1]], 22.6, { bevel: 1.2 }));
  const arch = (w, h, y0) => {
    const pts = [[w, y0]];
    for (let i = 0; i <= 14; i++) {
      const a = i / 14 * Math.PI;
      pts.push([Math.cos(a) * w, h - w * 0.55 + Math.sin(a) * w * 0.55]);
    }
    pts.push([-w, y0]);
    return pts;
  };
  const hood = shape(arch(12.7, 25.4, 7), [arch(9.6, 22.4, 8.6)]);
  k.add("alu", extrudeX(hood, -3, 15, { bevel: 1 }));
  // «ушки»: утолщения капюшона у основания спереди
  for (const s of [-1, 1]) k.add("alu", extrudeX([[s * 12.9, 7], [s * 9.8, 7], [s * 9.8, 13], [s * 12.9, 16, 1]], 9, 16.4, { bevel: 0.6 }));
  for (const s of [-1, 1]) k.add("rubber", T(cylZ(3.2, 0, 1.6, { c: 0.6, seg: 16 }), { p: [-15, 10, s * 12.2], r: s < 0 ? [0, 180, 0] : [0, 0, 0] }));
  // окно излучателя и винты поправок
  k.add("lensBlack", extrudeX(rrect(0, 9.8, 5, 2.6, 1), -6.4, -5.8, { bevel: 0.1 }));
  k.add("steel", T(cylY(2.6, 10.5, 12.2, { seg: 14 }), { p: [-16, 0, 0] }));
  k.add("lensBlack", T(box(3.6, 0.5, 0.7, { bevel: 0.1 }), { p: [-16, 12.2, 0] }));
  k.add("steel", T(cylZ(2.6, 12.2, 13.8, { seg: 14 }), { p: [-2, 12, 0] }));
  k.add("lensBlack", T(box(0.7, 3.6, 0.5, { bevel: 0.1 }), { p: [-2, 12, 13.8] }));
  for (const s of [-1, 1]) k.add("steel", T(capScrew(1.5, 0.6), { r: [s * 90, 0, 0] }), { p: [-15, 4.5, s * 12.2] });
  return A;
}
function rmrOffset(ctx) {
  const k = ctx.kit(), m = ctx.kit();
  k.add("alu", clampBody(-12, 12, 5, { w: 24 }));
  k.add("steel", crossBolt(0));
  k.add("alu", extrudeX([[-12, 3, 1], [12, 3, 1], [30, 14, 3], [26, 21, 3], [6, 12, 3], [-12, 8, 2]], -12, 12, { bevel: 1.2 }));
  k.add("steel", T(capScrew(2, 1), { r: [-45, 0, 0] }), { p: [0, 14, 21] });
  m.add("alu", extrudeX(rrect(0, -1.5, 27, 5, 1.5), -23, 24, { bevel: 0.8 }));
  const A = rmrBody(ctx, m);
  const glass = lens(ctx, extrudeX(shape(rrect(0, A + 0.5, 18.6, 13.4, 5)), 6, 7, { bevel: 0.2 }), "glassAmber");
  const cant = node("rmrCant", [m.build(), glass]);
  cant.position.set(0, 16.5, 22);
  cant.rotation.x = Math.PI / 4;
  return {
    root: node("rmr_offset", [k.build(), cant]),
    // прицельная ось задана в системе наклонной площадки: при прицеливании оружие заваливается на 45°
    sight: { node: cant, y: A, z: 0, x0: -22, x1: 15, r: 9, mag: 1, reticle: "dot", lens: glass }
  };
}
// AN/PVS-14 на J-образном кронштейне: корпус с батарейным отсеком AA, ручка усиления,
// кольцо фокусировки объектива, наглазник, ИК-подсветка.
function pvs14(ctx) {
  const k = ctx.kit(), f = ctx.kit();
  const A = 39;
  k.add("alu", clampBody(-16, 16, 6));
  k.add("steel", crossBolt(0));
  k.add("alu", extrudeX([[-18, 5, 2], [-6, 5, 2], [-6, 14, 3], [-18, 14, 3]], -15, 15, { bevel: 1 }));
  k.add("steel", cylX(3.6, -17, 17, { seg: 16 }), { p: [0, 11, -15] });
  for (const x of [-17, 17]) k.add("steel", cylX(4.4, x - 0.8, x + 0.8, { seg: 16 }), { p: [0, 11, -15] });
  f.add("alu", extrudeX(shape([[-17, 8, 2], [-9, 7, 2], [0, 12, 2], [10, 12, 2], [10, 16, 2], [-17, 16, 2]]), -14, 14, { bevel: 1 }));
  f.add("poly", T(extrudeX(shape(rrect(0, 0, 36, 12, 3)), -26, 16, { bevel: 1.5 }), { p: [0, 20, 0] }));
  const at = (g) => g.translate(0, A, 0);
  f.add("poly", at(hollowLathe([[-34, 17], [-30, 20], [22, 20], [26, 17.5]], 13, { seg: 44 })));
  f.add("poly", at(hollowLathe([[-62, 16.5], [-34, 16.5]], 13, { seg: 36 })));
  f.add("rubber", at(flutesX(16.5, -58, -40, 24, 1.6, 0.9)));
  // наглазник с «лепестком» и рёбрами
  f.add("rubber", at(hollowLathe([[-86, 20.5], [-84, 21.8], [-80, 21.5], [-72, 19.6], [-64, 18.5], [-62, 17]], 15, { seg: 44 })));
  f.add("rubber", at(flutesX(19.4, -71, -64, 16, 1.4, 0.7)));
  f.add("poly", at(hollowLathe([[26, 19.5], [58, 19.5], [60, 18]], 15, { seg: 44 })));
  f.add("rubber", at(flutesX(19.5, 30, 54, 28, 1.8, 1)));
  f.add("lensBlack", at(tubeX(15, 13.6, 52, 60.2, { seg: 32 })));
  // батарейный отсек слева с рифлёной крышкой, ручка усиления и поворотный выключатель
  f.add("poly", T(cylZ(10, -36, -18, { c: 1, seg: 28 }), { p: [0, A + 4, 0] }));
  f.add("poly", T(ctx.C.knob(10.6, 5, 24), { r: [0, 90, 0], p: [0, A + 4, -36] }));
  f.add("poly", T(ctx.C.knob(8, 7, 12), { r: [0, 90, 0], p: [-22, A, -19] }));
  f.add("poly", T(ctx.C.knob(6.5, 5, 14), { r: [0, 0, 90], p: [-14, A + 20, 0] }));
  f.add("poly", T(box(10, 3, 2.4, { bevel: 0.6 }), { p: [-14, A + 26.2, 0] }));
  f.add("poly", T(extrudeX(rrect(0, 0, 8, 6, 2), 16, 24, { bevel: 0.8 }), { p: [0, A + 19, 9] }));
  f.add("irLens", T(cylX(2.2, 23.6, 24.4, { seg: 14 }), { p: [0, A + 19, 9] }));
  const lensO = lens(ctx, ctx.C.lensDisc(13.8, 56).translate(0, A, 0), "glassBlue");
  const lensE = lens(ctx, ctx.C.lensDisc(14, -64).translate(0, A, 0), "glassRed");
  const body = node("pvsBody", [f.build(), lensO, lensE]);
  const flip = node("flip", [body]);
  flip.position.set(0, 11, -15);
  body.position.set(0, -11, 15);
  return { root: node("pvs14", [k.build(), flip]), sight: { y: A, z: 0, x0: -86, x1: 60, r: 14, mag: 1, eyeRelief: 22, magnifier: true, nv: true, hide: body, suffix: " + PVS-14", lens: lensE }, flipAside: { node: flip, angle: -95 } };
}
// Magpul MBUS Gen 2: полимерный складной диоптр с двумя апертурами и барабаном поправки справа.
function mbusRear(ctx) {
  const k = ctx.kit(), f = ctx.kit();
  k.add("poly", clampBody(-13, 13, 6, { w: 25 }));
  k.add("steel", crossBolt(0));
  k.add("poly", extrudeZ([[-13, 5], [13, 5], [13, 11, 3], [-13, 11, 3]], 30, { bevel: 1.5 }));
  for (const s of [-1, 1]) k.add("poly", extrudeZ([[-10, 9, 1], [6, 9, 1], [4, 15, 2], [-10, 14, 2]], 3, { bevel: 0.8, z: s * 11 }));
  for (let i = 0; i < 4; i++) k.add("poly", T(box(1.2, 1, 22, { bevel: 0.3 }), { p: [-10 + i * 2.6, 11.2, 0] }));
  f.add("poly", extrudeX(shape([[-13, 0, 1], [13, 0, 1], [13, 42, 3], [-13, 42, 3]], [circle(0, 29.5, 2.7, 24)]), -3.5, 3.5, { bevel: 1 }));
  f.add("poly", T(tubeX(8, 2.6, -2.5, 2.5, { seg: 28 }), { p: [0, 29.5, 0] }));
  f.add("poly", T(tubeX(5.4, 1, -2.2, 2.2, { seg: 20 }), { p: [0, 29.5, 0] }));
  f.add("poly", T(ctx.C.knob(5.2, 5, 16), { r: [0, -90, 0], p: [0, 22, 12] }));
  f.add("paintWhite", T(box(0.5, 2.4, 0.3), { p: [0, 26.2, 13.2] }));
  const flip = node("flip", [f.build()]);
  flip.position.set(4, 10, 0);
  flip.children[0].position.set(-4, -4, 0);
  return { root: node("mbus_rear", [k.build(), flip]), irons: { rear: [0, 35.5, 0], type: "aperture" }, flip: { node: flip, angle: -90 } };
}
function mbusFront(ctx) {
  const k = ctx.kit(), f = ctx.kit();
  k.add("poly", clampBody(-13, 13, 6, { w: 25 }));
  k.add("steel", crossBolt(0));
  k.add("poly", extrudeZ([[-13, 5], [13, 5], [13, 11, 3], [-13, 11, 3]], 30, { bevel: 1.5 }));
  for (let i = 0; i < 4; i++) k.add("poly", T(box(1.2, 1, 22, { bevel: 0.3 }), { p: [4 + i * 2.6, 11.2, 0] }));
  const ear = [[-6, 0, 1], [6, 0, 1], [5, 32, 2], [1, 42, 2], [-2, 42, 2], [-6, 30, 2]];
  f.add("poly", extrudeZ(shape(ear), 3.4, { bevel: 0.8, z: 8 }));
  f.add("poly", extrudeZ(shape(ear), 3.4, { bevel: 0.8, z: -8 }));
  f.add("poly", extrudeZ([[-6, 0, 1], [6, 0, 1], [6, 14, 2], [-6, 14, 2]], 19, { bevel: 1 }));
  // барабан высоты под мушкой (4 защёлки) и стальная мушка
  f.add("poly", T(ctx.C.knob(5.5, 4, 12), { r: [0, 0, 90], p: [0, 14, 0] }));
  f.add("steel", cylY(2, 12, 29.5, { seg: 12 }));
  f.add("steel", extrudeZ([[-1.1, 28], [1.1, 28], [0.8, 35.5, 0.3], [-0.8, 35.5, 0.3]], 1.8, { bevel: 0.2 }));
  const flip = node("flip", [f.build()]);
  flip.position.set(-6, 10, 0);
  flip.children[0].position.set(6, -4, 0);
  return { root: node("mbus_front", [k.build(), flip]), irons: { front: [0, 35.5, 0] }, flip: { node: flip, angle: 90 } };
}
// Корпус оптического прицела вокруг оси: окуляр с быстрой диоптрийной фокусировкой, кольцо
// кратности с рычагом и цифрами, трубка, седло с открытыми барабанами, объектив с резьбой бленды.
// at — перенос на высоту оси; o.tube — радиус трубки (15 = 30 мм, 17 = 34 мм), o.obj — радиус объектива.
function scopeBody(ctx, k, at, o) {
  const r = o.tube, R0 = o.obj + 2.2, x0 = o.x0, x1 = o.x1, M = o.mat || "alu";
  k.add(M, at(hollowLathe([
    [x0, 17], [x0 + 1, 20.5], [x0 + 8, 21.4], [x0 + 48, 21.4], [x0 + 54, 19.2], [x0 + 62, r + 3], [x0 + 86, r + 3], [x0 + 90, r],
    [x1 - 70, r], [x1 - 50, R0 - 3], [x1 - 34, R0], [x1 - 12, R0], [x1 - 11.4, R0 + 0.5], [x1 - 1, R0 + 0.5], [x1, R0 - 0.7]
  ], Math.min(r - 1.6, 14), { seg: 48 })));
  k.add(M, at(flutesX(21.1, x0 + 1.5, x0 + 7.5, 48, 1.1, 0.8)));
  k.add("rubber", at(tubeX(21.8, 20.6, x0 + 11, x0 + 40, { seg: 44 })));
  k.add("paintWhite", at(hashMarks(21.45, x0 + 44, 9, { arc: 80, a0: -40, major: 4, len: 1.2 })));
  k.add("rubber", at(flutesX(r + 2.6, x0 + 64, x0 + 84, 30, 1.6, 1)));
  k.add("paintWhite", at(hashMarks(r + 3.05, x0 + 62.4, 7, { arc: 130, a0: -65, major: 1, len: 1 })));
  k.add(M, at(extrudeZ([[x0 + 70, r + 2], [x0 + 80, r + 2], [x0 + 79, r + 10, 2], [x0 + 71, r + 10, 2]], 6, { bevel: 1 })));
  k.add(M, at(extrudeZ([[x0 + 68.6, r + 9, 2], [x0 + 81.4, r + 9, 2], [x0 + 81.4, r + 13, 2.2], [x0 + 68.6, r + 13, 2.2]], 7, { bevel: 1.3 })));
  k.add("paintWhite", at(T(box(0.6, 3, 0.6), { p: [x0 + 89, r + 0.1, 5] })));
  k.add(M, at(flutesX(R0 + 0.4, x1 - 10.6, x1 - 1.8, 40, 1, 0.6)));
  k.add("lensBlack", at(tubeX(Math.min(r - 1.5, 14), Math.min(r - 2.5, 13), x0 + 1, x1 - 1, { seg: 32 })));
  const sx = o.saddle ?? -10;
  const sl = o.saddleL ?? 26;
  k.add(M, at(extrudeX(shape(rrect(0, 0, 2 * r + 8, 2 * r + 6, r)), sx - sl, sx + sl, { bevel: 2 })));
  // барабаны: высота сверху (с нулевым упором), ветер справа, параллакс слева
  const put = (oo, t) => {
    const tt = turret(oo);
    for (const g of tt.m) k.add(M, at(g, t));
    for (const g of tt.w) k.add("paintWhite", at(g, t));
  };
  put({ r: o.turret, h: o.turret * 0.95, base: 2.4, marks: 50, knurl: 44, markLen: 1.6 }, { p: [sx, r + 3, 0] });
  put({ r: o.turret - 1, h: (o.turret - 1) * 0.8, base: 2.4, marks: 40, knurl: 40, markLen: 1.4 }, { r: [90, 0, 0], p: [sx, 0, r + 4] });
  put({ r: o.turret - 2.5, h: (o.turret - 2.5) * 0.75, base: 2, marks: 20, major: 4, knurl: 34, markLen: 1.2 }, { r: [-90, 0, 0], p: [sx, 0, -r - 4] });
}
// Кольца: основание-зажим, полукольца с разъёмом по горизонтали, по два винта на сторону.
function scopeRings(ctx, k, xs, A, r) {
  for (const x of xs) {
    k.add("alu", clampBody(x - 10, x + 10, 6));
    k.add("steel", crossBolt(x, -2.5, 13));
    k.add("alu", extrudeX([[-10, 5, 1], [10, 5, 1], [8, A - r + 2], [-8, A - r + 2]], x - 9, x + 9, { bevel: 1 }));
    k.add("alu", T(tubeX(r + 4, r + 0.1, x - 9, x + 9, { seg: 44, c: 1 }), { p: [0, A, 0] }));
    for (const s of [-1, 1]) k.add("alu", T(box(16, 5, 7, { bevel: 1.2 }), { p: [x, A, s * (r + 5)] }));
    for (const s of [-1, 1]) k.add("lensBlack", T(box(17.4, 0.45, 8.4, { bevel: 0.1 }), { p: [x, A, s * (r + 4.6)] }));
    for (const s of [-1, 1]) for (const d of [-4.5, 4.5]) k.add("steel", capScrew(2, 1.2), { p: [x + d, A + 2.5, s * (r + 5)] });
  }
}
function sniperScope(ctx, o) {
  const k = ctx.kit();
  const A = o.A, at = (g, t = {}) => T(g, { ...t, p: [t.p?.[0] || 0, A + (t.p?.[1] || 0), t.p?.[2] || 0] });
  scopeBody(ctx, k, at, o);
  // подсветка сетки: ручка поверх барабана параллакса
  const sx = o.saddle ?? -10;
  k.add("alu", at(T(ctx.C.knob(o.turret - 5, 5, 20), { r: [0, 90, 0] }), { p: [sx, 0, -o.tube - 4 - 2 - (o.turret - 2.5) * 0.75 - 0.6] }));
  k.add("steel", at(cylZ(o.turret - 8, -o.tube - 7 - (o.turret - 2.5) * 0.75, -o.tube - 5.5 - (o.turret - 2.5) * 0.75, { seg: 20 }), { p: [sx, 0, 0] }));
  scopeRings(ctx, k, o.rings, A, o.tube);
  const root = node(o.name, [k.build()]);
  const oc = lens(ctx, at(ctx.C.lensDisc(18.5, o.x0 + 2)), "glassBlue");
  const ob = lens(ctx, at(ctx.C.lensDisc(o.obj, o.x1 - 2)), "glassAmber");
  root.add(oc, ob);
  return { root, sight: { y: A, z: 0, x0: o.x0, x1: o.x1, r: o.tube, mag: o.zoom[0], zoom: o.zoom, reticle: o.reticle || "mil", eyeRelief: o.eyeRelief ?? 90, lens: oc } };
}
var mag1x39 = (cfg, asm) => {
  const it = asm.installed.get("optic");
  const s = it?.info?.sight;
  return !!s && s.mag === 1 && !s.zoom && Math.abs(s.y - 39) < 1.5;
};
// ---- прицелы и крепления из набора M416/АК/SCAR
function cantOptic(ctx, name, body) {
  const k = ctx.kit(), m = ctx.kit();
  k.add("alu", clampBody(-13, 13, 5, { w: 24 }));
  k.add("steel", crossBolt(0));
  k.add("alu", extrudeX([[-12, 3, 1], [12, 3, 1], [31, 14, 3], [27, 22, 3], [6, 12, 3], [-12, 8, 2]], -13, 13, { bevel: 1.2 }));
  for (const x of [-7, 7]) k.add("steel", T(cylX(1.9, 0, 1.4, { seg: 6 }).rotateY(Math.PI / 2), { p: [x, 17, 24] }));
  m.add("alu", extrudeX(rrect(0, -1.5, 28, 5, 1.5), -24, 25, { bevel: 0.8 }));
  const b = body(ctx, m);
  const cant = node(name + "Cant", [m.build(), b.glass]);
  cant.position.set(0, 16.5, 22);
  cant.rotation.x = Math.PI / 4;
  return {
    root: node(name, [k.build(), cant]),
    sight: { node: cant, y: b.A, z: 0, x0: b.x0, x1: b.x1, r: 9, mag: 1, reticle: b.reticle || "dot", lens: b.glass }
  };
}
function dppBody(ctx, k) {
  const A = 17;
  k.add("alu", extrudeX(rrect(0, 4, 26, 8, 2), -24, 22, { bevel: 1.2 }));
  k.add("alu", extrudeZ([[-24, 7], [-8, 7], [-8, 11], [-14, 13.5, 2], [-24, 12.5, 2]], 24, { bevel: 1.2 }));
  const hood = shape([[-13, 7], [13, 7], [13, 22, 3], [8, 29, 5], [-8, 29, 5], [-13, 22, 3]], [[[-10, 8.6], [10, 8.6], [10, 21.5, 2], [6.5, 26.5, 4], [-6.5, 26.5, 4], [-10, 21.5, 2]]]);
  k.add("alu", extrudeX(hood, 0, 17, { bevel: 1 }));
  k.add("steel", T(box(10, 2.4, 20, { bevel: 0.6 }), { p: [8, 28.6, 0] }));
  k.add("rubber", T(cylY(3, 11, 13.6, { seg: 16, c: 0.6 }), { p: [-18, 0, 0] }));
  for (const s of [-1, 1]) k.add("steel", T(cylZ(2.2, 12.6, 13.6, { seg: 12 }), { p: [-4, 11, s > 0 ? 0 : -26.2] }));
  const glass = lens(ctx, extrudeX(shape([[-9.6, 9], [9.6, 9], [9.6, 21, 2], [6, 26, 4], [-6, 26, 4], [-9.6, 21, 2]]), 11, 12, { bevel: 0.2 }), "glassAmber");
  return { A, glass, x0: -24, x1: 17, reticle: "dot" };
}
function acroBody(ctx, k) {
  const A = 16;
  const sec = shape(rrect(0, 14, 30, 28, 5), [rrect(0, 16, 20, 17, 3)]);
  k.add("alu", extrudeX(sec, -12, 16, { bevel: 1.4 }));
  k.add("alu", extrudeX(rrect(0, 4, 30, 8, 2), -24, 16, { bevel: 1.2 }));
  // задний торец закрытого корпуса — рамка с окном, прицельная линия через неё открыта
  k.add("alu", extrudeX(shape(rrect(0, 14.5, 30, 15, 3), [rrect(0, 15.5, 20, 11, 2)]), -24, -12, { bevel: 1.2 }));
  for (const s of [-1, 1]) k.add("rubber", T(box(6, 5, 1.6, { bevel: 0.6 }), { p: [-18, 12, s * 13.8] }));
  k.add("steel", T(cylY(3.4, 1, 2, { seg: 20 }), { p: [-2, -1, 0] }));
  const glass = lens(ctx, extrudeX(shape(rrect(0, 16, 20, 17, 3)), 12, 13, { bevel: 0.2 }), "glassBlue");
  return { A, glass, x0: -12, x1: 16, reticle: "dot" };
}
function hs507Body(ctx, k) {
  const A = rmrBody(ctx, k);
  k.add("alu", T(box(16, 9, 2.2, { bevel: 0.8 }), { p: [-10, 5, 13.3] }));
  k.add("steel", T(cylZ(1.5, 14.2, 15, { seg: 10 }), { p: [-15, 5, 0] }));
  const glass = lens(ctx, extrudeX(shape(rrect(0, A + 0.5, 18.6, 13.4, 5)), 6, 7, { bevel: 0.2 }), "glassBlue");
  return { A, glass, x0: -22, x1: 15, reticle: "cdot" };
}
function compm4(ctx) {
  const k = ctx.kit();
  const A = 39;
  const at = (g, t = {}) => T(g, { ...t, p: [t.p?.[0] || 0, A + (t.p?.[1] || 0), t.p?.[2] || 0] });
  k.add("alu", clampBody(-16, 16, 6));
  k.add("alu", extrudeZ(shape([[-15, 5, 1], [15, 5, 1], [13, A - 17, 3], [-13, A - 17, 3]], [slot(-7, 7, (A - 12) / 2 + 3, 8)]), 20, { bevel: 1.2 }));
  k.add("alu", at(tubeX(22.4, 19.6, -11, 11, { seg: 44, c: 1.2 })));
  k.add("alu", extrudeX([[-6, A - 26], [6, A - 26], [6, A - 18], [-6, A - 18]], -11, 11, { bevel: 0.8 }));
  k.add("alu", T(ctx.C.knob(11, 9, 20), { r: [0, -90, 0], p: [0, -1, 13] }));
  k.add("steel", cylZ(3.4, -15, 13, { seg: 12 }), { p: [0, -1, 0] });
  k.add("alu", at(hollowLathe([[-60, 18.8], [-59, 21], [-50, 21], [-48, 19.6], [36, 19.6], [40, 21.6], [58, 21.6], [60, 20.2]], [[-60, 15.2], [60, 17.4]], { seg: 48 })));
  k.add("rubber", at(tubeX(21.4, 20.2, -58, -50, { seg: 44 })));
  k.add("lensBlack", at(tubeX(17.5, 16.8, -58, 58, { seg: 32 })));
  k.add("alu", at(ringGrooves(21.6, 44, 56, 4, 0.5, { seg: 44, rIn: 17.5 })));
  // блок барабанов охватывает трубку: канал на оси открыт
  k.add("alu", at(extrudeX(shape(rrect(0, 0, 34, 34, 9), [circle(0, 0, 16.4, 44)]), 8, 30, { bevel: 1.6 })));
  k.add("alu", at(cylY(9.5, 16, 26, { c: 1.2, seg: 28 }), { p: [19, 0, 0] }));
  k.add("alu", at(cylZ(9.5, 16, 26, { c: 1.2, seg: 28 }), { p: [19, 0, 0] }));
  k.add("alu", at(cylX(9.4, 14, 58, { c: 1, seg: 28 }), { p: [0, -21, 0] }));
  k.add("alu", at(extrudeX([[-7, -19], [7, -19], [7, -12], [-7, -12]], 14, 58, { bevel: 0.8 })));
  k.add("alu", at(ctx.C.knob(10, 8, 24), { r: [0, 0, -90], p: [58, -21, 0] }));
  k.add("alu", at(ctx.C.knob(9, 7, 20), { r: [0, 90, 0], p: [-30, 0, -19.5] }));
  const root = node("compm4", [k.build()]);
  root.add(lens(ctx, at(ctx.C.lensDisc(15.4, -57)), "glassBlue"));
  const front = lens(ctx, at(ctx.C.lensDisc(17.4, 57)), "glassRed");
  root.add(front);
  return { root, sight: { y: A, z: 0, x0: -60, x1: 60, r: 15, mag: 1, reticle: "dot", lens: front } };
}
function rmrRiser(ctx) {
  const k = ctx.kit(), m = ctx.kit();
  const H = 24;
  k.add("alu", clampBody(-17, 17, 5, { w: 25 }));
  k.add("steel", crossBolt(-8));
  k.add("steel", crossBolt(8));
  k.add("alu", extrudeZ(shape([[-18, 4, 1], [18, 4, 1], [17, H, 1.5], [-17, H, 1.5]], [slot(-10, 10, H / 2 + 2, 8)]), 24, { bevel: 1 }));
  k.add("alu", extrudeX(rrect(0, H - 1.5, 26, 3, 1), -22, 22, { bevel: 0.6 }));
  const A = rmrBody(ctx, m);
  const glass = lens(ctx, extrudeX(shape(rrect(0, A + 0.5, 18.6, 13.4, 5)), 6, 7, { bevel: 0.2 }), "glassAmber");
  const body = node("rmr", [m.build(), glass]);
  body.position.set(-3, H, 0);
  return { root: node("rmr_riser", [k.build(), body]), sight: { node: body, y: A, z: 0, x0: -22, x1: 15, r: 9, mag: 1, reticle: "dot", lens: glass } };
}
function pk120(ctx) {
  const k = ctx.kit();
  const A = 40;
  k.add("alu", clampBody(-24, 24, 6));
  k.add("steel", crossBolt(-10));
  k.add("steel", T(ctx.C.knob(8, 7, 18), { r: [0, -90, 0], p: [12, -1, 13] }));
  k.add("alu", extrudeX([[-15, 5, 1], [15, 5, 1], [15, A - 16, 2], [-15, A - 16, 2]], -30, 30, { bevel: 1.2 }));
  const oct = (w, h, c, cy) => [[-w + c, cy - h], [w - c, cy - h], [w, cy - h + c], [w, cy + h - c], [w - c, cy + h], [-w + c, cy + h], [-w, cy + h - c], [-w, cy - h + c]];
  k.add("alu", extrudeX(shape(oct(20, 17, 6, A), [oct(16, 13, 5, A)]), -34, 34, { bevel: 1.2 }));
  k.add("alu", extrudeX(shape(oct(21, 18, 6.5, A), [oct(16.5, 13.5, 5, A)]), 26, 36, { bevel: 1 }));
  k.add("alu", T(cylX(7.5, -30, 6, { c: 1, seg: 24 }), { p: [0, A - 4, 24] }));
  k.add("alu", T(ctx.C.knob(7.8, 5, 18), { r: [0, 180, 0], p: [-30, A - 4, 24] }));
  k.add("alu", T(ctx.C.knob(9, 7, 22), { r: [0, 90, 0], p: [-18, A - 6, -20] }));
  const root = node("pk120", [k.build()]);
  const win = lens(ctx, extrudeX(shape(oct(16, 13, 5, A)), 24, 25, { bevel: 0.2 }), "glassRed");
  root.add(win);
  return { root, sight: { y: A, z: 0, x0: -34, x1: 36, r: 12, mag: 1, reticle: "dot", lens: win } };
}
function okp7(ctx) {
  const k = ctx.kit();
  const Y = 50, Z = 19;
  k.add("steel", extrudeX(shape([[-3, -9, 1], [4, -9], [4, 9], [-3, 9, 1], [-11, 7, 2], [-11, -7, 2]]), -46, 46, { bevel: 0.8 }));
  k.add("steel", T(ctx.C.knob(7, 6, 18), { r: [0, 90, 0], p: [-26, 0, -11] }));
  k.add("alu", extrudeX(shape([[-11, 6, 2], [4, 6, 2], [Z - 6, Y - 18, 3], [Z - 10, Y - 12, 3], [-11, 20, 2]]), -44, 44, { bevel: 1.4 }));
  const trap = (w0, w1, y0, y1) => [[Z - w0, y0, 2], [Z + w0, y0, 2], [Z + w1, y1, 5], [Z - w1, y1, 5]];
  k.add("alu", extrudeX(shape(trap(22, 17, Y - 17, Y + 15), [trap(17.5, 13.5, Y - 13, Y + 11.5)]), -48, 40, { bevel: 1.4 }));
  k.add("alu", extrudeX([[Z - 18, Y - 22, 2], [Z + 18, Y - 22, 2], [Z + 18, Y - 16], [Z - 18, Y - 16]], -48, -8, { bevel: 1 }));
  k.add("alu", T(ctx.C.knob(8, 6, 20), { r: [0, -90, 0], p: [-30, Y - 6, Z + 21] }));
  const root = node("okp7", [k.build()]);
  const win = lens(ctx, extrudeX(shape(trap(17.5, 13.5, Y - 13, Y + 11.5)), 30, 31, { bevel: 0.2 }), "glassAmber");
  root.add(win);
  return { root, sight: { y: Y - 1, z: Z, x0: -48, x1: 31, r: 12, mag: 1, reticle: "dot", lens: win } };
}
var OPTICS = [
  { id: "t2_low", cat: "optic", name: "Aimpoint Micro T-2", desc: "Коллиматор, низкое крепление (ось 20 мм). Для высоких планок АК", needs: (cfg) => !cfg.rearsight, needsWhy: "ось 20 мм ниже сложенного целика — снимите целик", foot: [-18, 18], body: [-38, 38], stats: { weight: 135, ergo: -1, adsTime: 8 }, build: (c) => t2(c, 20) },
  { id: "t2_lrp", cat: "optic", name: "Aimpoint T-2 + LRP 39 мм", desc: "Коллиматор на кронштейне, нижняя треть с механикой AR", foot: [-18, 18], body: [-38, 38], stats: { weight: 190, ergo: -1, adsTime: 10 }, build: (c) => t2(c, 39) },
  { id: "compm4", cat: "optic", name: "Aimpoint CompM4s", desc: "Армейский коллиматор, точка 2 MOA, батарея АА на 8 лет", foot: [-16, 16], body: [-62, 62], stats: { weight: 380, ergo: -3, adsTime: 14 }, build: compm4 },
  { id: "rmr_riser", cat: "optic", name: "Trijicon RMR на райзере Unity", desc: "Мини-коллиматор открытого типа, самый лёгкий", foot: [-17, 17], body: [-25, 22], stats: { weight: 90, ergo: 0, adsTime: 6 }, build: rmrRiser },
  { id: "exps3", cat: "optic", name: "EOTech EXPS3", desc: "Голографический, кольцо 68 MOA с точкой", foot: [-22, 22], body: [-48, 46], stats: { weight: 320, ergo: -3, adsTime: 14 }, build: (c) => exps3(c) },
  { id: "xps2", cat: "optic", name: "EOTech XPS2", desc: "Короткий голографический, одна батарея CR123", foot: [-18, 18], body: [-40, 46], stats: { weight: 255, ergo: -2, adsTime: 12 }, build: (c) => exps3(c, { xps2: true }) },
  { id: "mro", cat: "optic", name: "Trijicon MRO", desc: "Коллиматор-трубка, объектив 25 мм, точка 2 MOA, нижняя треть", foot: [-20, 20], body: [-31, 32], stats: { weight: 150, ergo: -1, adsTime: 9 }, build: (c) => mro(c, 39) },
  { id: "hs510c", cat: "optic", name: "Holosun HS510C", desc: "Открытый коллиматор с рамкой, кольцо 65 MOA + точка, широкое поле", foot: [-22, 22], body: [-34, 30], stats: { weight: 250, ergo: -2, adsTime: 10 }, build: hs510c },
  { id: "pk120", cat: "optic", name: "ПК-120 (БелОМО)", desc: "Коллиматор в защищённом кожухе-тоннеле", foot: [-24, 24], body: [-40, 37], stats: { weight: 310, ergo: -2, adsTime: 12 }, build: pk120 },
  { id: "okp7d", cat: "optic", name: "ОКП-7Д «Валдай»", desc: "Низкий коллиматор на боковую планку АК, окно над крышкой", mountTypes: ["dovetail"], only: ["akm", "ak74"], foot: [-46, 46], body: [-48, 46], needs: (cfg) => !cfg.sidemount, stats: { weight: 290, ergo: -2, adsTime: 11 }, build: okp7 },
  { id: "acog", cat: "optic", name: "Trijicon ACOG TA31 4×32", desc: "Призменный 4×, шеврон с дальномерной шкалой", foot: [-32, 32], body: [-75, 76], stats: { weight: 480, ergo: -6, adsTime: 40 }, build: acog },
  { id: "lpvo", cat: "optic", name: "Прицел 1–6×24", desc: "Переменная кратность, колёсико — зум в прицеле", foot: [-38, 34], body: [-132, 106], stats: { weight: 720, ergo: -9, adsTime: 55 }, build: lpvo },
  { id: "mk5hd", cat: "optic", name: "Leupold Mark 5HD 3,6–18×44", desc: "Снайперский, трубка 35 мм, сетка mil-dot, колесо — кратность", foot: [-58, 34], body: [-178, 112], stats: { weight: 880, ergo: -12, adsTime: 70 }, build: (c) => sniperScope(c, { name: "mk5hd", A: 36, tube: 17.5, obj: 23, turret: 15, x0: -178, x1: 112, saddle: -12, saddleL: 20, rings: [-48, 24], zoom: [3.6, 18], eyeRelief: 92 }) },
  { id: "sb_pm2", cat: "optic", name: "Schmidt & Bender PM II 5–25×56", desc: "Тяжёлый дальнобойный прицел, объектив 56 мм — высокие кольца", foot: [-56, 36], body: [-190, 142], stats: { weight: 1100, ergo: -15, adsTime: 85 }, build: (c) => sniperScope(c, { name: "pm2", A: 44, tube: 17.5, obj: 29, turret: 16, x0: -190, x1: 142, saddle: -8, saddleL: 20, rings: [-46, 26], zoom: [5, 25], eyeRelief: 90 }) },
  { id: "mag3x", cat: "magnifier", name: "Aimpoint 3XMag-1 + FTS", desc: "Увеличитель 3×, откидывается вбок", foot: [-16, 16], body: [-57, 55], needs: mag1x39, stats: { weight: 330, ergo: -4, adsTime: 20 }, build: magnifier },
  { id: "pvs14", cat: "magnifier", name: "Монокуляр AN/PVS-14", desc: "ПНВ за коллиматором на откидном кронштейне (N — откинуть)", foot: [-16, 16], body: [-86, 60], needs: mag1x39, stats: { weight: 420, ergo: -6, adsTime: 25 }, build: pvs14 },
  { id: "rmr_off", cat: "offset", side: true, name: "Trijicon RMR на 45° кронштейне", desc: "Мини-коллиматор сбоку для ближнего боя: V — переключиться, оружие заваливается", foot: [-12, 12], body: [-23, 24], stats: { weight: 95, ergo: -1 }, build: rmrOffset },
  { id: "dpp_off", cat: "offset", side: true, name: "Leupold DeltaPoint Pro на 45°", desc: "Наклонный коллиматор с большим окном, точка 2,5 MOA (V — переключиться)", foot: [-13, 13], body: [-24, 25], stats: { weight: 110, ergo: -1 }, build: (c) => cantOptic(c, "dpp_off", dppBody) },
  { id: "acro_off", cat: "offset", side: true, name: "Aimpoint ACRO P-2 на 45°", desc: "Наклонный закрытый коллиматор: излучатель защищён от грязи и воды", foot: [-13, 13], body: [-24, 25], stats: { weight: 120, ergo: -1 }, build: (c) => cantOptic(c, "acro_off", acroBody) },
  { id: "hs507_off", cat: "offset", side: true, name: "Holosun HS507C на 45°", desc: "Наклонный коллиматор: кольцо 32 MOA + точка, боковой лоток батареи", foot: [-13, 13], body: [-24, 25], stats: { weight: 100, ergo: -1 }, build: (c) => cantOptic(c, "hs507_off", hs507Body) },
  { id: "mbus_rear", cat: "rearsight", name: "Magpul MBUS (целик)", desc: "Складной диоптр, полимер", foot: [-13, 13], body: [-13, 13], stats: { weight: 34 }, build: mbusRear },
  { id: "mbus_front", cat: "frontsight", name: "Magpul MBUS (мушка)", desc: "Складная мушка, полимер", foot: [-13, 13], body: [-13, 13], stats: { weight: 26 }, build: mbusFront }
];

