// Screenshots for the README: renders with live data at noon of the day it was made, and
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

const one = (layout, okres, opts) => async () => renderLayout(layout, await load({ okres }), opts);
const mashup = (kind, parts) => async () => `<div class="mashup mashup--${kind}">${(await Promise.all(parts.map((p) => p()))).join("")}</div>`;
// the live Prague forecast made 14° colder, windy and with a wet night: shows the warnings
const winter = (opts) => async () => {
  const doc = await load({ okres: "CZ0100" });
  const f = doc.forecast;
  f.hourly.temperature_2m = f.hourly.temperature_2m.map((v) => (v == null ? v : v - 14));
  f.hourly.wind_speed_10m = f.hourly.wind_speed_10m.map(() => 8);
  f.hourly.precipitation = f.hourly.precipitation.map((_, i) => (i % 24 >= 2 && i % 24 <= 5 ? 0.6 : 0));
  const windy = f.parts[10]?.day; // the third day
  for (const p of f.parts) {
    p.tmin -= 14;
    p.tmax -= 14;
    const night = p.part === "night";
    if (night || p.part === "day") Object.assign(p, { symbol: "snow", precipitation: 2.4, rain_probability: 0.9 });
    else Object.assign(p, { precipitation: 0, rain_probability: 0.1 });
    if (p.day === windy) p.wind = 12;
  }
  return renderLayout("full", doc, opts);
};
const SHOTS = {
  "today-tomorrow": one("full", "CZ0100", { view: "today_tomorrow", place: "Praha" }),
  "next-24-hours": one("full", "CZ0100", { view: "next_24h", place: "Praha" }),
  "five-days": one("full", "CZ0100", { view: "five_days", place: "Praha" }),
  "today-tomorrow-cs": one("full", "CZ0642", { view: "today_tomorrow", place: "Brno", lang: "cs" }),
  "warnings-simulated": winter({ view: "five_days", place: "Praha (simulated winter)" }),
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
