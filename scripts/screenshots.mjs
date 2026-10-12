// Screenshots for the README: renders with live data and takes 800x480 PNGs with headless
// Chrome. A grayscale + high-contrast filter stands in for the black-and-white panel.
//   node scripts/screenshots.mjs [chrome binary]
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { load, page, renderLayout } from "./render.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const chrome = process.argv[2] ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const tmp = join(root, ".screens");
mkdirSync(tmp, { recursive: true });
mkdirSync(join(root, "screenshots"), { recursive: true });

const one = (layout, okres, opts) => async () => renderLayout(layout, await load({ okres }), opts);
const mashup = (kind, parts) => async () => `<div class="mashup mashup--${kind}">${(await Promise.all(parts.map((p) => p()))).join("")}</div>`;
const SHOTS = {
  "today-tomorrow": one("full", "CZ0100", { view: "today_tomorrow", place: "Praha" }),
  "next-24-hours": one("full", "CZ0100", { view: "next_24h", place: "Praha" }),
  "five-days": one("full", "CZ0100", { view: "five_days", place: "Praha" }),
  "today-tomorrow-cs": one("full", "CZ0642", { view: "today_tomorrow", place: "Brno", lang: "cs" }),
  "mashup-half-horizontal": mashup("1Tx1B", [
    one("half_horizontal", "CZ0100", { place: "Praha" }),
    one("half_horizontal", "CZ0642", { place: "Brno" }),
  ]),
  "mashup-half-vertical": mashup("1Lx1R", [
    one("half_vertical", "CZ0100", { place: "Praha" }),
    one("half_vertical", "CZ0806", { place: "Ostrava" }),
  ]),
  "mashup-quadrants": mashup("2x2", [
    one("quadrant", "CZ0100", { place: "Praha" }),
    one("quadrant", "CZ0642", { place: "Brno" }),
    one("quadrant", "CZ0806", { place: "Ostrava" }),
    one("quadrant", "CZ0323", { place: "Plzeň" }),
  ]),
};

for (const [name, make] of Object.entries(SHOTS)) {
  const html = page(await make()).replace("</style>", ".screen{filter:grayscale(1) contrast(20)}</style>");
  const file = join(tmp, `${name}.html`);
  writeFileSync(file, html);
  const png = join(root, "screenshots", `${name}.png`);
  execFileSync(chrome, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
    "--window-size=800,480", "--virtual-time-budget=5000", `--screenshot=${png}`, `file://${file}`,
  ], { stdio: "ignore" });
  console.log(`screenshots/${name}.png`);
}
rmSync(tmp, { recursive: true, force: true });
