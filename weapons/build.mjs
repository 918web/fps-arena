// Собирает автономные страницы оружейной: dist/<файл>.html = shell.html + prelude.js + секции из manifest.json.
// Никаких зависимостей — только node.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, "src");
const read = (p) => readFileSync(join(src, p), "utf8");
const manifest = JSON.parse(read("manifest.json"));
const shell = read("shell.html");
const prelude = read("prelude.js");
const outDir = resolve(root, process.argv[2] || "dist");
mkdirSync(outDir, { recursive: true });

for (const [file, m] of Object.entries(manifest)) {
  const script = prelude + m.sections.map((s) => `// ${s}\n` + readFileSync(join(root, s), "utf8")).join("");
  const html = shell
    .replace("{{TITLE}}", () => m.title)
    .replace("{{WEAPON}}", () => m.weapon)
    .replace("{{SCRIPT}}", () => script);
  writeFileSync(join(outDir, file), html);
  console.log(`${file.padEnd(20)} ${(html.length / 1024).toFixed(0)} KB`);
}
