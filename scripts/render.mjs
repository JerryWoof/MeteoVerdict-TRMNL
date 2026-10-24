// Renders a layout the way TRMNL does (liquidjs instead of Ruby Liquid) into an HTML page
// at the device's size, with TRMNL's framework CSS and its view wrapper.
//   node scripts/render.mjs out.html [--layout full] [--view next_24h | next_48h | five_days] [--okres CZ0100]
//     [--place Praha] [--lang cs] [--data file.json] [--now 2026-10-12T15:30:00Z]
//     [--device og | x] [--offset 7200] [--ai 1] [--obec CZ0525/spindleruv-mlyn]
// --data: a saved okres file instead of the live one; --now: pretend it is that time.
// TRMNL renders on UTC servers; liquidjs's epoch seconds ("%s") follow the machine's time
// zone, so render in UTC too or every time is off by your UTC offset.
process.env.TZ = "UTC";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Liquid } from "liquidjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://meteoverdict.cz/api/v1/okresy";
// the screens in CSS pixels, and the classes TRMNL gives them: the original (800 x 480, 1 bit) and TRMNL X (1872 x 1404, 4 bit)
export const SIZES = { full: [800, 480] };
export const DEVICES = { og: { size: [800, 480], classes: "screen--og screen--md screen--1bit" }, x: { size: [1872, 1404], classes: "screen--v2 screen--lg screen--density-2x screen--4bit" } };

export function freezeTime(iso) {
  const fixed = new Date(iso).getTime();
  const Real = Date;
  globalThis.Date = class extends Real {
    constructor(...args) { super(...(args.length ? args : [fixed])); }
    static now() { return fixed; }
  };
}

// `ai`: the AI's okres file (api/v1/ai/okresy) instead of the blend's; `obec` ("CZ0525/spindleruv-mlyn"):
// polled as a second URL, so the layouts get IDX_0 (the okres file) and IDX_1 (the obec's)
export async function load({ okres = "CZ0100", data, ai, obec } = {}) {
  if (data) return JSON.parse(readFileSync(data, "utf-8"));
  const get = async (url) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    return res.json();
  };
  const doc = await get(`${API.replace("/okresy", ai ? "/ai/okresy" : "/okresy")}/${okres}.json`);
  return obec ? { IDX_0: doc, IDX_1: await get(`${API.replace("/okresy", ai ? "/ai/obce" : "/obce")}/${obec}.json`) } : doc;
}

export async function renderLayout(layout, json, { view, place, lang, offset = 7200, evening, wind } = {}) {
  const template = readFileSync(join(root, "dist", `${layout}.liquid`), "utf-8");
  const settings = { custom_fields_values: { view, place, language: lang, evening_switch: evening, wind_unit: wind } };
  const body = await new Liquid({ timezoneOffset: 0 }).parseAndRender(template, {
    ...json,
    trmnl: { user: { utc_offset: offset }, plugin_settings: settings },
  });
  // TRMNL wraps each layout's markup in its view element, so the templates leave it out.
  return `<div class="view view--${layout}">${body}</div>`;
}

export function page(body, [w, h] = SIZES.full, device = "og") {
  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://usetrmnl.com/css/latest/plugins.css">
<script src="https://usetrmnl.com/js/latest/plugins.js"></script>
<style>html,body{margin:0;background:#fff}.screen{width:${w}px;height:${h}px;overflow:hidden;background:#fff}</style>
</head><body class="environment trmnl"><div class="screen ${DEVICES[device].classes}">${body}</div></body></html>`;
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
  const layout = a.layout ?? "full";
  const device = a.device ?? "og";
  const html = page(await renderLayout(layout, await load({ ...a, okres: a.okres ?? (a.obec ? a.obec.split("/")[0] : undefined) }), opts), DEVICES[device].size, device);
  writeFileSync(a._[0] ?? "preview.html", html);
}
