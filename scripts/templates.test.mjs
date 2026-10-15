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
  ["full", "today_tomorrow"], ["full", "next_24h"], ["full", "five_days"], ["full", "weekend"],
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
        if (lang === "cs") assert.match(words, /Dnes|Zítra|Příštích|Předpověď|sobota|neděle/);
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

test("rain in a day's last hour is drawn at the end of that day, not before the next", async () => {
  freezeTime("2026-10-12T15:40:00Z");
  // the hour 23–24 Prague time (CEST) ends at 22 UTC
  const late = variant((f) => hourly(f, "precipitation", (_, i) => (i === idx("2026-10-12T22:00:00Z") ? 2 : 0)));
  const html = await renderLayout("full", late, { view: "today_tomorrow" });
  const bars = [...html.matchAll(/<rect x="([-\d.]+)" y="[\d.]+" width="7"/g)].map((m) => Number(m[1]));
  assert.deepEqual(bars, [231.5]);
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

// the saved Prague file a day later: 13 to 18 October, so it has the whole weekend
const later = variant((f) => {
  const next = (iso) => new Date(new Date(iso).getTime() + 86400000).toISOString();
  for (const p of f.parts) p.day = next(`${p.day}T00:00:00Z`).slice(0, 10);
  f.hourly.time = f.hourly.time.map((t) => `${next(t).slice(0, 16)}Z`);
  f.generated = `${next(f.generated).slice(0, 16)}+00:00`;
});

test("weekend: on a weekday the coming Saturday and Sunday", async () => {
  freezeTime("2026-10-14T10:00:00Z"); // Wednesday
  const words = text(await renderLayout("full", later, { view: "weekend" }));
  assert.match(words, /Saturday 17 October .* Sunday 18 October/);
  assert.doesNotMatch(words, /beyond the forecast|Today|Wednesday/);
  const sunday = later.forecast.parts.find((p) => p.day === "2026-10-18" && p.part === "day");
  assert.match(words, new RegExp(`Sunday 18 October .*${Math.round(sunday.tmax)}°`));
});

test("weekend: on Saturday this weekend, on Sunday Sunday and Monday", async () => {
  freezeTime("2026-10-17T10:00:00Z");
  const sat = text(await renderLayout("full", later, { view: "weekend", lang: "cs" }));
  assert.match(sat, /sobota 17\. října .* neděle 18\. října/);
  assert.doesNotMatch(sat, /mimo předpověď/);
  freezeTime("2026-10-18T10:00:00Z");
  const sun = text(await renderLayout("full", later, { view: "weekend" }));
  assert.match(sun, /Sunday 18 October .* Monday 19 October Monday is beyond the forecast/);
  assert.doesNotMatch(sun, /Saturday/);
});

// the saved Prague file moved `n` days later; `extra` more days copied from its last day
const shifted = (n, extra = 0) => variant((f) => {
  const move = (iso, k) => new Date(new Date(iso).getTime() + k * 86400000).toISOString();
  const last = f.parts.at(-1).day;
  const lastParts = f.parts.filter((p) => p.day === last);
  const lastHours = f.hourly.time.length - 24;
  for (let k = 1; k <= extra; k += 1) {
    for (const p of lastParts) f.parts.push({ ...p, day: move(`${last}T00:00:00Z`, k).slice(0, 10) });
    for (const name of Object.keys(f.hourly)) {
      const tail = f.hourly[name].slice(lastHours, lastHours + 24);
      f.hourly[name].push(...(name === "time" ? tail.map((t) => `${move(t, k).slice(0, 16)}Z`) : tail));
    }
  }
  for (const p of f.parts) p.day = move(`${p.day}T00:00:00Z`, n).slice(0, 10);
  f.hourly.time = f.hourly.time.map((t) => `${move(t, n).slice(0, 16)}Z`);
  f.generated = `${move(f.generated, n).slice(0, 16)}+00:00`;
});

test("weekend: on Saturday evening Sunday and Monday", async () => {
  freezeTime("2026-10-17T17:30:00Z"); // Saturday 19:30 in Prague
  const words = text(await renderLayout("full", later, { view: "weekend" }));
  assert.match(words, /Sunday 18 October .* Monday 19 October Monday is beyond the forecast/);
  assert.doesNotMatch(words, /Saturday/);
  const cs = text(await renderLayout("full", later, { view: "weekend", lang: "cs" }));
  assert.match(cs, /neděle 18\. října .* pondělí 19\. října Pondělí je mimo předpověď/);
});

test("weekend: on Sunday evening the next weekend", async () => {
  freezeTime("2026-10-18T17:30:00Z"); // Sunday 19:30 in Prague
  // a forecast from Sunday reaches Friday: the next weekend is all beyond it, so a note
  // and the next two days from tomorrow
  const sunday = shifted(6);
  const en = text(await renderLayout("full", sunday, { view: "weekend" }));
  assert.match(en, /^ ?Weekend not in the forecast yet Monday 19 October .* Tuesday 20 October/);
  assert.doesNotMatch(en, /beyond the forecast|Sunday|Today|Tomorrow/);
  const cs = text(await renderLayout("full", sunday, { view: "weekend", lang: "cs" }));
  assert.match(cs, /Víkend zatím mimo předpověď pondělí 19\. října .* úterý 20\. října/);
  // one more day of data: Saturday, and a note for Sunday
  const words = text(await renderLayout("full", shifted(6, 1), { view: "weekend" }));
  assert.match(words, /Saturday 24 October .* Sunday 25 October Sunday is beyond the forecast/);
  assert.doesNotMatch(words, /18 October|Monday/);
});

test("weekend: with the evening switch off, the evening is like the day", async () => {
  freezeTime("2026-10-17T17:30:00Z"); // Saturday 19:30
  const sat = text(await renderLayout("full", later, { view: "weekend", evening: false }));
  assert.match(sat, /Saturday 17 October .* Sunday 18 October/);
  freezeTime("2026-10-18T17:30:00Z"); // Sunday 19:30
  const sun = text(await renderLayout("full", shifted(6, 1), { view: "weekend", evening: false }));
  assert.match(sun, /Sunday 18 October .* Monday 19 October/);
  freezeTime("2026-10-17T15:30:00Z"); // Saturday 17:30, before the switch
  assert.match(text(await renderLayout("full", later, { view: "weekend" })), /Saturday 17 October .* Sunday 18 October/);
});

test("weekend: a day beyond the forecast gets a note; no weekend at all, the next days", async () => {
  freezeTime("2026-10-12T10:00:00Z"); // Monday: the data ends on Saturday
  const words = text(await renderLayout("full", PRAHA, { view: "weekend" }));
  assert.match(words, /Saturday 17 October .* Sunday 18 October Sunday is beyond the forecast/);
  assert.match(text(await renderLayout("full", PRAHA, { view: "weekend", lang: "cs" })), /Neděle je mimo předpověď/);
  const short = variant((f) => { f.parts = f.parts.filter((p) => p.day < "2026-10-17"); });
  const none = text(await renderLayout("full", short, { view: "weekend" }));
  assert.match(none, /Weekend not in the forecast yet Monday 12 October .* Tuesday 13 October/);
  assert.doesNotMatch(none, /Saturday|beyond the forecast/);
  freezeTime("2026-10-12T17:30:00Z"); // 19:30: from tomorrow, unless the switch is off
  assert.match(text(await renderLayout("full", short, { view: "weekend" })), /Weekend not in the forecast yet Tuesday 13 October .* Wednesday 14 October/);
  assert.match(text(await renderLayout("full", short, { view: "weekend", evening: false })), /Weekend not in the forecast yet Monday 12 October .* Tuesday 13 October/);
});

test("daylight says how much shorter it is than the day before", async () => {
  freezeTime("2026-10-12T10:00:00Z");
  const words = text(await renderLayout("full", PRAHA, {}));
  // 12 Oct: 07:19–18:17 (no 11 Oct in the data); 13 Oct: 07:20–18:15, 3 minutes shorter
  assert.match(words, /of 10 h 58 min Clouds/);
  assert.match(words, /of 10 h 55 min \(−3\)/);
  const longer = variant((f) => { for (const p of f.parts) if (p.day === "2026-10-13") p.sunset = "18:20"; });
  assert.match(text(await renderLayout("full", longer, { lang: "cs" })), /z 11 h 0 min \(\+2\)/);
});

test("the half and quarter layouts show the day-length change too", async () => {
  freezeTime("2026-10-13T10:00:00Z"); // 13 Oct: 3 minutes shorter than the 12th
  assert.match(text(await renderLayout("half_vertical", PRAHA, {})), /Sunshine [\d.]+ h 10 h 55 min \(−3\)/);
  assert.match(text(await renderLayout("half_vertical", PRAHA, { lang: "cs" })), /Slunce [\d,]+ h 10 h 55 min \(−3\)/);
  for (const layout of ["half_horizontal", "quadrant"]) {
    assert.match(text(await renderLayout(layout, PRAHA, {})), /07:20 18:15 \(−3\)/);
  }
  freezeTime("2026-10-12T10:00:00Z"); // no 11 Oct in the data: daylight without a change
  assert.match(text(await renderLayout("half_vertical", PRAHA, {})), /10 h 58 min Clouds/);
  for (const layout of ["half_horizontal", "quadrant"]) {
    assert.doesNotMatch(text(await renderLayout(layout, PRAHA, {})), /18:17 \(/);
  }
});

test("Czech time follows summer time, hour by hour", async () => {
  const template = `${inline("shared")}{% for e0 in stamps %}{% assign e = e0 %}${inline("partials/local")}{{ le | date: "%H:%M" }} {% endfor %}`;
  const stamps = ["2026-10-25T00:30:00Z", "2026-10-25T01:30:00Z", "2026-03-29T00:30:00Z", "2026-03-29T01:30:00Z"]
    .map((iso) => new Date(iso).getTime() / 1000);
  freezeTime("2026-10-24T12:00:00Z");
  const html = await new Liquid({ timezoneOffset: 0 }).parseAndRender(template, { ...PRAHA, stamps });
  assert.match(text(html), /02:30 02:30 01:30 03:30\s*$/);
});
