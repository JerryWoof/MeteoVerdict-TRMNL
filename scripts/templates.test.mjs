// Every layout and view renders from saved MeteoVerdict files, in both languages, at a
// few times of day, without Liquid errors or empty values.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { Liquid } from "liquidjs";

import { inline } from "./build.mjs";
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
        if (lang === "cs") assert.match(words, /Dnes|Zítra|Příštích|Předpověď/);
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

// variations of the saved Prague file
const variant = (change) => {
  const doc = structuredClone(PRAHA);
  change(doc.forecast);
  return doc;
};
const hourly = (doc, name, f) => { doc.hourly[name] = doc.hourly[name].map(f); };
const T = (iso) => new Date(iso).getTime(); // hour index from the file's first hour (00 UTC 12 Oct)
const idx = (iso) => (T(iso) - T("2026-10-12T00:00:00Z")) / 3600000;

test("drizzle is rain too: no 'dry' next to millimetres", async () => {
  freezeTime("2026-10-12T15:40:00Z");
  const wet = variant((f) => hourly(f, "precipitation", () => 0.15));
  const words = text(await renderLayout("full", wet, { view: "next_24h" }));
  assert.doesNotMatch(words, /Dry for the next 24 hours/);
  assert.match(words, /Rain all day 3\.6 mm/);
});

test("rain in the 24th hour still counts", async () => {
  freezeTime("2026-10-12T15:40:00Z"); // hour 15 UTC runs; the window ends at 15 UTC tomorrow
  const late = variant((f) => hourly(f, "precipitation", (_, i) => (i === 15 + 24 ? 1.5 : 0)));
  assert.match(text(await renderLayout("full", late, { view: "next_24h" })), /Rain from 16:00 1\.5 mm/);
});

test("missing values show a dash, not 0°", async () => {
  freezeTime("2026-10-12T15:40:00Z");
  const gaps = variant((f) => hourly(f, "temperature_2m", (v, i) => (i >= 15 && i <= 20 ? null : v)));
  const words = text(await renderLayout("full", gaps, { view: "next_24h" }));
  assert.match(words, /Now · 17:40 –/);
  assert.match(words, /18 –/);
});

test("an old forecast says so, and one with nothing left for today says that instead", async () => {
  freezeTime("2026-10-14T09:00:00Z"); // 42 hours after it was made
  assert.match(text(await renderLayout("quadrant", PRAHA, {})), /old forecast 12 Oct 17:20/);
  freezeTime("2026-10-19T09:00:00Z"); // after its last day
  const words = text(await renderLayout("full", PRAHA, {}));
  assert.match(words, /No forecast for today yet\. The latest is from 12\.10\. 17:20/);
  assert.doesNotMatch(words, /Monday 12 October/);
});

test("on the last day there is no tomorrow", async () => {
  freezeTime("2026-10-17T09:00:00Z");
  for (const layout of ["quadrant", "half_vertical"]) {
    assert.doesNotMatch(text(await renderLayout(layout, PRAHA, {})), /Tomorrow/);
  }
});

test("in the evening the day layouts move on to tomorrow, unless switched off", async () => {
  freezeTime("2026-10-12T19:30:00Z"); // 21:30 in Prague
  const on = text(await renderLayout("full", PRAHA, {}));
  assert.match(on, /Tomorrow Tuesday 13 October/);
  assert.match(on, /Wednesday 14 Oct/);
  const off = text(await renderLayout("full", PRAHA, { evening: false }));
  assert.match(off, /Today Monday 12 October/);
});

test("wind in km/h", async () => {
  freezeTime("2026-10-12T15:40:00Z");
  const today = PRAHA.forecast.parts.find((p) => p.day === "2026-10-12" && p.part === "day");
  const words = text(await renderLayout("full", PRAHA, { wind: "kmh" }));
  assert.match(words, new RegExp(`${Math.round(today.wind * 3.6)} km/h`));
});

test("frost, black ice and feels-like on a cold wet day", async () => {
  freezeTime("2026-10-12T15:40:00Z");
  const cold = variant((f) => {
    hourly(f, "temperature_2m", (v) => v - 14);
    hourly(f, "wind_speed_10m", () => 8);
    hourly(f, "precipitation", (_, i) => (i === idx("2026-10-12T20:00:00Z") ? 0.4 : 0));
    for (const p of f.parts) { p.tmin -= 14; p.tmax -= 14; }
  });
  const words = text(await renderLayout("full", cold, { view: "next_24h" }));
  assert.match(words, /Black ice/);
  assert.match(words, /feels -\d+°/);
  assert.match(text(await renderLayout("full", cold, { view: "five_days" })), /Frost -\d+°/);
});

test("the best two hours outside are in daylight and dry", async () => {
  freezeTime("2026-10-12T05:00:00Z"); // 07:00 in Prague
  const words = text(await renderLayout("full", PRAHA, { view: "next_24h" }));
  const [, from, to] = words.match(/Best outside (\d\d)–(\d\d) h/);
  assert.equal(Number(to) - Number(from), 2);
  assert.ok(Number(from) >= 7 && Number(to) <= 18, `${from}–${to}`);
  freezeTime("2026-10-12T10:00:00Z"); // noon: tomorrow morning is sunnier than this afternoon
  assert.match(text(await renderLayout("full", PRAHA, { view: "next_24h" })), /Best outside tomorrow 10–12 h/);
});

test("the second day says how much warmer or colder", async () => {
  freezeTime("2026-10-12T08:00:00Z");
  const warm = variant((f) => { for (const p of f.parts) if (p.day === "2026-10-13") p.tmax += 6; });
  assert.match(text(await renderLayout("full", warm, {})), /\d+° warmer/);
  assert.match(text(await renderLayout("full", warm, { lang: "cs" })), /o \d+° tepleji/);
});

test("Czech time follows summer time, hour by hour", async () => {
  const template = `${inline("shared")}{% for e0 in stamps %}{% assign e = e0 %}${inline("partials/local")}{{ le | date: "%H:%M" }} {% endfor %}`;
  const stamps = ["2026-10-25T00:30:00Z", "2026-10-25T01:30:00Z", "2026-03-29T00:30:00Z", "2026-03-29T01:30:00Z"]
    .map((iso) => new Date(iso).getTime() / 1000);
  freezeTime("2026-10-24T12:00:00Z");
  const html = await new Liquid({ timezoneOffset: 0 }).parseAndRender(template, { ...PRAHA, stamps });
  assert.match(text(html), /02:30 02:30 01:30 03:30\s*$/);
});
