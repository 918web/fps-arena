import * as THREE9 from "three";
// Внешняя баллистика: точечная масса, закон сопротивления G1 (таблица McCoy), стандартная
// атмосфера (15 °C, 760 мм рт. ст.), ветер, деривация (эмпирика Litz). Дробь — сферы со своим Cd(M).
// Интегрирование — полунеявный Эйлер с шагом 0,5 мс: на 100 м ошибка по снижению < 0,1 мм.
var G1_TABLE = [
  [0, 0.2629], [0.05, 0.2558], [0.1, 0.2487], [0.15, 0.2413], [0.2, 0.2344], [0.25, 0.2278], [0.3, 0.2214], [0.35, 0.2155],
  [0.4, 0.2104], [0.45, 0.2061], [0.5, 0.2032], [0.55, 0.202], [0.6, 0.2034], [0.7, 0.2165], [0.725, 0.223], [0.75, 0.2313],
  [0.775, 0.2417], [0.8, 0.2546], [0.825, 0.2706], [0.85, 0.2901], [0.875, 0.3136], [0.9, 0.3415], [0.925, 0.3734], [0.95, 0.4084],
  [0.975, 0.4448], [1, 0.4805], [1.025, 0.5136], [1.05, 0.5427], [1.075, 0.5677], [1.1, 0.5883], [1.125, 0.6053], [1.15, 0.6191],
  [1.2, 0.6393], [1.25, 0.6518], [1.3, 0.6589], [1.35, 0.6621], [1.4, 0.6625], [1.45, 0.6607], [1.5, 0.6573], [1.55, 0.6528],
  [1.6, 0.6474], [1.65, 0.6413], [1.7, 0.6347], [1.75, 0.628], [1.8, 0.621], [1.85, 0.6141], [1.9, 0.6072], [1.95, 0.6003],
  [2, 0.5934], [2.05, 0.5867], [2.1, 0.5804], [2.15, 0.5743], [2.2, 0.5685], [2.25, 0.563], [2.3, 0.5577], [2.35, 0.5527],
  [2.4, 0.5481], [2.45, 0.5438], [2.5, 0.5397], [2.6, 0.5325], [2.7, 0.5264], [2.8, 0.5211], [2.9, 0.5168], [3, 0.5133],
  [3.2, 0.5077], [3.4, 0.5041], [3.6, 0.5019], [4, 0.4993]
];
// Сфера (картечь/дробь): докритический режим ≈0,47, волновой кризис у M≈0,8…1,2
var SPHERE_TABLE = [[0, 0.47], [0.5, 0.47], [0.6, 0.49], [0.7, 0.53], [0.8, 0.6], [0.9, 0.72], [1, 0.86], [1.1, 0.94], [1.2, 0.97], [1.5, 0.98], [2, 0.96], [3, 0.94]];
function tableLookup(T, m) {
  if (m <= T[0][0]) return T[0][1];
  let lo = 0, hi = T.length - 1;
  if (m >= T[hi][0]) return T[hi][1];
  while (hi - lo > 1) {
    const mid = lo + hi >> 1;
    if (T[mid][0] > m) hi = mid;
    else lo = mid;
  }
  const [m0, c0] = T[lo], [m1, c1] = T[hi];
  return c0 + (c1 - c0) * (m - m0) / (m1 - m0);
}
var AIR = { rho: 1.225, sound: 340.3, g: 9.80665 };
var LB_IN2 = 703.0696;
// Пули по калибрам (масса г, BC G1 фунт/дюйм², диаметр мм, шаг нарезов мм, цвет трассера).
// Отечественные трассеры (Т-46, 7Т2, 7Т3) горят зелёным, натовские M62/M856 — красным.
var BULLETS = {
  "556": { name: "M855", mass: 4, bc: 0.304, d: 5.7, twist: 178, tracer: 16725558 },
  "545": { name: "7Н6", mass: 3.42, bc: 0.336, d: 5.6, twist: 255, tracer: 6750070 },
  "762x39": { name: "57-Н-231", mass: 7.9, bc: 0.275, d: 7.9, twist: 240, tracer: 6750070 },
  "762x51": { name: "M80", mass: 9.5, bc: 0.393, d: 7.82, twist: 305, tracer: 16725558 },
  "762x54R": { name: "7Н1", mass: 9.8, bc: 0.42, d: 7.92, twist: 320, tracer: 6750070 },
  "9x19": { name: "57-Н-181С", mass: 8, bc: 0.145, d: 9.01, twist: 250, tracer: 16725558 },
  "12ga": { name: "картечь 00", mass: 3.48, d: 8.38, sphere: true }
};
// 12 калибр: снаряд определяется выбранным патроном
var SHELLS = {
  buck00: { name: "картечь 00", mass: 3.48, d: 8.38, sphere: true },
  shot4: { name: "картечь №4", mass: 1.34, d: 6.1, sphere: true },
  slug: { name: "пуля Бреннеке", mass: 31.5, bc: 0.078, d: 18.5, twist: 0 }
};
function bulletSpec(cal, ammoId) {
  return SHELLS[ammoId] || BULLETS[cal] || BULLETS["556"];
}
// Коэффициент в a = k(M)·v·v⃗: G1 — через BC, сфера — через площадь миделя
function dragK(spec, mach) {
  if (spec.sphere) {
    const A = Math.PI * Math.pow(spec.d / 2e3, 2);
    return AIR.rho * tableLookup(SPHERE_TABLE, mach) * A / (2 * spec.mass / 1e3);
  }
  return Math.PI * AIR.rho * tableLookup(G1_TABLE, mach) / (8 * spec.bc * LB_IN2);
}
// Деривация по Litz: SD[дюйм] = 1,25·(Sg + 1,2)·t^1,83; вправо при правых нарезах
function spinDrift(spec, t) {
  if (!spec.twist) return 0;
  return 1.25 * (1.7 + 1.2) * Math.pow(t, 1.83) * 0.0254;
}
var STEP = 5e-4;
// Плоская траектория в системе ствола (x — вдоль оси, y — вверх) для пристрелки и BDC.
// Возвращает точки через каждые dx метров: {x, y, t, v}.
function trajectory2D(spec, v0, angle, maxX, dx = 1) {
  let x = 0, y = 0, t = 0, vx = v0 * Math.cos(angle), vy = v0 * Math.sin(angle);
  const out = [{ x: 0, y: 0, t: 0, v: v0 }];
  let next = dx;
  while (x < maxX && t < 6) {
    const v = Math.hypot(vx, vy), k = dragK(spec, v / AIR.sound) * v;
    vx -= k * vx * STEP;
    vy -= (k * vy + AIR.g) * STEP;
    const px = x, py = y, pt = t;
    x += vx * STEP;
    y += vy * STEP;
    t += STEP;
    while (x >= next && next <= maxX) {
      const f = (next - px) / (x - px);
      out.push({ x: next, y: py + (y - py) * f, t: pt + STEP * f, v: Math.hypot(vx, vy) });
      next += dx;
    }
    if (vx < 30) break;
  }
  return out;
}
var zeroCache = /* @__PURE__ */ new Map();
// Пристрелка: угол возвышения ствола над линией прицеливания, при котором траектория пересекает
// линию прицеливания (высота h м над осью канала, боковой вынос z м) на дальности Z.
function zeroSolution(spec, v0, h, z, Z) {
  const key = [spec.name, spec.mass, v0.toFixed(1), h.toFixed(4), z.toFixed(4), Z].join("|");
  if (zeroCache.has(key)) return zeroCache.get(key);
  const yAt = (a) => {
    const tr = trajectory2D(spec, v0, a, Z, Z);
    const p = tr[tr.length - 1];
    return p.x >= Z - 1e-6 ? p : null;
  };
  let a0 = Math.atan2(h, Z), a1 = a0 + 2e-3;
  let p0 = yAt(a0), p1 = yAt(a1), f0 = p0 ? p0.y - h : -1, f1 = p1 ? p1.y - h : -1;
  for (let i = 0; i < 12 && Math.abs(f1) > 1e-6 && f1 !== f0; i++) {
    const a2 = a1 - f1 * (a1 - a0) / (f1 - f0);
    a0 = a1;
    f0 = f1;
    a1 = Math.min(0.2, Math.max(-0.05, a2));
    p1 = yAt(a1);
    f1 = p1 ? p1.y - h : -1;
  }
  const tZ = p1 ? p1.t : 0;
  const sol = { elev: a1, wind: Math.atan2(z - spinDrift(spec, tZ), Z), Z, h, z, v0 };
  zeroCache.set(key, sol);
  if (zeroCache.size > 64) zeroCache.delete(zeroCache.keys().next().value);
  return sol;
}
// Поправки на дальности R (в угловых минутах вниз от точки прицеливания) для BDC-сеток
function holdovers(spec, v0, sol, ranges) {
  const maxR = Math.max(...ranges);
  const tr = trajectory2D(spec, v0, sol.elev, maxR, 1);
  return ranges.map((R) => {
    const p = tr[Math.min(tr.length - 1, Math.round(R))];
    if (!p || p.x < R - 1) return null;
    return { R, moa: Math.atan2(sol.h - p.y, R) / (Math.PI / 10800), t: p.t, v: p.v };
  });
}
// Пули в полёте. Попадания определяются отрезками траектории за кадр (raycast по сегменту),
// поэтому время подлёта, снижение, снос ветром и потеря скорости — честные.
var Ballistics = class {
  constructor() {
    this.list = [];
    this.ray = new THREE9.Raycaster();
    this._d = new THREE9.Vector3();
    this._n = new THREE9.Vector3();
  }
  // o: {pos, vel, spec, right(Vector3 — вправо от стрелка), tracer, trace, onHit(hit, b)}
  fire(o) {
    const b = {
      p: o.pos.clone(),
      v: o.vel.clone(),
      prev: o.pos.clone(),
      origin: o.pos.clone(),
      right: o.right.clone(),
      spec: o.spec,
      v0: o.vel.length(),
      t: 0,
      sd: 0,
      dist: 0,
      alive: true,
      tracer: !!o.tracer,
      trace: o.trace !== false,
      ricochets: 0,
      onHit: o.onHit,
      hist: [o.pos.clone()]
    };
    this.list.push(b);
    return b;
  }
  get active() {
    return this.list.length > 0;
  }
  update(dt, hitables, wind) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const b = this.list[i];
      if (!b.alive) {
        b.fade = (b.fade ?? 0.12) - dt;
        if (b.fade <= 0) this.list.splice(i, 1);
        continue;
      }
      b.prev.copy(b.p);
      let left = dt;
      while (left > 1e-7) {
        const h = Math.min(STEP * 4, left);
        left -= h;
        const rx = b.v.x - wind.x, ry = b.v.y - wind.y, rz = b.v.z - wind.z;
        const vr = Math.hypot(rx, ry, rz), k = dragK(b.spec, vr / AIR.sound) * vr;
        b.v.x -= k * rx * h;
        b.v.y -= (k * ry + AIR.g) * h;
        b.v.z -= k * rz * h;
        b.p.addScaledVector(b.v, h);
        b.t += h;
      }
      const sd = spinDrift(b.spec, b.t);
      b.p.addScaledVector(b.right, sd - b.sd);
      b.sd = sd;
      const seg = this._d.subVectors(b.p, b.prev), L = seg.length();
      if (L > 1e-6) {
        this.ray.set(b.prev, seg.divideScalar(L));
        this.ray.far = L;
        this.ray.near = 0;
        const hit = this.ray.intersectObjects(hitables, false)[0];
        if (hit) {
          b.p.copy(hit.point);
          b.dist = b.origin.distanceTo(hit.point);
          const n = hit.face ? this._n.copy(hit.face.normal).transformDirection(hit.object.matrixWorld) : this._n.set(0, 1, 0);
          const vl = b.v.length(), cosI = -b.v.dot(n) / vl;
          const surf = hit.object.userData.surface || "dirt";
          // рикошет от грунта под скользящим углом (< ≈7°): пуля теряет большую часть скорости
          const graze = surf !== "steel" && cosI < 0.12 && vl > 180 && b.ricochets < 1 && Math.random() < 0.65;
          b.onHit?.(hit, b, vl, graze);
          // бумагу/картон пуля пробивает почти без потери скорости и летит дальше, до вала
          if (surf === "paper" && (b.pierced = (b.pierced || 0) + 1) < 4) {
            b.v.multiplyScalar(0.985);
            b.p.addScaledVector(b.v, 4e-3 / vl);
          } else if (graze) {
            b.ricochets++;
            b.v.addScaledVector(n, -2 * b.v.dot(n)).multiplyScalar(0.45 + Math.random() * 0.15);
            b.v.x += (Math.random() - 0.5) * 0.12 * vl;
            b.v.y += Math.random() * 0.1 * vl;
            b.v.z += (Math.random() - 0.5) * 0.12 * vl;
            b.p.addScaledVector(n, 0.01);
          } else b.alive = false;
        }
      }
      b.hist.push(b.p.clone());
      if (b.hist.length > 6) b.hist.shift();
      if (b.alive && (b.t > 4 || b.p.y < -3 || b.v.length() < 50)) b.alive = false;
    }
  }
};

