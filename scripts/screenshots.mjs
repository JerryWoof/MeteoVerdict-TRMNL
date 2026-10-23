// Screenshots for the README (and the Data page): renders with live data (MeteoVerdict AI, Prague) at noon of the day it was made, and
// takes 800x480 PNGs with headless Chrome. A grayscale + high-contrast filter stands in for the black-and-white panel.
//   node scripts/screenshots.mjs [chrome binary]
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { freezeTime, load, page, renderLayout } from "./render.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const chrome = process.argv[2] ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const tmp = join(root, ".screens");
mkdirSync(tmp, { recursive: true });
mkdirSync(join(root, "screenshots"), { recursive: true });

// MeteoVerdict AI, the default forecast, in English: the 24 hours, the two days and the five days
const VIEWS = { "next-24-hours": "next_24h", "today-tomorrow": "today_tomorrow", "five-days": "five_days" };
const SHOTS = Object.fromEntries(Object.entries(VIEWS).map(([name, view]) => [name, async () => renderLayout("full", await load({ okres: "CZ0100", ai: true }), { view, place: "Praha" })]));

// midday of the day the forecast was made, so the shots show today, not the evening switch
const generated = (await load({ okres: "CZ0100" })).forecast.generated;
freezeTime(`${generated.slice(0, 10)}T10:00:00Z`);

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
