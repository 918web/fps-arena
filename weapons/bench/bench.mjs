// Стенд производительности оружейной.
//   node bench/bench.mjs [--dir dist] [--out bench/results/x.json] [--weapons akm,svd] [--q high,low]
//                        [--steps 24] [--cpu 4] [--w 1280 --h 720]
// Рендер — headless Chromium на SwiftShader (программная растеризация на CPU): это «самый слабый ПК»,
// любое лишнее попиксельное или геометрическое усилие на нём видно сразу. --cpu N дополнительно
// замедляет главный поток в N раз (эмуляция слабого процессора, CDP Emulation.setCPUThrottlingRate).
//
// Что меряется для каждого ствола и уровня качества:
//   step.*    — стоимость одного кадра (update + рендер + gl sync) при зафиксированном DPR=1, мс.
//               Сценарии: view (статичный ракурс), fire (очередь), ads (оптика с кратностью, PiP),
//               night (ночь + фонарь), fireNight (стрельба ночью со вспышкой).
//   live      — реальный цикл requestAnimationFrame: вращение камеры мышью + очереди + смена модулей,
//               авто-качество как у пользователя: fps, p50/p95/p99, доля кадров > 33 мс, худший кадр.
//   swap      — длительность setPart (перестройка модуля) на главном потоке, мс.
//   boot      — время от навигации до готовой сцены, мс.
//   info      — draw calls / треугольники / шейдерные программы / геометрии / текстуры.
import { chromium } from "playwright";
import http from "node:http";
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { join, resolve, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const here = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (k, d) => {
  const i = argv.indexOf("--" + k);
  return i >= 0 ? argv[i + 1] : d;
};
const dir = resolve(here, "..", arg("dir", "dist"));
const out = resolve(here, "..", arg("out", "bench/results/latest.json"));
const qs = arg("q", "high,low").split(",");
const STEPS = +arg("steps", 8);
const CPU = +arg("cpu", 1);
const W = +arg("w", 640), H = +arg("h", 360);
const LIVE = arg("live", "0") !== "0";
const manifest = JSON.parse(readFileSync(resolve(here, "../src/manifest.json"), "utf8"));
const files = Object.keys(manifest).filter((f) => {
  const w = arg("weapons");
  return !w || w.split(",").some((x) => f.startsWith(x) || manifest[f].weapon === x);
});

// статика + кэш CDN, чтобы сеть не влияла на замеры
const cacheDir = join(here, ".cache");
mkdirSync(cacheDir, { recursive: true });
const server = http.createServer((req, res) => {
  const p = join(dir, decodeURIComponent(req.url.split("?")[0]));
  if (!p.startsWith(dir) || !existsSync(p) || !statSync(p).isFile()) return res.writeHead(404).end();
  res.writeHead(200, { "content-type": extname(p) === ".html" ? "text/html; charset=utf-8" : "application/javascript" });
  res.end(readFileSync(p));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch({
  args: ["--disable-dev-shm-usage", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--in-process-gpu", "--ignore-gpu-blocklist", "--disable-gpu-vsync", "--disable-frame-rate-limit"],
});

async function cdn(route) {
  const url = route.request().url();
  const f = join(cacheDir, createHash("md5").update(url).digest("hex"));
  if (!existsSync(f)) {
    const r = await fetch(url);
    if (!r.ok) return route.abort();
    writeFileSync(f, Buffer.from(await r.arrayBuffer()));
  }
  route.fulfill({ status: 200, contentType: "application/javascript", body: readFileSync(f) });
}

const pct = (a, p) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};
const r1 = (x) => Math.round(x * 10) / 10;

async function run(file, q) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await ctx.route(/^https:\/\/(unpkg\.com|cdn\.jsdelivr\.net)\//, cdn);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  if (CPU > 1) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU });
  }
  const t0 = Date.now();
  await page.goto(base + file + "?q=" + q, { waitUntil: "commit", timeout: 120000 });
  await page.waitForFunction(() => window.__app && document.getElementById("boot")?.classList.contains("off"), null, { timeout: 600000, polling: 100 });
  const boot = Date.now() - t0;

  page.setDefaultTimeout(0);
  const res = await page.evaluate(async ({ STEPS, LIVE }) => {
    const app = window.__app, S = app.S, R = S.renderer, gl = R.getContext();
    const px = new Uint8Array(4);
    const sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const frames = (n) => new Promise((r) => {
      let i = 0;
      const f = () => (++i >= n ? r() : requestAnimationFrame(f));
      requestAnimationFrame(f);
    });
    const info = () => {
      const i = R.info;
      return { calls: i.render.calls, tris: i.render.triangles, programs: i.programs?.length, geometries: i.memory.geometries, textures: i.memory.textures };
    };
    const slotFor = (cat) => app.def.slots.find((s) => s.accepts.includes(cat));
    const install = (cats, prefer = []) => {
      for (const cat of cats) {
        const slot = slotFor(cat);
        if (!slot) continue;
        const opts = app.asm.slotOptions(slot).filter((p) => p.cat === cat || cats.includes(p.cat));
        opts.sort((a, b) => (prefer.indexOf(b.id) >>> 0 < prefer.indexOf(a.id) >>> 0 ? 1 : -1));
        for (const p of opts) {
          app.setPart(slot.id, p.id);
          if (app.cfg[slot.id]?.id === p.id) return { slot: slot.id, id: p.id };
        }
      }
      return null;
    };
    // режим огня: авто, если есть
    const toAuto = () => {
      for (let i = 0; i < 4 && app.st.mode !== "auto" && app.def.modes.includes("auto"); i++) app.cycleMode();
      if (app.st.mode === "safe") app.cycleMode();
    };
    // DPR фиксирован в 1 — сравнение версий при одинаковом числе пикселей
    R.setPixelRatio(1);
    R.setSize(innerWidth, innerHeight);
    S.resize();
    const realSetPR = R.setPixelRatio;
    R.setPixelRatio = () => {};

    window.__pause = true;
    // фоновые задачи после загрузки (аудио, прогрев шейдеров) — как у живого пользователя,
    // который сначала смотрит на оружие; время до их завершения тоже пишем
    const w0 = performance.now();
    window.__pause = false;
    await Promise.race([app.warm || sleep(0), sleep(120000)]);
    await sleep(3000);
    window.__pause = true;
    const warmMs = performance.now() - w0 - 3000;
    // «первые разы»: кадр сразу после события; сюда попадает компиляция шейдеров и загрузка текстур
    const hitch = {};
    const progs = () => R.info.programs.length;
    const ev = (name, fn) => {
      const p0 = progs();
      app.step(1 / 60);
      sync();
      const a = performance.now();
      fn();
      app.step(1 / 60);
      sync();
      hitch[name] = { ms: performance.now() - a, programs: progs() - p0 };
    };
    const stepRun = (n, each) => {
      const t = [];
      for (let i = 0; i < 3; i++) (each?.(i), app.step(1 / 60), sync());
      for (let i = 0; i < n; i++) {
        each?.(i + 3);
        const a = performance.now();
        app.step(1 / 60);
        sync();
        t.push(performance.now() - a);
      }
      t.sort((a, b) => a - b);
      return { med: t[t.length >> 1], p90: t[Math.floor(t.length * 0.9)], mean: t.reduce((a, b) => a + b, 0) / t.length };
    };
    const refill = () => {
      if (app.st.mag < 3) app.st.mag = app.st.cap;
    };
    const fireEach = (i) => {
      refill();
      if (app.st.mode === "auto") {
        if (i === 0 || !app.st.trigger) app.triggerDown();
      } else if (i % 8 === 0) {
        app.triggerUp();
        app.triggerDown();
      }
    };
    const step = {};
    const infos = {};
    R.info.autoReset = false;
    const info0 = info;
    const infoFrame = () => {
      R.info.reset();
      app.step(1 / 60);
      sync();
      const r = info0();
      return r;
    };
    step.view = stepRun(STEPS);
    infos.view = infoFrame();
    toAuto();
    ev("firstShot", () => (refill(), app.triggerDown()));
    step.fire = stepRun(STEPS, fireEach);
    infos.fire = infoFrame();
    app.triggerUp();
    app.step(1 / 60, 90);
    let optic = null;
    ev("firstOptic", () => (optic = install(["optic"], ["acog", "pso1", "lpvo", "mk5hd", "posp"])));
    step.scope = stepRun(STEPS);
    app.step(1 / 60, 5);
    ev("adsOn", () => app.setADS(true));
    app.step(1 / 60, 40);
    step.ads = stepRun(STEPS);
    infos.ads = infoFrame();
    app.setADS(false);
    app.step(1 / 60, 40);
    let light = null;
    ev("firstLight", () => (light = install(["light", "combo", "plight"])));
    ev("night", () => app.setNight(true));
    ev("lightOn", () => light && app.toggleLight("main"));
    app.step(1 / 60, 10);
    step.night = stepRun(STEPS);
    infos.night = infoFrame();
    // второй фонарь (если есть вторая планка)
    const slots2 = app.def.slots.filter((s) => s.accepts.includes("light") && s.id !== light?.slot);
    let light2 = null;
    for (const s2 of slots2) {
      for (const p of app.asm.slotOptions(s2)) {
        app.setPart(s2.id, p.id);
        if (app.cfg[s2.id]?.id === p.id) {
          light2 = { slot: s2.id, id: p.id };
          break;
        }
      }
      if (light2) break;
    }
    if (light2) ev("light2On", () => app.toggleLight(1));
    step.fireNight = stepRun(STEPS, fireEach);
    app.triggerUp();
    app.step(1 / 60, 90);
    if (light) app.toggleLight("main");
    app.setNight(false);
    app.step(1 / 60, 10);

    // смена модулей: время перестройки на главном потоке
    const swaps = [];
    for (const cat of ["muzzle", "mag", "stock", "optic", "handguard"]) {
      const slot = slotFor(cat);
      if (!slot) continue;
      const opts = app.asm.slotOptions(slot).slice(0, 4);
      for (const p of opts) {
        const a = performance.now();
        app.setPart(slot.id, p.id);
        swaps.push(performance.now() - a);
      }
    }
    const a2 = performance.now();
    app.resetCfg?.();
    swaps.push(performance.now() - a2);
    // те же модули после предсборки в простое (если сборка её умеет): так их ставит пользователь,
    // который открыл список слота и навёл курсор
    let swapsPre = null;
    if (app.prebuildSlot) {
      window.__pause = false;
      const cats = ["muzzle", "stock", "optic", "handguard"];
      const want = [];
      for (const cat of cats) {
        const slot = slotFor(cat);
        if (!slot) continue;
        const opts = app.asm.slotOptions(slot).slice(4, 8);
        for (const p of opts) app.prebuild(slot.id, p.id), want.push([slot.id, p.id]);
      }
      await sleep(want.length * 900 + 1500);
      window.__pause = true;
      swapsPre = [];
      for (const [sid, pid] of want) {
        const a = performance.now();
        app.setPart(sid, pid);
        swapsPre.push(performance.now() - a);
      }
      app.resetCfg?.();
    }

    let live = null;
    if (LIVE) {
      R.setPixelRatio = realSetPR;
      window.__pause = false;
      await frames(20);
      await sleep(1600); // окно прогрева авто-качества
      const dts = [];
      let last = performance.now(), on = true;
      const tick = (t) => {
        dts.push(t - last);
        last = t;
        if (on) requestAnimationFrame(tick);
      };
      requestAnimationFrame((t) => {
        last = t;
        requestAnimationFrame(tick);
      });
      const cvs = R.domElement, rect = cvs.getBoundingClientRect();
      const cx = rect.width * 0.55, cy = rect.height * 0.5;
      const ev = (type, x, y, b = 1) => cvs.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, button: 0, buttons: b, pointerId: 1, pointerType: "mouse", isPrimary: true, bubbles: true }));
      const T0 = performance.now();
      const liveSwaps = [];
      ev("pointerdown", cx, cy);
      let k = 0;
      toAuto();
      while (performance.now() - T0 < 6000) {
        const t = (performance.now() - T0) / 1000;
        ev("pointermove", cx + Math.sin(t * 1.3) * 220, cy + Math.sin(t * 0.7) * 60);
        refill();
        if (Math.floor(t * 2) % 2 === 0) {
          if (!app.st.trigger) app.triggerDown();
        } else if (app.st.trigger) app.triggerUp();
        if (t > 3 && k < 3 && t > 3 + k * 0.8) {
          const slot = slotFor(["muzzle", "stock", "mag"][k]);
          const opts = slot ? app.asm.slotOptions(slot) : [];
          if (opts.length) {
            const a = performance.now();
            app.setPart(slot.id, opts[(k + 1) % opts.length].id);
            liveSwaps.push(performance.now() - a);
          }
          k++;
        }
        await new Promise((r) => requestAnimationFrame(r));
      }
      ev("pointerup", cx, cy, 0);
      app.triggerUp();
      on = false;
      const secs = (performance.now() - T0) / 1000;
      const d = dts.slice(1);
      const s = [...d].sort((a, b) => a - b);
      const P = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
      live = { fps: d.length / secs, p50: P(0.5), p95: P(0.95), p99: P(0.99), max: s[s.length - 1], over33: d.filter((x) => x > 33.4).length / d.length, over50: d.filter((x) => x > 50).length, quality: app.quality(), swaps: liveSwaps };
    }
    return { warmMs, step, infos, hitch, optic, light, light2, swaps, swapsPre, live, heapMB: performance.memory ? performance.memory.usedJSHeapSize / 1048576 : null };
  }, { STEPS, LIVE });
  await ctx.close();
  return { boot, errors: errors.slice(0, 5), ...res };
}

