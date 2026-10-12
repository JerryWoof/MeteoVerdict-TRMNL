// Renders a layout the way TRMNL does (liquidjs instead of Ruby Liquid) into an HTML page
// at the device's size, with TRMNL's framework CSS.
//   node scripts/render.mjs out.html [--layout full] [--view next_24h] [--okres CZ0100]
//     [--place Praha] [--lang cs] [--data file.json] [--now 2026-10-12T15:30:00Z]
//     [--offset 7200] [--mashup "half_horizontal:CZ0100,half_horizontal:CZ0642"]
// --data: a saved okres file instead of the live one; --now: pretend it is that time.
// TRMNL renders on UTC servers; liquidjs's epoch seconds ("%s") follow the machine's time
// zone, so render in UTC too or every time is off by your UTC offset.
process.env.TZ = "UTC";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Liquid } from "liquidjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://jerrywoof.github.io/MeteoVerdict/api/v1/okresy";
export const SIZES = { full: [800, 480], half_horizontal: [800, 240], half_vertical: [400, 480], quadrant: [400, 240] };
const MASHUPS = { "half_horizontal,half_horizontal": "1Tx1B", "half_vertical,half_vertical": "1Lx1R", "quadrant,quadrant,quadrant,quadrant": "2x2" };

export function freezeTime(iso) {
  const fixed = new Date(iso).getTime();
  const Real = Date;
  globalThis.Date = class extends Real {
    constructor(...args) { super(...(args.length ? args : [fixed])); }
    static now() { return fixed; }
  };
}

export async function load({ okres = "CZ0100", data } = {}) {
  if (data) return JSON.parse(readFileSync(data, "utf-8"));
  return (await fetch(`${API}/${okres}.json`)).json();
}

export async function renderLayout(layout, json, { view, place, lang, offset = 7200, evening, wind } = {}) {
  const template = readFileSync(join(root, "dist", `${layout}.liquid`), "utf-8");
  const settings = { custom_fields_values: { view, place, language: lang, evening_switch: evening, wind_unit: wind } };
  return new Liquid({ timezoneOffset: 0 }).parseAndRender(template, {
    ...json,
    trmnl: { user: { utc_offset: offset }, plugin_settings: settings },
  });
}

export function page(body, [w, h] = SIZES.full) {
  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://usetrmnl.com/css/latest/plugins.css">
<script src="https://usetrmnl.com/js/latest/plugins.js"></script>
<style>html,body{margin:0;background:#fff}.screen{width:${w}px;height:${h}px;overflow:hidden;background:#fff}</style>
</head><body class="environment trmnl"><div class="screen">${body}</div></body></html>`;
}

function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith("--")) out[argv[i].slice(2)] = argv[(i += 1)];
    else out._.push(argv[i]);
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const a = args(process.argv.slice(2));
  if (a.now) freezeTime(a.now);
  const opts = { view: a.view, place: a.place, lang: a.lang, offset: Number(a.offset ?? 7200), evening: a.evening, wind: a.wind };
  let html;
  if (a.mashup) {
    const slots = a.mashup.split(",").map((s) => s.split(":"));
    const kind = MASHUPS[slots.map(([l]) => l).join(",")];
    if (!kind) throw new Error(`no mashup for ${a.mashup}`);
    const views = [];
    for (const [layout, okres, place] of slots) views.push(await renderLayout(layout, await load({ okres }), { ...opts, place }));
    html = page(`<div class="mashup mashup--${kind}">${views.join("")}</div>`);
  } else {
    const layout = a.layout ?? "full";
    html = page(await renderLayout(layout, await load(a), opts), SIZES[layout]);
  }
  writeFileSync(a._[0] ?? "preview.html", html);
}
