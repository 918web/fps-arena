var R = Math.random;
// пик удара уровня 1 (≈ −10 дБ полной шкалы): самый громкий звук механики — удар рамы — остаётся
// заметно тише выстрела, мелочь (кнопки, трение) — соответственно тише
var FOLEY_REF = 0.4;
var jit = (v, k = 0.1) => v * (1 - k + R() * 2 * k);
function biquad(d, sr, type, f, q = 0.707) {
  const w = 2 * Math.PI * Math.min(f, sr * 0.45) / sr, cw = Math.cos(w), sw = Math.sin(w), a = sw / (2 * q);
  let b0, b1, b2;
  if (type === "lp") {
    b0 = (1 - cw) / 2;
    b1 = 1 - cw;
    b2 = b0;
  } else if (type === "hp") {
    b0 = (1 + cw) / 2;
    b1 = -(1 + cw);
    b2 = b0;
  } else {
    b0 = a;
    b1 = 0;
    b2 = -a;
  }
  const a0 = 1 + a, a1 = -2 * cw, a22 = 1 - a;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < d.length; i++) {
    const x = d[i], y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a22 * y2) / a0;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    d[i] = y;
  }
  return d;
}
var BODY = {
  // фрезерованный алюминий ствольной коробки AR/SCAR: плотный, сухой
  alu: { f0: 380, f1: 9e3, n: 48, tau: 7e-3, tilt: -0.25, decK: 0.75 },
  // штампованная сталь АК: тонкий лист — ярче и чуть дольше
  sheet: { f0: 450, f1: 9500, n: 56, tau: 0.011, tilt: -0.15, decK: 0.7 },
  // массивные стальные детали (затворная рама, защёлка)
  steel: { f0: 900, f1: 11e3, n: 40, tau: 4e-3, tilt: -0.1, decK: 0.8 },
  // мелкая пружинная сталь (кнопка, защёлка, фиксатор)
  small: { f0: 2200, f1: 13e3, n: 30, tau: 22e-4, tilt: 0, decK: 0.85 },
  // полимерный магазин / накладки — глухо и коротко
  poly: { f0: 250, f1: 5e3, n: 36, tau: 4e-3, tilt: -0.6, decK: 0.6 },
  // стальной магазин — корпус из тонкого листа
  magSteel: { f0: 500, f1: 8e3, n: 44, tau: 6e-3, tilt: -0.3, decK: 0.7 },
  // латунь патронов в магазине
  brass: { f0: 2500, f1: 12e3, n: 24, tau: 18e-4, tilt: -0.1, decK: 0.8 },
  // бетон/земля при падении
  ground: { f0: 150, f1: 3500, n: 30, tau: 4e-3, tilt: -0.8, decK: 0.5 }
};
var Track = class {
  constructor(sr, sec) {
    this.sr = sr;
    this.d = new Float32Array(Math.ceil(sr * sec));
  }
  // Банк резонаторов, возбуждаемых сигналом x (начиная с отсчёта i0).
  // level — пиковая амплитуда события (×REF): раньше выход рос с длительностью контакта и числом
  // микроударов (пластик — в 50 раз громче стали, трение — десятки единиц), а буфер затем
  // резался tanh в «прямоугольник» и нормировался в 0,9 — щелчок звучал как удар рамы, с хрипом.
  resonate(x, i0, body, level, damp = 1) {
    const sr = this.sr, d = this.d, B = BODY[body] || body;
    const tail = Math.ceil(sr * Math.min(0.12, B.tau * 8 * damp));
    const n = Math.min(d.length - i0, x.length + tail);
    if (n <= 0) return;
    const out = new Float32Array(n);
    const lf0 = Math.log(B.f0), lf1 = Math.log(B.f1);
    let norm = 0;
    for (let m = 0; m < B.n; m++) {
      const f = Math.exp(lf0 + (lf1 - lf0) * R());
      const tau = B.tau * damp * Math.pow(f / 1e3, -B.decK) * (0.6 + R() * 0.8);
      const r = Math.exp(-1 / (Math.max(4e-4, tau) * sr));
      const w = 2 * Math.PI * f / sr;
      const c1 = 2 * r * Math.cos(w), c2 = -r * r;
      const g = (0.25 + R() * 0.75) * Math.pow(f / 1e3, B.tilt) * (1 - r) * 2;
      norm += g;
      let y1 = 0, y2 = 0;
      for (let i = 0; i < n; i++) {
        const y = (i < x.length ? x[i] : 0) * g + c1 * y1 + c2 * y2;
        y2 = y1;
        y1 = y;
        out[i] += y;
      }
    }
    let pk = 0;
    for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(out[i]));
    const k = level * FOLEY_REF / Math.max(1e-9, pk);
    for (let i = 0; i < n; i++) d[i0 + i] += out[i] * k;
  }
  // Удар: контакт длительностью tc (с) + шумовой «треск» контакта + корпус.
  hit(t, level, body, o = {}) {
    const sr = this.sr, i0 = Math.floor(t * sr);
    if (i0 >= this.d.length) return this;
    const tc = jit(o.tc ?? 2e-4, 0.2);
    const nc = Math.max(2, Math.round(tc * sr));
    const nn = Math.round((o.noise ?? 12e-4) * sr);
    const x = new Float32Array(Math.max(nc, nn) + 2);
    for (let i = 0; i < nc; i++) x[i] += Math.sin(Math.PI * i / nc) ** 2 * (o.push ?? 1);
    const na = o.grit ?? 0.35;
    for (let i = 0; i < nn; i++) x[i] += (R() * 2 - 1) * na * Math.exp(-i / (nn * 0.3 + 1));
    this.resonate(x, i0, body, level, o.damp ?? 1);
    if (o.click) {
      const m = Math.round(15e-4 * sr), b = new Float32Array(m);
      for (let i = 0; i < m; i++) b[i] = (R() * 2 - 1) * Math.exp(-i / (sr * 25e-5));
      biquad(b, sr, "hp", o.clickHp ?? 3e3, 0.7);
      for (let i = 0; i < m && i0 + i < this.d.length; i++) this.d[i0 + i] += b[i] * level * o.click;
    }
    return this;
  }
  // Масса оружия: низкий глухой «тук» (руки гасят его за 20–40 мс).
  mass(t, level, f = 160, dec = 0.025) {
    const sr = this.sr, i0 = Math.floor(t * sr), n = Math.min(this.d.length - i0, Math.ceil(sr * dec * 6));
    if (n <= 0) return this;
    const b = new Float32Array(n);
    for (let i = 0; i < n; i++) b[i] = (R() * 2 - 1) * Math.exp(-i / (sr * dec * 0.35));
    biquad(b, sr, "lp", jit(f * 2.2), 0.7);
    biquad(b, sr, "lp", jit(f * 2.2), 0.7);
    biquad(b, sr, "hp", 45, 0.7);
    const np = Math.round(sr / f * 0.5);
    const k = level * FOLEY_REF * 1.6;
    for (let i = 0; i < n; i++) this.d[i0 + i] += k * (b[i] * 2.2 + (i < np ? Math.sin(Math.PI * i / np) * 0.5 : 0));
    return this;
  }
  // Трение: поток микрозацепов через корпус + широкополосное шуршание.
  scrape(t, dur, level, body, o = {}) {
    const sr = this.sr, i0 = Math.floor(t * sr), n = Math.min(this.d.length - i0, Math.floor(dur * sr));
    if (n <= 0) return this;
    const x = new Float32Array(n), hiss = new Float32Array(n);
    const rate0 = o.rate ?? 700, rate1 = o.rate1 ?? rate0;
    const shape2 = o.shape || ((k) => Math.sin(Math.PI * Math.min(1, k * 1.1)) ** 0.6);
    let next = 0;
    for (let i = 0; i < n; i++) {
      const k = i / n, env = shape2(k), rate = rate0 + (rate1 - rate0) * k;
      if (i >= next) {
        const a = env * (0.3 + R() * 0.7) * (R() < 0.08 ? 2.2 : 1);
        const m = Math.max(2, Math.round(sr * jit(o.tc ?? 15e-5, 0.4)));
        for (let j = 0; j < m && i + j < n; j++) x[i + j] += a * Math.sin(Math.PI * j / m) ** 2;
        next = i + Math.max(1, Math.round(sr / rate * (0.2 + R() * 1.6)));
      }
      hiss[i] = (R() * 2 - 1) * env;
    }
    this.resonate(x, i0, body, level * 0.7, o.damp ?? 0.8);
    biquad(hiss, sr, "bp", o.hissF ?? 3200, 0.6);
    biquad(hiss, sr, "hp", 900, 0.7);
    biquad(hiss, sr, "lp", 6500, 0.7);
    const h = (o.hiss ?? 0.25) * level * FOLEY_REF * 2;
    for (let i = 0; i < n; i++) this.d[i0 + i] += hiss[i] * h;
    return this;
  }
  // Патроны в магазине: n мелких латунных касаний за dur.
  rattle(t, dur, level, n = 6) {
    for (let i = 0; i < n; i++) this.hit(t + R() * dur, level * (0.3 + R() * 0.7), "brass", { tc: 8e-5, noise: 6e-4, grit: 0.5, damp: 0.8 });
    return this;
  }
  // Ладонь по дну магазина: мягкий контакт + шлепок кожи.
  palm(t, level, body = "poly") {
    this.hit(t, level * 0.6, body, { tc: 4e-3, noise: 4e-3, grit: 0.25, damp: 0.7 });
    const sr = this.sr, i0 = Math.floor(t * sr), n = Math.min(this.d.length - i0, Math.round(sr * 0.02));
    const b = new Float32Array(Math.max(0, n));
    for (let i = 0; i < n; i++) b[i] = (R() * 2 - 1) * Math.exp(-i / (sr * 3e-3));
    biquad(b, sr, "bp", jit(1400), 0.8);
    for (let i = 0; i < n; i++) this.d[i0 + i] += b[i] * level * FOLEY_REF * 1.4;
    return this.mass(t + 1e-3, level * 0.5, 120, 0.02);
  }
  // Ткань и снаряжение: шуршание нейлона (полосовой шум с рваной огибающей) и хруст складок.
  cloth(t, dur, level, o = {}) {
    const sr = this.sr, i0 = Math.floor(t * sr), n = Math.min(this.d.length - i0, Math.floor(dur * sr));
    if (n <= 0) return this;
    const b = new Float32Array(n);
    let env = 0, target = 0, next = 0;
    for (let i = 0; i < n; i++) {
      if (i >= next) {
        target = R() < 0.25 ? 0.15 : 0.4 + R() * 0.6;
        next = i + Math.round(sr * (6e-3 + R() * 0.02));
      }
      env += (target - env) * 4e-3;
      const k = i / n, shape2 = Math.sin(Math.PI * Math.min(1, k * 1.05)) ** 0.7;
      b[i] = (R() * 2 - 1) * env * shape2 * (R() < 3e-3 ? 4 : 1);
    }
    biquad(b, sr, "bp", o.f ?? 2400, 0.55);
    biquad(b, sr, "hp", 700, 0.7);
    for (let i = 0; i < n; i++) this.d[i0 + i] += b[i] * level * FOLEY_REF * 1.2;
    return this;
  }
  buffer(ctx) {
    const d = this.d, sr = this.sr;
    biquad(d, sr, "hp", 40, 0.7);
    // уровни событий сохраняются как есть; мягкое колено только выше 0,8 — без клиппинга
    const fade = Math.min(d.length, Math.floor(sr * 0.01));
    for (let i = 0; i < d.length; i++) {
      const v = d[i], a = Math.abs(v);
      const s = a < 0.8 ? v : Math.sign(v) * (0.8 + 0.18 * Math.tanh((a - 0.8) / 0.18));
      d[i] = s * (i > d.length - fade ? (d.length - i) / fade : 1);
    }
    const b = ctx.createBuffer(1, d.length, sr);
    b.getChannelData(0).set(d);
    return b;
  }
};
var recv = (o) => o.fam === "ak" ? "sheet" : "alu";
var magB = (o) => o.kind === "steel" ? "magSteel" : "poly";
var RECIPES = {
  // Сброс магазина. AR/SCAR: кнопка → защёлка отпускает → магазин выскальзывает
  // под собственным весом (трение о шахту, патроны шевелятся).
  // АК: нажим на рычаг защёлки, магазин проворачивают вперёд и выводят зацеп.
  magOut(T2, o) {
    const fr = o.fill === 0 ? 0 : o.fill === 1 ? 0.7 : 1;
    const r0 = T2.rattle.bind(T2);
    T2.rattle = (t, dur, lv, n) => fr ? r0(t, dur, lv * fr, n) : T2.hit(t + dur * 0.5, lv * 0.6, "small", { tc: 2e-4, damp: 1.4 });
    if (o.fam === "ak") {
      T2.hit(0, 0.35, "small", { tc: 15e-4, noise: 2e-3, grit: 0.2 });
      T2.hit(0.03, 0.7, "steel", { tc: 12e-5, click: 0.25 });
      T2.hit(0.032, 0.45, "sheet", { tc: 2e-4, damp: 0.8 });
      T2.scrape(0.05, 0.1, 0.35, magB(o), { rate: 500, rate1: 300, tc: 3e-4 });
      T2.hit(0.15, 0.55, magB(o), { tc: o.kind === "steel" ? 3e-4 : 8e-4 });
      T2.hit(0.152, 0.3, "sheet", { tc: 3e-4, damp: 0.7 });
      T2.rattle(0.15, 0.1, 0.12, 5);
    } else {
      T2.hit(0, 0.3, "small", { tc: 18e-4, noise: 2e-3, grit: 0.2 });
      T2.hit(0.012, 0.6, "small", { tc: 1e-4, click: 0.3 });
      T2.hit(0.013, 0.35, recv(o), { tc: 15e-5, damp: 0.6 });
      T2.scrape(0.02, 0.12, 0.4, magB(o), { rate: 900, rate1: 500, tc: 18e-5, hiss: 0.3, shape: (k) => (1 - k) ** 0.7 * Math.min(1, k * 8) });
      T2.rattle(0.03, 0.12, 0.1, 6);
      T2.hit(0.135, 0.3, magB(o), { tc: 4e-4 });
    }
  },
  // Магазин входит в шахту: касание раструба, скольжение.
  magInsert(T2, o) {
    if (o.fam === "ak") {
      T2.hit(0, 0.55, magB(o), { tc: o.kind === "steel" ? 25e-5 : 7e-4 });
      T2.hit(2e-3, 0.35, "sheet", { tc: 2e-4, damp: 0.7 });
      T2.scrape(0.012, 0.06, 0.28, magB(o), { rate: 600, tc: 2e-4 });
      T2.rattle(0, 0.05, 0.1, 4);
    } else {
      T2.hit(0, 0.4, magB(o), { tc: o.kind === "steel" ? 3e-4 : 8e-4 });
      T2.scrape(6e-3, 0.1, 0.42, magB(o), { rate: 600, rate1: 1300, tc: 16e-5, hiss: 0.35, hissF: 2600, shape: (k) => Math.min(1, k * 5) * (1 - 0.4 * k) });
      T2.rattle(0.01, 0.09, 0.08, 5);
    }
  },
  // Посадка: магазин в упор, защёлка заскакивает в окно (+ ладонь по дну у AR/SCAR).
  magIn(T2, o) {
    if (o.fam === "ak") {
      T2.scrape(0, 0.045, 0.22, "sheet", { rate: 450, tc: 25e-5, hiss: 0.15 });
      T2.hit(0.048, 1, "steel", { tc: 1e-4, click: 0.35 });
      T2.hit(0.048, 0.8, "sheet", { tc: 15e-5 });
      T2.hit(0.05, 0.45, magB(o), { tc: 3e-4 });
      T2.mass(0.048, 0.35, 170, 0.02);
      T2.rattle(0.052, 0.06, 0.1, 4);
    } else {
      T2.hit(0, 0.9, recv(o), { tc: 18e-5, click: 0.15 });
      T2.hit(1e-3, 0.5, magB(o), { tc: 4e-4 });
      T2.mass(0, 0.45, 150, 0.025);
      T2.hit(9e-3, 0.75, "small", { tc: 8e-5, click: 0.35 });
      T2.rattle(4e-3, 0.05, 0.1, 5);
      T2.palm(0.05, 0.55, magB(o));
      T2.hit(0.052, 0.3, recv(o), { tc: 3e-4, damp: 0.7 });
    }
  },
  // Рукоять назад: хват, отпирание, трение рамы, сжатие пружины, упор.
  chargeBack(T2, o) {
    const ak = o.fam === "ak";
    T2.hit(0, 0.2, "poly", { tc: 3e-3, noise: 3e-3, grit: 0.2 });
    if (!ak) T2.hit(0.012, 0.45, "small", { tc: 1e-4, click: 0.2 });
    T2.hit(0.02, 0.55, "steel", { tc: 15e-5 });
    T2.scrape(0.03, 0.15, 0.5, ak ? "sheet" : "steel", { rate: ak ? 500 : 900, rate1: ak ? 900 : 1500, tc: 16e-5, hiss: 0.3, hissF: 3800 });
    T2.hit(0.18, 0.6, ak ? "sheet" : recv(o), { tc: 2e-4 });
    T2.hit(0.181, 0.4, "steel", { tc: 12e-5, damp: 0.7 });
  },
  // Рама вперёд: пружина разгоняет, досылание патрона, мощное запирание.
  chargeRelease(T2, o) {
    const big = o.fam === "ak" || o.cal === "762x51" ? 1.15 : 1;
    T2.scrape(0, 0.035, 0.45, "steel", { rate: 1800, tc: 12e-5, hiss: 0.35, hissF: 4500 });
    T2.scrape(0.02, 0.02, 0.3, "brass", { rate: 1500, tc: 1e-4 });
    T2.hit(0.042, 1 * big, "steel", { tc: 1e-4, click: 0.3 });
    T2.hit(0.042, 0.9 * big, recv(o), { tc: 15e-5 });
    T2.mass(0.042, 0.5 * big, 140, 0.028);
    T2.hit(0.05, 0.4, "small", { tc: 1e-4, damp: 0.8 });
    if (o.fam !== "ak") T2.hit(0.075, 0.3, "small", { tc: 1e-4, click: 0.15 });
  },
  // Затворная задержка: ладонь по кнопке, рама вперёд.
  boltCatch(T2, o) {
    T2.hit(0, 0.35, "small", { tc: 15e-4, noise: 2e-3 });
    T2.hit(0.01, 0.45, "small", { tc: 1e-4, click: 0.2 });
    T2.scrape(0.012, 0.03, 0.4, "steel", { rate: 1800, tc: 12e-5, hiss: 0.3, hissF: 4500 });
    T2.hit(0.043, 1, "steel", { tc: 1e-4, click: 0.3 });
    T2.hit(0.043, 0.85, recv(o), { tc: 15e-5 });
    T2.mass(0.043, 0.45, 140, 0.028);
  },
  // Магазин падает на бетон и подпрыгивает.
  // Магазин о бетонный пол. Полный — тяжёлый глухой удар и почти без отскока;
  // пустой — лёгкий, звонкий, скачет и дребезжит пружиной с подавателем.
  magGround(T2, o) {
    const steel = o.kind === "steel";
    const full = o.fill === 2, empty = o.fill === 0;
    const ground = { ...BODY.ground, f0: 220, f1: 5200, tau: 5e-3 };
    T2.hit(0, full ? 1 : 0.75, ground, { tc: full ? 9e-4 : 5e-4 });
    T2.hit(1e-3, full ? 0.7 : 0.85, magB(o), { tc: steel ? 15e-5 : 5e-4, click: steel ? 0.25 : 0.06 });
    T2.mass(0, full ? 0.6 : 0.25, full ? 95 : 140, 0.02);
    if (!empty) T2.rattle(2e-3, 0.08, full ? 0.28 : 0.2, full ? 10 : 6);
    else {
      T2.hit(4e-3, 0.3, "small", { tc: 2e-4 });
      T2.hit(0.03, 0.2, "small", { tc: 2e-4 });
    }
    let t = 0.08 + R() * 0.04, a = full ? 0.25 : 0.55;
    for (let i = 0; i < (full ? 1 : 3); i++) {
      T2.hit(t, a, magB(o), { tc: steel ? 2e-4 : 6e-4 });
      T2.hit(t, a * 0.8, ground, { tc: 6e-4 });
      if (empty) T2.hit(t + 3e-3, a * 0.4, "small", { tc: 2e-4 });
      t += (0.07 + R() * 0.05) * (1 - i * 0.3);
      a *= 0.5;
    }
  },
  // Магазин из подсумка: рука, шуршание нейлона, магазин выходит из кармана, патроны.
  pouch(T2, o) {
    T2.cloth(0, 0.34, 0.5, { f: 2100 });
    T2.hit(0.05, 0.25, "poly", { tc: 3e-3, noise: 4e-3, grit: 0.3 });
    T2.scrape(0.12, 0.16, 0.3, magB(o), { rate: 400, rate1: 250, tc: 4e-4, hiss: 0.45, hissF: 1800 });
    T2.rattle(0.15, 0.16, 0.12, 6);
    T2.hit(0.29, 0.2, magB(o), { tc: 6e-4 });
    T2.cloth(0.3, 0.12, 0.25, { f: 2800 });
  },
  // Проверка посадки: рывок магазина вниз — стук в защёлку.
  tug(T2, o) {
    T2.hit(0, 0.35, magB(o), { tc: 4e-4 });
    T2.hit(2e-3, 0.25, "small", { tc: 15e-5 });
    T2.rattle(3e-3, 0.03, 0.06, 3);
  },
  // Вскидка: ткань, приклад в плечо (глухой удар в плечевую накладку).
  shoulder(T2) {
    T2.cloth(0, 0.16, 0.35, { f: 2e3 });
    T2.hit(0.11, 0.3, "poly", { tc: 4e-3, noise: 4e-3, grit: 0.2, damp: 0.6 });
    T2.mass(0.11, 0.2, 90, 0.03);
  },
  // Опускание оружия.
  unshoulder(T2) {
    T2.cloth(0, 0.14, 0.25, { f: 2300 });
  },
  // Спуск без выстрела: удар курка по ударнику.
  dryFire(T2, o) {
    T2.hit(0, 0.25, "small", { tc: 1e-4 });
    T2.hit(6e-3, 0.8, "steel", { tc: 1e-4, click: 0.25 });
    T2.hit(6e-3, 0.45, recv(o), { tc: 2e-4, damp: 0.7 });
  },
  // Переводчик: подпружиненный фиксатор перескакивает в лунку.
  selector(T2, o) {
    // у АК длинный штампованный рычаг бьёт по крышке — громкий «клац», у AR/SCAR — короткий щелчок
    const ak = o.fam === "ak";
    T2.scrape(0, 0.03, 0.18, "small", { rate: 1500, tc: 1e-4, hiss: 0.1 });
    T2.hit(0.03, ak ? 1 : 0.6, "small", { tc: 1e-4, click: 0.25 });
    T2.hit(0.031, ak ? 0.75 : 0.3, recv(o), { tc: 2e-4, damp: ak ? 0.9 : 0.6 });
  },
  click(T2) {
    T2.hit(0, 0.5, "small", { tc: 1e-4, click: 0.2 });
  },
  // Короткий удар металла общего назначения (детали на планке, сошки, приклад).
  tick(T2, o) {
    T2.hit(0, 0.6, o.kind === "poly" ? "poly" : "steel", { tc: o.kind === "poly" ? 6e-4 : 12e-5, click: 0.15 });
  },
  // Механика при выстреле: отпирание, удар рамы в буфер, накат и запирание.
  cycle(T2, o) {
    const cyc = 60 / (o.rpm || 700);
    T2.hit(1e-3, 0.45, "steel", { tc: 1e-4 });
    T2.scrape(4e-3, cyc * 0.35, 0.25, "steel", { rate: 2e3, tc: 1e-4, hiss: 0.2, hissF: 4500 });
    T2.hit(cyc * 0.45, 0.4, recv(o), { tc: 2e-4 });
    T2.hit(cyc * 0.85, 0.7, "steel", { tc: 1e-4, click: 0.15 });
    T2.hit(cyc * 0.85, 0.5, recv(o), { tc: 15e-5 });
  },
  // Литиевые элементы CR123A: стальной корпус, щёлкают друг о друга и о трубку фонаря.
  battCells(T2) {
    const cell = { ...BODY.small, f0: 1500, f1: 9e3, tau: 4e-3, n: 26 };
    T2.scrape(0, 0.08, 0.15, "alu", { rate: 700, tc: 2e-4, hiss: 0.15 });
    T2.hit(0.07, 0.5, cell, { tc: 15e-5, click: 0.1 });
    T2.hit(0.1 + R() * 0.02, 0.35, cell, { tc: 15e-5 });
    T2.hit(0.2, 0.25, "poly", { tc: 2e-3, noise: 3e-3 });
  },
  // Гильза о бетон: тонкостенная латунная (стальная) трубка звенит коротко.
  casing(T2, o) {
    const body = o.kind === "steel" ? { ...BODY.magSteel, f0: 1800, f1: 9e3, tau: 0.02, n: 30 } : { ...BODY.brass, f0: 2600, f1: 11e3, tau: 0.03, n: 26, decK: 0.5 };
    T2.hit(0, 1.2, body, { tc: 8e-5, noise: 8e-4 });
    T2.hit(0.06 + R() * 0.05, 0.6, body, { tc: 1e-4 });
    T2.hit(0.15 + R() * 0.08, 0.3, body, { tc: 1e-4 });
  }
};
var LEN = { pouch: 0.48, tug: 0.08, shoulder: 0.22, unshoulder: 0.16, battCells: 0.3, magOut: 0.3, magInsert: 0.16, magIn: 0.16, chargeBack: 0.26, chargeRelease: 0.16, boltCatch: 0.14, magGround: 0.5, dryFire: 0.08, selector: 0.08, click: 0.05, tick: 0.06, cycle: 0.14, casing: 0.36 };
var VARIANTS = 3;
var Foley = class {
  constructor(ctx) {
    this.ctx = ctx;
    this.cache = /* @__PURE__ */ new Map();
  }
  buffer(name, o = {}) {
    const key = name + "|" + (o.fam || "") + "|" + (o.kind || "") + "|" + (o.cal || "") + "|" + (o.rpm || "") + "|" + (o.fill ?? "");
    let list = this.cache.get(key);
    if (!list) {
      list = [];
      for (let v = 0; v < VARIANTS; v++) {
        const T2 = new Track(this.ctx.sampleRate, LEN[name] || 0.2);
        RECIPES[name](T2, o);
        list.push(T2.buffer(this.ctx));
      }
      this.cache.set(key, list);
    }
    return list[Math.random() * list.length | 0];
  }
};
var FOLEY_NAMES = Object.keys(RECIPES);