const results = { meta: { dir, W, H, CPU, STEPS, date: new Date().toISOString(), ua: browser.version() }, runs: {} };
for (const f of files) {
  for (const q of qs) {
    const key = `${f}@${q}`;
    process.stdout.write(key.padEnd(28));
    try {
      const r = await run(f, q);
      results.runs[key] = r;
      const s = r.step;
      console.log(
        `boot ${r1(r.boot / 1000)}s warm ${r1(r.warmMs / 1000)}s | view ${r1(s.view.med)} fire ${r1(s.fire.med)} scope ${r1(s.scope.med)} ads ${r1(s.ads.med)} night ${r1(s.night.med)} fireN ${r1(s.fireNight.med)} ms` +
          ` | hitch max ${r1(Math.max(...Object.values(r.hitch).map((h) => h.ms)))} progs ${Object.values(r.hitch).reduce((a, h) => a + h.programs, 0)}` +
          ` | calls ${r.infos.view.calls} tris ${r.infos.view.tris} prog ${r.infos.fire.programs}` +
          ` | swap p50 ${r1(pct(r.swaps, 0.5))} max ${r1(Math.max(...r.swaps))}` +
          (r.swapsPre ? ` pre p50 ${r1(pct(r.swapsPre, 0.5))} max ${r1(Math.max(...r.swapsPre))}` : "") +
          (r.live ? ` | live ${r1(r.live.fps)}fps p95 ${r1(r.live.p95)} p99 ${r1(r.live.p99)} max ${r1(r.live.max)} >33 ${Math.round(r.live.over33 * 100)}% lvl ${r.live.quality.level}` : "") +
          (r.errors.length ? ` | ERR ${r.errors[0].slice(0, 120)}` : ""),
      );
    } catch (e) {
      console.log("FAIL " + e.message.split("\n")[0]);
      results.runs[key] = { error: e.message };
    }
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(results, null, 1));
  }
}
await browser.close();
server.close();
