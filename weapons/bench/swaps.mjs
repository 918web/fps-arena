// Смена модулей глазами пользователя: открыл список слота, навёл курсор, кликнул.
//   node bench/swaps.mjs --dir dist [--weapons akm,svd] [--cpu 4]
// Если сборка умеет предсборку (app.prebuildSlot), она запускается как из UI и ожидается;
// затем меряется setPart на главном потоке. Без предсборки — просто setPart (сборка при клике).
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
const CPU = +arg("cpu", 1);
const manifest = JSON.parse(readFileSync(resolve(here, "../src/manifest.json"), "utf8"));
const files = Object.keys(manifest).filter((f) => {
  const w = arg("weapons");
  return !w || w.split(",").some((x) => f.startsWith(x) || manifest[f].weapon === x);
});
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
const browser = await chromium.launch({ args: ["--disable-dev-shm-usage", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--in-process-gpu", "--ignore-gpu-blocklist"] });
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
for (const f of files) {
  const ctx = await browser.newContext({ viewport: { width: 480, height: 270 } });
  await ctx.route(/^https:\/\/(unpkg\.com|cdn\.jsdelivr\.net)\//, cdn);
  const page = await ctx.newPage();
  if (CPU > 1) await (await ctx.newCDPSession(page)).send("Emulation.setCPUThrottlingRate", { rate: CPU });
  await page.goto(base + f + "?q=low", { waitUntil: "commit", timeout: 120000 });
  await page.waitForFunction(() => window.__app && document.getElementById("boot")?.classList.contains("off"), null, { timeout: 0, polling: 200 });
  page.setDefaultTimeout(0);
  const r = await page.evaluate(async () => {
    const app = window.__app, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    await Promise.race([app.warm || sleep(0), sleep(120000)]);
    await sleep(2000);
    const out = [];
    for (const cat of ["optic", "muzzle", "stock", "handguard", "mag", "pgrip", "light", "foregrip"]) {
      const slot = app.def.slots.find((s) => s.accepts.includes(cat) && !out.some((o) => o.slot === s.id));
      if (!slot) continue;
      const opts = app.asm.slotOptions(slot).filter((p) => p.id !== app.cfg[slot.id]?.id).slice(0, 3);
      if (app.prebuildSlot) {
        app.prebuildSlot(slot.id);
        for (const p of opts) app.prebuild(slot.id, p.id);
        const t0 = performance.now();
        while (performance.now() - t0 < 30000 && opts.some((p) => !app.asm.cache.has(slot.id + "|" + p.id))) await sleep(100);
      }
      for (const p of opts) {
        const a = performance.now();
        app.setPart(slot.id, p.id);
        out.push({ slot: slot.id, id: p.id, ms: performance.now() - a, ok: app.cfg[slot.id]?.id === p.id });
        await sleep(400);
      }
      app.resetCfg?.();
      await sleep(600);
    }
    return out;
  });
  await ctx.close();
  const ms = r.filter((x) => x.ok).map((x) => x.ms).sort((a, b) => a - b);
  console.log(`${f.padEnd(20)} установок ${ms.length}  медиана ${Math.round(ms[ms.length >> 1])} мс  худшая ${Math.round(ms[ms.length - 1])} мс  (${r.filter((x) => x.ok).map((x) => x.id + " " + Math.round(x.ms)).join(", ")})`);
}
await browser.close();
server.close();
