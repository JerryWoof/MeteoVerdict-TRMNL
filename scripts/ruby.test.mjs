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
  ["full", { view: "today_tomorrow" }], ["full", { view: "next_24h" }], ["full", { view: "next_48h", lang: "cs" }], ["full", { view: "five_days" }],
  ["full", { view: "next_24h", lang: "cs", wind: "kmh" }], ["full", { view: "five_days", lang: "cs" }],
];

// the older file (with its `models` block) at a few times of day
for (const now of ["2026-10-12T10:00:00Z", "2026-10-12T17:30:00Z"]) {
  for (const [layout, opts] of CASES) {
    test(`ruby = liquidjs: ${layout} ${JSON.stringify(opts)} at ${now}`, { skip }, async () => {
      const settings = { view: opts.view, language: opts.lang, wind_unit: opts.wind, place: "Praha" };
      const file = join(dir, "context.json");
      writeFileSync(file, JSON.stringify({ ...PRAHA, trmnl: { user: { utc_offset: 7200 }, plugin_settings: { custom_fields_values: settings } } }));
      const out = spawnSync("ruby", [new URL("render.rb", import.meta.url).pathname, layout, file, now], { encoding: "utf-8" });
      assert.equal(out.status, 0, out.stderr);
      freezeTime(now);
      const js = await renderLayout(layout, PRAHA, { ...opts, place: "Praha" });
      assert.equal(text(out.stdout), text(js));
    });
  }
}

// the new open data of 23 October: the blend, the AI's file and an obec over two polling URLs
const fixture = (name) => JSON.parse(readFileSync(new URL(`../test/fixtures/2026-10-23-${name}.json`, import.meta.url)));
const NEW = [["blend", fixture("CZ0201")], ["AI", fixture("CZ0201-ai")], ["obec", { IDX_0: fixture("CZ0201-ai"), IDX_1: fixture("CZ0201-milicin-ai") }]];
for (const now of ["2026-10-24T10:00:00Z", "2026-10-24T20:30:00Z"]) {
  for (const [name, data] of NEW) {
    for (const [layout, opts] of CASES) {
      test(`ruby = liquidjs: ${name} ${layout} ${JSON.stringify(opts)} at ${now}`, { skip }, async () => {
        const settings = { view: opts.view, language: opts.lang, wind_unit: opts.wind };
        const file = join(dir, "context.json");
        writeFileSync(file, JSON.stringify({ ...data, trmnl: { user: { utc_offset: 7200 }, plugin_settings: { custom_fields_values: settings } } }));
        const out = spawnSync("ruby", [new URL("render.rb", import.meta.url).pathname, layout, file, now], { encoding: "utf-8" });
        assert.equal(out.status, 0, out.stderr);
        freezeTime(now);
        assert.equal(text(out.stdout), text(await renderLayout(layout, data, opts)));
      });
    }
  }
}
