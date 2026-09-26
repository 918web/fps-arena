import * as THREE7 from "three";
// Прицельные сетки. Каждая сетка — набор примитивов в угловых минутах (MOA), ось y — вниз.
// Подсвечиваемые элементы (ill) рисуются цветом подсветки, остальные — «гравировка» (чёрные).
// Сетки BDC строятся по реальной баллистике текущего патрона: ctx.hold(R) → поправка в MOA.
// Один набор примитивов → два рендера: текстура в линзе (коллиматоры, 1×) и SVG поверх
// изображения оптики (увеличение > 1,5×), где масштаб честный — 1 MOA на экране = 1 MOA в мире.
var TH = 3.6;
var MIL = 3.4377;
var MAN_W = 0.48;
var RET_COLORS = [
  { id: "red", hex: "#ff2a1a", name: "красная" },
  { id: "green", hex: "#38ff5a", name: "зелёная" },
  { id: "amber", hex: "#ff8a1a", name: "янтарная" }
];
var BLACK = "#0b0b0b";
// примитивы: L — отрезок, C — окружность, A — дуга, D — точка, P — ломаная, T — надпись, G — группа
// с минимальным экранным размером (прицельная марка не должна превращаться в пиксель)
var L = (x1, y1, x2, y2, w, ill = false) => ["L", x1, y1, x2, y2, w, ill];
var C = (x, y, r, w, ill = false) => ["C", x, y, r, w, ill];
var ARC = (x, y, r, a0, a1, w, ill = false) => ["A", x, y, r, a0, a1, w, ill];
var D = (x, y, r, ill = true) => ["D", x, y, r, ill];
var P = (pts, w, ill = false) => ["P", pts, w, ill];
// top — привязка по верхнему краю: подпись не наезжает на линию при минимальном размере шрифта
var TX = (x, y, s, str, ill = false, anchor = "start", top = false) => ["T", x, y, s, str, ill, anchor, top];
var G = (x, y, minPx, sizeMoa, items) => ["G", x, y, minPx, sizeMoa, items];
var chev = (x, y, w, h, lw, ill = true) => P([[x - w / 2, y + h], [x, y], [x + w / 2, y + h]], lw, ill);
function bdc(ctx, ranges) {
  return ranges.map((R) => ({ R, h: ctx.hold?.(R) })).filter((b) => b.h != null && isFinite(b.h) && b.h > 0.3);
}
var RETICLES = {
  // ---------------- коллиматоры
  dot2: { name: "Точка 2 MOA", field: 16, boost: 3.4, build: () => [D(0, 0, 1)] },
  dot1: { name: "Точка 1 MOA", field: 16, boost: 2.4, build: () => [D(0, 0, 0.5)] },
  cdot: { name: "Кольцо 65 MOA + точка", field: 72, boost: 1.2, build: () => [C(0, 0, 32.5, 1, true), D(0, 0, 1)] },
  cross: { name: "Перекрестие с точкой", field: 24, boost: 2.2, build: () => [L(-10, 0, -2.2, 0, 0.6, true), L(2.2, 0, 10, 0, 0.6, true), L(0, -10, 0, -2.2, 0.6, true), L(0, 2.2, 0, 10, 0.6, true), D(0, 0, 0.5)] },
  eotech: {
    name: "Кольцо 68 MOA + точка",
    field: 96,
    boost: 1.25,
    build: () => [C(0, 0, 34, 1.4, true), ...[0, 90, 180, 270].map((a) => {
      const r = a * Math.PI / 180;
      return L(Math.cos(r) * 34, Math.sin(r) * 34, Math.cos(r) * 29, Math.sin(r) * 29, 1.4, true);
    }), D(0, 0, 0.6)]
  },
  eotech2: {
    name: "Кольцо + две точки (EXPS3-2)",
    field: 96,
    boost: 1.25,
    build: (ctx) => {
      const h = ctx.hold?.(ctx.far || 200) ?? 7;
      return [C(0, 0, 34, 1.4, true), L(0, -34, 0, -29, 1.4, true), L(-34, 0, -29, 0, 1.4, true), L(34, 0, 29, 0, 1.4, true), D(0, 0, 0.6), D(0, Math.min(28, Math.max(3, h)), 0.6)];
    }
  },
  kobra: { name: "Угольник с точкой", field: 60, boost: 1.25, build: () => [chev(0, 1, 24, 7, 1.2), D(0, -3, 1.3), L(0, -22, 0, -12, 1.2, true)] },
  kobraChev: { name: "Угольник", field: 60, boost: 1.25, build: () => [chev(0, 0, 24, 8, 1.3)] },
  kobraDot: { name: "Точка 3 MOA", field: 60, boost: 1.4, build: () => [D(0, 0, 1.5)] },
  kobraCross: { name: "Разорванное перекрестие", field: 60, boost: 1.25, build: () => [L(-20, 0, -5, 0, 1.2, true), L(5, 0, 20, 0, 1.2, true), L(0, 5, 0, 20, 1.2, true), D(0, 0, 1)] },
  // ---------------- призма ACOG TA31: марка + шкала BDC, ширина рисок = 19" (ширина плеч) на дальности
  acogChev: { name: "Шеврон + BDC", field: 60, mag: true, build: (ctx) => [...acogLadder(ctx), G(0, 0, 18, 4, [chev(0, 0, 4, 2.6, 0.5)])] },
  acogCross: { name: "Перекрестие + BDC", field: 60, mag: true, build: (ctx) => [L(-30, 0, -2, 0, 0.35), L(2, 0, 30, 0, 0.35), L(0, -30, 0, -2, 0.35), ...acogLadder(ctx), G(0, 0, 8, 1, [D(0, 0, 0.5)])] },
  acogHorse: { name: "Подкова + точка", field: 60, mag: true, build: (ctx) => [...acogLadder(ctx), G(0, 0, 26, 8, [ARC(0, 0, 4, -0.15 * Math.PI, 1.15 * Math.PI, 0.45, true), D(0, 0, 0.45)])] },
  acogDot: { name: "Точка + BDC", field: 60, mag: true, build: (ctx) => [...acogLadder(ctx), G(0, 0, 7, 1, [D(0, 0, 0.5)])] },
  // ---------------- LPVO
  lpvo: { name: "Кольцо-точка + дуплекс", field: 140, mag: true, build: () => [...duplex(34, 70, 0.9, 0.4, 10), ...[1, 2, 3, 4].map((i) => L(-2.5, i * 6, 2.5, i * 6, 0.35)), G(0, 0, 40, 36, [C(0, 0, 18, 1.1, true), D(0, 0, 1)])] },
  lpvoDot: { name: "Дуплекс + точка", field: 140, mag: true, build: () => [...duplex(34, 70, 0.9, 0.4, 4), G(0, 0, 6, 1.2, [D(0, 0, 0.6)])] },
  lpvoBdc: {
    name: "Дуплекс + BDC",
    field: 140,
    mag: true,
    build: (ctx) => {
      const out = [...duplex(34, 70, 0.9, 0.4, 4).filter((p) => !(p[0] === "L" && p[2] === 4 && p[4] > 4)), L(0, 2, 0, 34, 0.35), G(0, 0, 6, 1.2, [D(0, 0, 0.6)])];
      for (const b of bdc(ctx, [200, 300, 400, 500, 600])) {
        if (b.h > 33) continue;
        const w = MAN_W / b.R * 3437.7 / 2;
        out.push(L(-w, b.h, w, b.h, 0.35), TX(w + 1, b.h + 1.2, 3, String(b.R / 100)));
      }
      return out;
    }
  },
  // ---------------- ПСО-1: шкала боковых поправок в тысячных, угольник, три нижних угольника
  // (1100/1200/1300 м при барабане на «10»), дальномерная шкала под рост 1,7 м.
  pso1: { name: "Угольник ПСО-1", field: 90, mag: true, build: (ctx) => [...psoBase(ctx), G(0, 0, 22, 5, [chev(0, 0, 3 * 1.6, 3 * 1.1, 0.55)]), ...psoLower(ctx)] },
  psoDot: { name: "ПСО-1 с точкой", field: 90, mag: true, build: (ctx) => [...psoBase(ctx), G(0, 0, 8, 1.2, [D(0, 0, 0.6)]), ...psoLower(ctx)] },
  psoCross: {
    name: "Перекрестие в тысячных",
    field: 90,
    mag: true,
    build: () => {
      const out = [L(-40, 0, -1.5, 0, 0.3), L(1.5, 0, 40, 0, 0.3), L(0, -40, 0, -1.5, 0.3), L(0, 1.5, 0, 40, 0.3)];
      for (let i = -10; i <= 10; i++) if (i) out.push(L(i * TH, -(i % 5 ? 0.8 : 1.6), i * TH, i % 5 ? 0.8 : 1.6, 0.3), L(-(i % 5 ? 0.8 : 1.6), i * TH, i % 5 ? 0.8 : 1.6, i * TH, 0.3));
      out.push(G(0, 0, 6, 1, [D(0, 0, 0.45)]));
      return out;
    }
  },
  // ---------------- оптика
  mil: {
    name: "Mil-Dot",
    field: 360,
    mag: true,
    build: () => {
      const out = duplex(5 * MIL, 180, 2.4, 0.3, 0);
      for (let i = -4; i <= 4; i++) if (i) out.push(D(i * MIL, 0, 0.35, false), D(0, i * MIL, 0.35, false));
      out.push(G(0, 0, 5, 0.6, [D(0, 0, 0.3)]));
      return out;
    }
  },
  duplex: { name: "Дуплекс", field: 360, mag: true, build: () => [...duplex(5 * MIL, 180, 2.4, 0.3, 0), G(0, 0, 5, 0.6, [D(0, 0, 0.3)])] },
  milTree: {
    name: "Ёлочка (поправки на дальность)",
    field: 360,
    mag: true,
    build: (ctx) => {
      const out = duplex(8 * MIL, 180, 2.4, 0.25, 0);
      for (let i = -8; i <= 8; i++) if (i) out.push(L(i * MIL, -(i % 2 ? 0.6 : 1.2), i * MIL, i % 2 ? 0.6 : 1.2, 0.25));
      for (const b of bdc(ctx, [200, 300, 400, 500, 600, 700, 800])) {
        if (b.h > 8 * MIL) continue;
        const w = MAN_W / b.R * 3437.7 / 2;
        out.push(L(-w, b.h, w, b.h, 0.25), TX(w + 0.8, b.h + 0.8, 2, String(b.R / 100)));
      }
      out.push(G(0, 0, 5, 0.6, [D(0, 0, 0.3)]));
      return out;
    }
  },
  milDot: { name: "Тонкое перекрестие + точка", field: 360, mag: true, build: () => [L(-180, 0, -1.2, 0, 0.2), L(1.2, 0, 180, 0, 0.2), L(0, -180, 0, -1.2, 0.2), L(0, 1.2, 0, 180, 0.2), G(0, 0, 6, 0.8, [D(0, 0, 0.4)])] }
};
function duplex(inner, outer, thick, thin, gap) {
  const out = [];
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, 1], [0, -1]]) {
    out.push(L(dx * inner, dy * inner, dx * outer, dy * outer, thick));
    out.push(L(dx * gap, dy * gap, dx * inner, dy * inner, thin));
  }
  return out;
}
function acogLadder(ctx) {
  const out = [];
  let bs = bdc(ctx, [300, 400, 500, 600, 700, 800]).filter((b) => b.h < 28);
  // пистолетный патрон падает круче — шкала уходит за поле, строим её на ближние дистанции
  if (bs.length < 3) bs = bdc(ctx, [150, 200, 250, 300, 350]).filter((b) => b.h < 28);
  const bottom = bs.length ? bs[bs.length - 1].h + 2 : 20;
  out.push(L(0, 2.4, 0, bottom, 0.3));
  for (const b of bs) {
    const w = MAN_W / b.R * 3437.7 / 2;
    out.push(L(-w, b.h, w, b.h, 0.3), TX(w + 0.9, b.h + 0.9, 2.2, String(b.R / 100).replace(".", ",")));
  }
  return out;
}
function psoBase(ctx) {
  const out = [L(-10 * TH, 0, -1.4 * TH, 0, 0.6, true), L(1.4 * TH, 0, 10 * TH, 0, 0.6, true)];
  for (let i = -10; i <= 10; i++) if (i) out.push(L(i * TH, 0, i * TH, -(i % 5 ? 0.9 : 1.8), 0.3));
  // дальномер: цель ростом 1,7 м между горизонталью и кривой; риски 2…10 (сотни метров)
  const x0 = -12.5 * TH, y0 = 6 * TH, W = 9 * TH;
  const curve = [];
  for (let i = 0; i <= 20; i++) {
    const R = 200 + i * 40;
    curve.push([x0 + i / 20 * W, y0 - 1.7 / R * 3437.7]);
  }
  out.push(L(x0, y0, x0 + W, y0, 0.3), P(curve, 0.3));
  for (const n of [2, 4, 6, 8, 10]) out.push(TX(x0 + (n * 100 - 200) / 800 * W, y0 + 0.9, 1.9, String(n), false, "middle", true));
  return out;
}
function psoLower(ctx) {
  const base = ctx.hold?.(1e3);
  const out = [];
  [1100, 1200, 1300].forEach((R, i) => {
    const h = ctx.hold?.(R);
    const y = base != null && h != null ? h - base : (i + 1) * 2.2 * TH;
    out.push(G(0, y, 12, 3.5, [chev(0, y, 3.4, 2.4, 0.45)]));
  });
  return out;
}
// Наборы сеток по типу прицела (ключ — reticle у прицела); G переключает внутри набора
var RET_SETS = {
  dot: ["dot2", "dot1", "cdot", "cross"],
  holo: ["eotech", "eotech2", "dot2", "cross"],
  kobra: ["kobra", "kobraChev", "kobraDot", "kobraCross"],
  chevron: ["acogChev", "acogCross", "acogHorse", "acogDot"],
  lpvo: ["lpvo", "lpvoDot", "lpvoBdc"],
  pso1: ["pso1", "psoDot", "psoCross"],
  mil: ["mil", "duplex", "milTree", "milDot"]
};
var RET_DEFAULT_COLOR = { pso1: "amber" };
function reticleSet(kind) {
  return RET_SETS[kind] || [kind in RETICLES ? kind : "dot2"];
}
function colorHex(id) {
  return (RET_COLORS.find((c) => c.id === id) || RET_COLORS[0]).hex;
}
// ------------------------------------------------------------------ canvas (текстура в линзе)
function drawPrims(g, prims, u, c, col, glowK) {
  const X = (x) => c + x * u, Y = (y) => c + y * u;
  for (const p of prims) {
    const t = p[0];
    if (t === "G") {
      drawPrims(g, p[5], u, c, col, glowK);
      continue;
    }
    const ill = t === "D" ? p[4] : t === "T" ? p[5] : t === "P" ? p[3] : t === "A" ? p[7] : p[p.length - 1];
    const cc = ill ? col : BLACK;
    g.save();
    g.strokeStyle = g.fillStyle = cc;
    g.lineCap = "round";
    g.lineJoin = "round";
    if (ill) {
      g.shadowColor = col;
      g.shadowBlur = glowK * u;
    }
    if (t === "L") {
      g.lineWidth = Math.max(1, p[5] * u);
      g.beginPath();
      g.moveTo(X(p[1]), Y(p[2]));
      g.lineTo(X(p[3]), Y(p[4]));
      g.stroke();
    } else if (t === "C" || t === "A") {
      g.lineWidth = Math.max(1, (t === "C" ? p[4] : p[6]) * u);
      g.beginPath();
      if (t === "C") g.arc(X(p[1]), Y(p[2]), p[3] * u, 0, Math.PI * 2);
      else g.arc(X(p[1]), Y(p[2]), p[3] * u, p[4], p[5]);
      g.stroke();
    } else if (t === "D") {
      g.beginPath();
      g.arc(X(p[1]), Y(p[2]), Math.max(0.8, p[3] * u), 0, Math.PI * 2);
      g.fill();
    } else if (t === "P") {
      g.lineWidth = Math.max(1, p[2] * u);
      g.beginPath();
      p[1].forEach(([x, y], i) => i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y)));
      g.stroke();
    } else if (t === "T") {
      g.font = `600 ${Math.max(8, p[3] * u)}px sans-serif`;
      g.textAlign = p[6] === "middle" ? "center" : "left";
      g.textBaseline = p[7] ? "top" : "alphabetic";
      g.fillText(p[4], X(p[1]), Y(p[2]));
    }
    g.restore();
  }
}
var texCache = /* @__PURE__ */ new Map();
function reticleTexture(id, colorId, ctx = {}) {
  const def = RETICLES[id] || RETICLES.dot2;
  const prims = def.build(ctx);
  const key = id + "|" + colorId + "|" + JSON.stringify(prims).length + "|" + (ctx.key || "");
  if (texCache.has(key)) return texCache.get(key);
  const s = 512, cv = document.createElement("canvas");
  cv.width = cv.height = s;
  const g = cv.getContext("2d");
  drawPrims(g, prims, s / def.field, s / 2, colorHex(colorId), def.mag ? 0.4 : 1.4);
  const t = new THREE7.CanvasTexture(cv);
  t.colorSpace = THREE7.SRGBColorSpace;
  texCache.set(key, t);
  if (texCache.size > 48) {
    const k0 = texCache.keys().next().value;
    texCache.get(k0).dispose();
    texCache.delete(k0);
  }
  return t;
}
function reticleMesh(kind, sight, ref, dist = 6e4) {
  const m = new THREE7.Mesh(new THREE7.PlaneGeometry(1, 1), new THREE7.MeshBasicMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    stencilWrite: true,
    stencilRef: ref,
    stencilFunc: THREE7.EqualStencilFunc,
    stencilFail: THREE7.KeepStencilOp,
    stencilZFail: THREE7.KeepStencilOp,
    stencilZPass: THREE7.KeepStencilOp
  }));
  m.rotation.y = -Math.PI / 2;
  m.position.set(dist, sight.y, sight.z || 0);
  m.renderOrder = 12;
  m.frustumCulled = false;
  m.userData.reticle = true;
  m.userData.dist = dist;
  const id = reticleSet(kind)[0];
  reticleApply(m, id, RET_DEFAULT_COLOR[kind] || "red", {});
  return m;
}
// Сменить сетку/цвет у уже созданной марки в линзе
function reticleApply(m, id, colorId, ctx) {
  const def = RETICLES[id] || RETICLES.dot2;
  const size = def.field * 0.2909 * (m.userData.dist / 1e3) * (def.boost || 1);
  m.scale.set(size, size, 1);
  const mat = m.material;
  mat.map = reticleTexture(id, colorId, ctx);
  // на гравированных сетках чёрное должно закрывать картинку, у коллиматоров — только свечение
  mat.blending = def.mag ? THREE7.NormalBlending : THREE7.AdditiveBlending;
  mat.needsUpdate = true;
}
// ------------------------------------------------------------------ SVG (поверх изображения оптики)
// ppu — пикселей на угловую минуту; W, H — размер экрана. Мелкие элементы не тоньше 1 px.
function reticleSVG(id, o = {}) {
  const def = RETICLES[id] || RETICLES.dot2;
  const ppu = o.ppu || 2, W = o.W || innerWidth, H = o.H || innerHeight;
  const col = colorHex(o.color || "red");
  const prims = def.build(o.ctx || {});
  const vb = [-W / 2 / ppu, -H / 2 / ppu, W / ppu, H / ppu].map((v) => v.toFixed(3)).join(" ");
  const px = (v) => (v / ppu).toFixed(4);
  const out = [];
  const emit = (ps, k, ax, ay) => {
    const tx = (x) => ((ax + (x - ax) * k) || 0).toFixed(3), ty = (y) => ((ay + (y - ay) * k) || 0).toFixed(3);
    for (const p of ps) {
      const t = p[0];
      if (t === "G") {
        const kk = Math.max(1, p[3] / (p[4] * ppu));
        emit(p[5], kk * k, ax + (p[1] - ax) * k, ay + (p[2] - ay) * k);
        continue;
      }
      const ill = t === "D" ? p[4] : t === "T" ? p[5] : t === "P" ? p[3] : t === "A" ? p[7] : p[p.length - 1];
      const c = ill ? col : BLACK;
      const f = ill ? ' filter="url(#gl)"' : "";
      const sw = (w) => Math.max(w * k, (ill ? 1.6 : 1.1) / ppu).toFixed(4);
      if (t === "L") out.push(`<line x1="${tx(p[1])}" y1="${ty(p[2])}" x2="${tx(p[3])}" y2="${ty(p[4])}" stroke="${c}" stroke-width="${sw(p[5])}" stroke-linecap="round"${f}/>`);
      else if (t === "C") out.push(`<circle cx="${tx(p[1])}" cy="${ty(p[2])}" r="${(p[3] * k).toFixed(3)}" fill="none" stroke="${c}" stroke-width="${sw(p[4])}"${f}/>`);
      else if (t === "A") {
        const r = p[3] * k, x0 = +tx(p[1]) + Math.cos(p[4]) * r, y0 = +ty(p[2]) + Math.sin(p[4]) * r, x1 = +tx(p[1]) + Math.cos(p[5]) * r, y1 = +ty(p[2]) + Math.sin(p[5]) * r;
        out.push(`<path d="M${x0.toFixed(3)} ${y0.toFixed(3)} A${r.toFixed(3)} ${r.toFixed(3)} 0 ${p[5] - p[4] > Math.PI ? 1 : 0} 1 ${x1.toFixed(3)} ${y1.toFixed(3)}" fill="none" stroke="${c}" stroke-width="${sw(p[6])}" stroke-linecap="round"${f}/>`);
      } else if (t === "D") out.push(`<circle cx="${tx(p[1])}" cy="${ty(p[2])}" r="${Math.max(p[3] * k, 1.3 / ppu).toFixed(4)}" fill="${c}"${f}/>`);
      else if (t === "P") out.push(`<path d="${p[1].map(([x, y], i) => (i ? "L" : "M") + tx(x) + " " + ty(y)).join(" ")}" fill="none" stroke="${c}" stroke-width="${sw(p[2])}" stroke-linecap="round" stroke-linejoin="round"${f}/>`);
      else if (t === "T") out.push(`<text x="${tx(p[1])}" y="${ty(p[2])}" font-size="${Math.max(p[3] * k, 7.5 / ppu).toFixed(3)}" font-family="sans-serif" font-weight="600" fill="${c}" text-anchor="${p[6] === "middle" ? "middle" : "start"}"${p[7] ? ' dominant-baseline="hanging"' : ""}>${p[4]}</text>`);
    }
  };
  emit(prims, 1, 0, 0);
  return `<svg viewBox="${vb}" width="${W}" height="${H}" style="position:absolute;left:0;top:0"><defs><filter id="gl" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${px(1.1)}"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>${out.join("")}</svg>`;
}

