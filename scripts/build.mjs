// Inlines every {% include "name" %} of src/<layout>.liquid (from src/name.liquid) into
// dist/<layout>.liquid: TRMNL takes one self-contained template per layout, and these are
// the files you paste into its markup editor.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
export const LAYOUTS = ["full", "half_horizontal", "half_vertical", "quadrant"];
const INCLUDE = /\{%-?\s*include\s+"([^"]+)"\s*-?%\}/g;

export function inline(name, seen = []) {
  if (seen.includes(name)) throw new Error(`include loop: ${[...seen, name].join(" → ")}`);
  const source = readFileSync(join(root, "src", `${name}.liquid`), "utf-8");
  return source.replace(INCLUDE, (_, inner) => inline(inner, [...seen, name]).trim());
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  mkdirSync(join(root, "dist"), { recursive: true });
  for (const layout of LAYOUTS) {
    const body = inline(layout)
      .replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, "")
      .replace(/\n\s*\n+/g, "\n");
    const out = `{%- comment -%} MeteoVerdict for TRMNL, ${layout}: https://github.com/JerryWoof/MeteoVerdict-TRMNL (built from src/, edit there) {%- endcomment -%}\n${body}`;
    writeFileSync(join(root, "dist", `${layout}.liquid`), out);
    console.log(`dist/${layout}.liquid  ${(out.length / 1024).toFixed(1)} kB`);
  }
}
