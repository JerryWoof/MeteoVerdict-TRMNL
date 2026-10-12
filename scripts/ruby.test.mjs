// The same layouts rendered by Ruby Liquid (what TRMNL runs) and by liquidjs (what the
// other tests and the screenshots use) must say the same, apart from Ruby writing whole
// numbers from sums as "2.0". Skipped without Ruby and the liquid gem, except in CI.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { freezeTime, renderLayout } from "./render.mjs";

const ruby = spawnSync("ruby", ["-e", "require 'liquid'"], { encoding: "utf-8" });
const skip = ruby.status !== 0 && !process.env.CI ? "needs ruby and the liquid gem" : false;
const PRAHA = JSON.parse(readFileSync(new URL("../test/fixtures/CZ0100.json", import.meta.url)));
const dir = mkdtempSync(join(tmpdir(), "mv-ruby-"));
const text = (html) => html.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ")
  .replace(/(\d+)\.0(?!\d)/g, "$1").replace(/\s+/g, " ").trim();
const CASES = [
  ["full", { view: "today_tomorrow" }], ["full", { view: "next_24h" }], ["full", { view: "five_days" }],
  ["full", { view: "next_24h", lang: "cs", wind: "kmh" }], ["full", { view: "weekend" }], ["full", { view: "weekend", lang: "cs" }], ["half_horizontal", {}], ["half_vertical", { lang: "cs" }],
  ["quadrant", {}],
];

// the weekend view on Friday and Saturday, and on Sunday with the file moved a day later
const LATER = structuredClone(PRAHA);
const next = (iso) => new Date(new Date(iso).getTime() + 86400000).toISOString();
for (const p of LATER.forecast.parts) p.day = next(`${p.day}T00:00:00Z`).slice(0, 10);
LATER.forecast.hourly.time = LATER.forecast.hourly.time.map((t) => `${next(t).slice(0, 16)}Z`);
LATER.forecast.generated = `${next(LATER.forecast.generated).slice(0, 16)}+00:00`;
const WEEKEND = [["full", { view: "weekend" }], ["full", { view: "weekend", lang: "cs" }, LATER]];
for (const [now, cases] of [["2026-10-12T15:40:00Z", CASES], ["2026-10-12T20:10:00Z", CASES], ["2026-10-13T05:30:00Z", CASES],
  ["2026-10-16T09:00:00Z", WEEKEND], ["2026-10-17T09:00:00Z", WEEKEND], ["2026-10-18T09:00:00Z", WEEKEND.slice(1)]]) {
  for (const [layout, opts, data = PRAHA] of cases) {
    test(`ruby = liquidjs: ${layout} ${JSON.stringify(opts)}${data === PRAHA ? "" : " (a day later)"} at ${now}`, { skip }, async () => {
      const settings = { view: opts.view, language: opts.lang, wind_unit: opts.wind, place: "Praha" };
      const file = join(dir, "context.json");
      writeFileSync(file, JSON.stringify({ ...data, trmnl: { user: { utc_offset: 7200 }, plugin_settings: { custom_fields_values: settings } } }));
      const out = spawnSync("ruby", [new URL("render.rb", import.meta.url).pathname, layout, file, now], { encoding: "utf-8" });
      assert.equal(out.status, 0, out.stderr);
      freezeTime(now);
      const js = await renderLayout(layout, data, { ...opts, place: "Praha" });
      assert.equal(text(out.stdout), text(js));
    });
  }
}
