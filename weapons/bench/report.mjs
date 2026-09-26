// Сводка A/B: node bench/report.mjs <папка с base_*.json и new_*.json> > bench/results/REPORT.md
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
const dir = process.argv[2];
const load = (f) => Object.values(JSON.parse(readFileSync(join(dir, f), "utf8")).runs)[0];
const pairs = readdirSync(dir).filter((f) => f.startsWith("base_") && f.endsWith(".json")).map((f) => [f.slice(5, -5), load(f), load("new_" + f.slice(5))]);
const r0 = (x) => (x == null ? "—" : Math.round(x));
const pct = (a, b) => (a && b ? `${b < a ? "−" : "+"}${Math.abs(Math.round((1 - b / a) * 100))}%` : "");
const med = (a) => (a?.length ? [...a].sort((x, y) => x - y)[a.length >> 1] : null);
const mx = (a) => (a?.length ? Math.max(...a) : null);
const out = [];
out.push("### Стоимость кадра, мс (медиана; update + рендер + синхронизация GPU, DPR 1)\n");
out.push("| ствол | статичный ракурс | очередь | с оптикой (PiP) | прицеливание | ночь + фонарь | очередь ночью |");
out.push("|---|---|---|---|---|---|---|");
const tot = { base: 0, neu: 0 };
for (const [k, a, b] of pairs) {
  const c = (s) => `${r0(a.step[s].med)} → **${r0(b.step[s].med)}** (${pct(a.step[s].med, b.step[s].med)})`;
  out.push(`| ${k} | ${c("view")} | ${c("fire")} | ${c("scope")} | ${c("ads")} | ${c("night")} | ${c("fireNight")} |`);
  for (const s of ["view", "fire", "scope", "ads", "night", "fireNight"]) (tot.base += a.step[s].med), (tot.neu += b.step[s].med);
}
out.push(`\nВ сумме по всем сценариям: ${r0(tot.base)} → ${r0(tot.neu)} мс (${pct(tot.base, tot.neu)}).\n`);
out.push("### «Первые разы» — кадр сразу после события, мс (в скобках — шейдеров скомпилировано в этом кадре)\n");
const evs = ["firstShot", "firstOptic", "adsOn", "firstLight", "night", "lightOn", "light2On"];
const evn = { firstShot: "1-й выстрел", firstOptic: "1-й прицел", adsOn: "прицеливание", firstLight: "1-й фонарь", night: "ночь", lightOn: "фонарь вкл", light2On: "2-й фонарь вкл" };
out.push("| ствол | " + evs.map((e) => evn[e]).join(" | ") + " |");
out.push("|---|" + evs.map(() => "---").join("|") + "|");
let pa = 0, pb = 0;
for (const [k, a, b] of pairs) {
  out.push(`| ${k} | ` + evs.map((e) => {
    const x = a.hitch[e], y = b.hitch[e];
    if (!x || !y) return "—";
    pa += x.programs;
    pb += y.programs;
    return `${r0(x.ms)} (${x.programs}) → **${r0(y.ms)} (${y.programs})**`;
  }).join(" | ") + " |");
}
out.push(`\nШейдеров, скомпилированных прямо в кадре во время этих событий: ${pa} → ${pb}.\n`);
out.push("### Смена модулей, мс на главном потоке (медиана / худший)\n");
out.push("| ствол | было (сборка при клике) | стало: холодная | стало: после предсборки |");
out.push("|---|---|---|---|");
for (const [k, a, b] of pairs) out.push(`| ${k} | ${r0(med(a.swaps))} / ${r0(mx(a.swaps))} | ${r0(med(b.swaps))} / ${r0(mx(b.swaps))} | **${r0(med(b.swapsPre))} / ${r0(mx(b.swapsPre))}** |`);
out.push("\n### Загрузка и ресурсы\n");
out.push("| ствол | загрузка, с | фоновый прогрев после загрузки, с | draw calls за кадр | шейдерных программ готово |");
out.push("|---|---|---|---|---|");
for (const [k, a, b] of pairs) out.push(`| ${k} | ${(a.boot / 1000).toFixed(1)} → ${(b.boot / 1000).toFixed(1)} | ${(b.warmMs / 1000).toFixed(1)} | ${a.infos.view.calls} → ${b.infos.view.calls} | ${a.infos.fire.programs} → ${b.infos.fire.programs} |`);
console.log(out.join("\n"));
