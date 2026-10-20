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
  // it starts tomorrow: the sentence says so, with the chance of the parts of day it falls in
  assert.match(text(await renderLayout("full", late, { view: "next_24h" })), /Rain from tomorrow 16:00 1\.5 mm · 23 % chance/);
});

test("rain in a day's last hour is drawn at the end of that day, not before the next", async () => {
  freezeTime("2026-10-12T15:40:00Z");
  // the hour 23–24 Prague time (CEST) ends at 22 UTC
  const late = variant((f) => hourly(f, "precipitation", (_, i) => (i === idx("2026-10-12T22:00:00Z") ? 2 : 0)));
  const html = await renderLayout("full", late, { view: "today_tomorrow" });
  // one chart over both days, 780 px, 16.25 px an hour: the bar of the hour 23–24 ends at
  // the midnight line (390 px), not after it
  const bars = [...html.matchAll(/<rect x="([-\d.]+)" y="([\d.]+)" width="([\d.]+)"/g)]
    .filter((m) => m[2] !== "0") // the night's rectangles start at the top
    .map((m) => [Number(m[1]), Number(m[3])]);
  assert.equal(bars.length, 1);
  const [[x, w]] = bars;
  assert.ok(x > 370 && x + w <= 390, `${x} + ${w}`);
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

test("frost and feels-like on a cold wet day, and no black-ice badge", async () => {
  freezeTime("2026-10-12T15:40:00Z");
  const cold = variant((f) => {
    hourly(f, "temperature_2m", (v) => v - 14);
    hourly(f, "wind_speed_10m", () => 8);
    hourly(f, "precipitation", (_, i) => (i === idx("2026-10-12T20:00:00Z") ? 0.4 : 0));
    for (const p of f.parts) { p.tmin -= 14; p.tmax -= 14; }
  });
  const words = text(await renderLayout("full", cold, { view: "next_24h" }));
  assert.doesNotMatch(words, /Black ice/);
  assert.match(words, /feels -\d+°/);
  assert.match(text(await renderLayout("full", cold, { view: "five_days" })), /Frost/);
});

test("frost badges follow MeteoVerdict's corrected night minimum when the data has it", async () => {
  freezeTime("2026-10-12T15:40:00Z");
  const withNights = (fields) => variant((f) => {
    for (const p of f.parts) Object.assign(p, p.part === "night" ? fields : { frost: null, ground_frost: null });
  });
  // the badges' words: air frost and ground frost are both just "Frost"
  const five = async (doc) => (await renderLayout("full", doc, { view: "five_days" })).match(/<span class="mv-badge">[^<]*<\/span>/g) ?? [];
  assert.ok((await five(withNights({ night_min: 0.6, frost: true, ground_frost: true }))).includes('<span class="mv-badge">Frost</span>'));
  assert.ok((await five(withNights({ night_min: 3.1, frost: false, ground_frost: true }))).includes('<span class="mv-badge">Frost</span>'));
  // the corrected minimum says no frost: a raw low of -1 ° no longer raises the badge
  const mild = withNights({ night_min: 1.8, frost: false, ground_frost: false });
  for (const p of mild.forecast.parts) p.tmin = -1;
  assert.equal((await five(mild)).length, 0);
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

// files of 20 October 2026 (20:12 UTC) from the new open data: the blend for Benešov, the
// AI's file for it, and the obec Miličín (605 m) in it
const fixture = (name) => JSON.parse(readFileSync(new URL(`../test/fixtures/2026-10-20-${name}.json`, import.meta.url)));
const BENESOV = fixture("CZ0201");
const BENESOV_AI = fixture("CZ0201-ai");
const MILICIN = fixture("CZ0201-milicin");
const NOW20 = "2026-10-20T10:00:00Z";

for (const [name, data] of [["blend", BENESOV], ["AI", BENESOV_AI], ["obec", { IDX_0: BENESOV, IDX_1: MILICIN }]]) {
  for (const [layout, view] of CASES) {
    for (const lang of ["en", "cs"]) {
      test(`${name}: ${layout} ${view ?? ""} ${lang}`, async () => {
        freezeTime(NOW20);
        const html = await renderLayout(layout, data, { view, lang });
        const words = text(html);
        assert.doesNotMatch(words, /Liquid error|NaN|undefined|Infinity|\{\{|\{%/);
        assert.doesNotMatch(html, /points=""|="NaN/);
        assert.match(words, /\d+°/);
      });
    }
  }
}

test("the footer names the forecast: the blend and its models, or the AI", async () => {
  freezeTime("2026-10-12T15:40:00Z");
  assert.match(text(await renderLayout("full", PRAHA, {})), /MeteoVerdict · 11 models · 17:20 $/);
  freezeTime(NOW20);
  const ai = text(await renderLayout("full", BENESOV_AI, {}));
  assert.match(ai, /MeteoVerdict AI · 22:12/);
  assert.doesNotMatch(ai, /CC BY-SA/);
  assert.doesNotMatch(ai, /models/);
  assert.match(text(await renderLayout("quadrant", BENESOV_AI, {})), /MeteoVerdict AI · 22:12/);
});

test("the ± of the high, from tomorrow on, only with the blend's range", async () => {
  freezeTime(NOW20);
  const blend = text(await renderLayout("full", BENESOV, { view: "five_days" }));
  assert.equal((blend.match(/° ±\d/g) ?? []).length, 4); // not today
  assert.match(text(await renderLayout("full", BENESOV, {})), /18° ±\d/);
  assert.doesNotMatch(text(await renderLayout("full", BENESOV_AI, { view: "five_days" })), /±/);
  assert.doesNotMatch(text(await renderLayout("full", PRAHA, { view: "five_days" })), /±/); // older file
});

test("threshold badges come from MeteoVerdict's flags", async () => {
  freezeTime(NOW20);
  const html5 = await renderLayout("full", BENESOV, { view: "five_days" });
  const five = text(html5);
  const badges = html5.match(/<span class="mv-badge">[^<]*<\/span>/g) ?? [];
  // heavy_rain on Wednesday and Thursday ("Rain"); ground frost the nights ending Friday and Sunday (beyond 5 days)
  assert.equal(badges.filter((b) => b.includes(">Rain<")).length, 2);
  assert.equal(badges.filter((b) => b.includes(">Frost<")).length, 1);
  assert.doesNotMatch(five, /ČHMÚ/);
  assert.match(text(await renderLayout("full", BENESOV, { view: "five_days", lang: "cs" })), /Déšť.*Mráz/);
  // a gust over the threshold, shown in the wind unit
  const gusty = structuredClone(BENESOV);
  for (const p of gusty.forecast.parts) Object.assign(p, { heavy_rain: false, ground_frost: false, gust_over_threshold: p.day === "2026-10-22", gust: p.day === "2026-10-22" ? 16.2 : 5 });
  const g = text(await renderLayout("full", gusty, { view: "five_days", wind: "kmh" }));
  assert.match(g, /Gusts 58 km\/h/);
  assert.doesNotMatch(g, /Strong wind/);
  const calm = structuredClone(gusty);
  for (const p of calm.forecast.parts) p.gust_over_threshold = false;
  assert.doesNotMatch(text(await renderLayout("full", calm, { view: "five_days" })), /Gusts/);
});

test("an obec: its name, its temperatures and rain, the okres's sky", async () => {
  freezeTime(NOW20);
  const both = { IDX_0: BENESOV, IDX_1: MILICIN };
  const words = text(await renderLayout("full", both, {}));
  const day = (doc, d) => doc.find((p) => p.day === d && p.part === "day");
  assert.match(words, /^ ?Today/);
  assert.match(words, new RegExp(`${Math.round(day(MILICIN.parts, "2026-10-20").tmax)}°`));
  assert.match(words, /Miličín MeteoVerdict/);
  assert.doesNotMatch(words, /test/);
  assert.notEqual(Math.round(day(MILICIN.parts, "2026-10-21").tmax), Math.round(day(BENESOV.forecast.parts, "2026-10-21").tmax));
  assert.match(words, new RegExp(`Tomorrow .*${Math.round(day(MILICIN.parts, "2026-10-21").tmax)}°`));
  // the place name setting still wins
  assert.match(text(await renderLayout("full", both, { place: "Chata" })), /Chata MeteoVerdict/);
  // an obec file that does not fit the okres file's hours is left out
  const short = structuredClone(MILICIN);
  short.hourly.temperature_2m = short.hourly.temperature_2m.slice(0, 100);
  const okres = text(await renderLayout("full", { IDX_0: BENESOV, IDX_1: short }, {}));
  assert.doesNotMatch(okres, /Miličín/);
  assert.match(okres, /Benešov/);
});

test("a day's high and low span its parts (the AI's whole day can cover fewer hours)", async () => {
  freezeTime(NOW20);
  const ai = structuredClone(BENESOV_AI);
  const rows = ai.forecast.parts.filter((p) => p.day === "2026-10-20");
  const day = rows.find((p) => p.part === "day");
  const pm = rows.find((p) => p.part === "afternoon");
  Object.assign(day, { tmax: 11.2, tmin: 7 });
  Object.assign(pm, { tmax: 15.6 });
  const words = text(await renderLayout("full", ai, {}));
  assert.match(words, /^ ?Today \S+ \d+ October 16°/);
  assert.match(words, new RegExp(`low ${Math.round(Math.min(...rows.filter((p) => p.part !== "day").map((p) => p.tmin)))}°`));
});

test("an obec file from the AI says MeteoVerdict AI, whatever the okres file", async () => {
  freezeTime(NOW20);
  const words = text(await renderLayout("full", { IDX_0: BENESOV, IDX_1: { ...MILICIN, model: "ai" } }, {}));
  assert.match(words, /MeteoVerdict AI · 22:12/);
  assert.match(text(await renderLayout("full", { IDX_0: BENESOV_AI, IDX_1: MILICIN }, {})), /MeteoVerdict AI/);
});
