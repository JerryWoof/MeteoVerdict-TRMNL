// Screenshots for the README (and the Data page): renders with live data (MeteoVerdict AI, Prague) at noon of the day it was made, and
// takes 800x480 PNGs with headless Chrome. A grayscale + high-contrast filter stands in for the black-and-white panel.
//   node scripts/screenshots.mjs [chrome binary]
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { DEVICES, freezeTime, load, page, renderLayout } from "./render.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const chrome = process.argv[2] ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const tmp = join(root, ".screens");
mkdirSync(tmp, { recursive: true });
mkdirSync(join(root, "screenshots"), { recursive: true });

// MeteoVerdict AI, the default forecast: the 48 hours (the file keeps its old name, as the README and
// the Data page link to it), the five days, and today and tomorrow in Czech
const VIEWS = { "next-24-hours": ["next_48h", "en"], "today-tomorrow": ["today_tomorrow", "cs"], "five-days": ["five_days", "en"] };
const SHOTS = Object.fromEntries(Object.entries(VIEWS).map(([name, [view, lang]]) => [name, async () => renderLayout("full", await load({ okres: "CZ0100", ai: true }), { view, lang, place: "Praha" })]));
// and the same 48 hours on TRMNL X (1872 x 1404)
const X_SHOTS = { "next-24-hours-trmnl-x": SHOTS["next-24-hours"] };

// midday of the day the forecast was made, so the shots show today, not the evening switch
const generated = (await load({ okres: "CZ0100" })).forecast.generated;
freezeTime(`${generated.slice(0, 10)}T10:00:00Z`);

for (const [name, make, device = "og"] of [...Object.entries(SHOTS), ...Object.entries(X_SHOTS).map(([n, m]) => [n, m, "x"])]) {
  const html = page(await make(), DEVICES[device].size, device).replace("</style>", ".screen{filter:grayscale(1) contrast(20)}</style>");
  const file = join(tmp, `${name}.html`);
  writeFileSync(file, html);
  const png = join(root, "screenshots", `${name}.png`);
  execFileSync(chrome, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
    `--window-size=${DEVICES[device].size.join(",")}`, "--virtual-time-budget=5000", `--screenshot=${png}`, `file://${file}`,
  ], { stdio: "ignore" });
  console.log(`screenshots/${name}.png`);
}
rmSync(tmp, { recursive: true, force: true });
