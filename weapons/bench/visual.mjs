// Попиксельное сравнение картинки двух сборок (например, исходной и оптимизированной).
//   node bench/visual.mjs --a /path/to/baseline --b dist [--weapons akm,svd] [--q high] [--w 800 --h 450] [--png bench/results/visual]
// Время и Math.random зафиксированы, кадры рисуются пошагово (app.step), пиксели читаются из GL сразу
// после рендера. Для каждого сценария печатается доля отличающихся пикселей и максимальное отличие.
import { chromium } from "playwright";
import http from "node:http";
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { join, resolve, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import zlib from "node:zlib";

const here = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (k, d) => {
  const i = argv.indexOf("--" + k);
  return i >= 0 ? argv[i + 1] : d;
};
const dirA = resolve(process.cwd(), arg("a")), dirB = resolve(process.cwd(), arg("b", "dist"));
const W = +arg("w", 800), H = +arg("h", 450), Q = arg("q", "high");
const pngDir = arg("png") ? resolve(process.cwd(), arg("png")) : null;
const manifest = JSON.parse(readFileSync(resolve(here, "../src/manifest.json"), "utf8"));
const files = Object.keys(manifest).filter((f) => {
  const w = arg("weapons");
  return !w || w.split(",").some((x) => f.startsWith(x) || manifest[f].weapon === x);
});
const cacheDir = join(here, ".cache");
mkdirSync(cacheDir, { recursive: true });

function serve(dir) {
  const s = http.createServer((req, res) => {
    const p = join(dir, decodeURIComponent(req.url.split("?")[0]));
    if (!p.startsWith(dir) || !existsSync(p) || !statSync(p).isFile()) return res.writeHead(404).end();
    res.writeHead(200, { "content-type": extname(p) === ".html" ? "text/html; charset=utf-8" : "application/javascript" });
    res.end(readFileSync(p));
  });
  return new Promise((r) => s.listen(0, "127.0.0.1", () => r(s)));
}
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
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    // GL читает снизу вверх
    Buffer.from(rgba.buffer, rgba.byteOffset + (h - 1 - y) * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  const crcT = new Int32Array(256).map((_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c;
  });
  const crc = (b) => {
    let c = -1;
    for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  };
  const chunk = (t, d) => {
    const l = Buffer.alloc(4);
    l.writeUInt32BE(d.length);
    const td = Buffer.concat([Buffer.from(t), d]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([l, td, c]);
  };
  const ih = Buffer.alloc(13);
  ih.writeUInt32BE(w, 0);
  ih.writeUInt32BE(h, 4);
  ih[8] = 8;
  ih[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ih), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

const browser = await chromium.launch({
  args: ["--disable-dev-shm-usage", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--in-process-gpu", "--ignore-gpu-blocklist"],
});

async function capture(base, file) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await ctx.route(/^https:\/\/(unpkg\.com|cdn\.jsdelivr\.net)\//, cdn);
  // детерминированный Math.random
  // (UUID материалов тоже берутся из Math.random, поэтому перед каждым сценарием генератор пересевается)
  await ctx.addInitScript(() => {
    let s = 12345;
    Math.random = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    window.__seed = (v) => (s = v >>> 0);
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(base + file + "?q=" + Q, { waitUntil: "commit", timeout: 120000 });
  await page.waitForFunction(() => window.__app && document.getElementById("boot")?.classList.contains("off"), null, { timeout: 0, polling: 200 });
  page.setDefaultTimeout(0);
  const shots = await page.evaluate(() => {
    window.__pause = true;
    const app = window.__app, S = app.S, R = S.renderer, gl = R.getContext();
    R.setPixelRatio(1);
    R.setSize(innerWidth, innerHeight);
    S.resize();
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    const pn = performance.now.bind(performance);
    let fake = 5000;
    const grab = (n = 1) => {
      window.__seed(777 + n);
      performance.now = () => fake;
      for (let i = 0; i < n; i++) {
        fake += 1000 / 60;
        app.step(1 / 60);
      }
      const px = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      performance.now = pn;
      return Array.from(px);
    };
    const out = {};
    out.day = grab(3);
    for (let i = 0; i < 4 && app.st.mode !== "auto" && app.def.modes.includes("auto"); i++) app.cycleMode();
    if (app.st.mode === "safe") app.cycleMode();
    performance.now = () => fake;
    window.__seed(4242);
    app.triggerDown();
    performance.now = pn;
    out.fire = grab(4);
    app.triggerUp();
    grab(120);
    const slot = app.def.slots.find((s) => s.accepts.includes("light"));
    const lp = slot && app.asm.slotOptions(slot)[0];
    if (lp) app.setPart(slot.id, lp.id);
    app.setNight(true);
    if (lp) app.toggleLight("main");
    out.night = grab(6);
    return { w, h, out };
  });
  await ctx.close();
  return { ...shots, errors };
}

const sA = await serve(dirA), sB = await serve(dirB);
const baseA = `http://127.0.0.1:${sA.address().port}/`, baseB = `http://127.0.0.1:${sB.address().port}/`;
let worst = 0;
for (const f of files) {
  const [a, b] = [await capture(baseA, f), await capture(baseB, f)];
  for (const k of Object.keys(a.out)) {
    const A = a.out[k], B = b.out[k];
    let diff = 0, max = 0, sum = 0;
    for (let i = 0; i < A.length; i += 4) {
      const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2]));
      if (d > 2) diff++;
      if (d > max) max = d;
      sum += d;
    }
    const n = A.length / 4;
    worst = Math.max(worst, diff / n);
    console.log(`${f.padEnd(20)} ${k.padEnd(6)} пикселей с отличием >2/255: ${((diff / n) * 100).toFixed(3)}%  среднее ${(sum / n).toFixed(3)}  максимум ${max}` + (a.errors.length || b.errors.length ? `  ERR ${[...a.errors, ...b.errors][0]}` : ""));
    if (pngDir) {
      mkdirSync(pngDir, { recursive: true });
      writeFileSync(join(pngDir, `${f.replace(".html", "")}_${k}_a.png`), png(a.w, a.h, Uint8Array.from(A)));
      writeFileSync(join(pngDir, `${f.replace(".html", "")}_${k}_b.png`), png(b.w, b.h, Uint8Array.from(B)));
    }
  }
}
console.log("худшая доля отличающихся пикселей: " + (worst * 100).toFixed(3) + "%");
await browser.close();
sA.close();
sB.close();
