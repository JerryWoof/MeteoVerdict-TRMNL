// Every layout and view renders from saved MeteoVerdict files, in both languages, at a
// few times of day, without Liquid errors or empty values.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { freezeTime, renderLayout } from "./render.mjs";

const PRAHA = JSON.parse(readFileSync(new URL("../test/fixtures/CZ0100.json", import.meta.url)));
const BRNO = JSON.parse(readFileSync(new URL("../test/fixtures/CZ0642.json", import.meta.url)));
const CASES = [
  ["full", "today_tomorrow"], ["full", "next_24h"], ["full", "five_days"],
  ["half_horizontal"], ["half_vertical"], ["quadrant"],
];
// the saved files are from 12 October 2026, 15:20 UTC
const TIMES = ["2026-10-12T15:40:00Z", "2026-10-12T21:30:00Z", "2026-10-13T04:10:00Z"];
const text = (html) => html.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

for (const time of TIMES) {
  for (const [layout, view] of CASES) {
    for (const lang of ["en", "cs"]) {
      test(`${layout} ${view ?? ""} ${lang} at ${time}`, async () => {
        freezeTime(time);
        const html = await renderLayout(layout, PRAHA, { view, lang, place: "Praha" });
        const words = text(html);
        assert.doesNotMatch(words, /Liquid error|NaN|undefined|Infinity|\{\{|\{%/);
        assert.doesNotMatch(html, /points=""|="NaN/);
        assert.match(words, /Praha/);
        assert.match(words, /\d+°/);
        if (lang === "cs") assert.match(words, /Dnes|Příštích|Předpověď/);
      });
    }
  }
}

test("the views show the forecast's numbers", async () => {
  freezeTime("2026-10-12T15:40:00Z");
  const words = text(await renderLayout("full", BRNO, { view: "today_tomorrow" }));
  const today = BRNO.forecast.parts.find((p) => p.day === "2026-10-12" && p.part === "day");
  assert.match(words, new RegExp(`${Math.round(today.tmax)}°`));
  assert.match(words, new RegExp(today.sunrise));
  assert.match(words, /Brno-město/); // no place name: the okres
});

test("a day the data does not have yet falls back to its first day", async () => {
  freezeTime("2026-10-11T12:00:00Z");
  const words = text(await renderLayout("full", PRAHA, { view: "today_tomorrow" }));
  assert.match(words, /Monday 12 October/);
});

test("next 24 hours says when the rain starts and stops", async () => {
  freezeTime("2026-10-12T15:40:00Z"); // 17:40 in Prague; the running hour is 15 UTC (index 15)
  const wet = structuredClone(PRAHA);
  const rain = (from, to) => wet.forecast.hourly.precipitation.map((_, i) => (i >= from && i <= to ? 1 : 0));
  wet.forecast.hourly.precipitation = rain(19, 22); // fell 18-22 UTC: from 20:00 Prague time
  assert.match(text(await renderLayout("full", wet, { view: "next_24h" })), /Rain from 20:00 4 mm/);
  wet.forecast.hourly.precipitation = rain(16, 18); // raining now, dry from 18 UTC: until 20:00
  assert.match(text(await renderLayout("full", wet, { view: "next_24h", lang: "cs" })), /Srážky do 20:00 3 mm/);
});
