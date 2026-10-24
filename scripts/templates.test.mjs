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
const CASES = [["full", "today_tomorrow"], ["full", "next_24h"], ["full", "next_48h"], ["full", "five_days"]];
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
  assert.match(words, /Mon 12 Oct/);
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
  // the chart comes twice, in two heights (the taller one for TRMNL X): look at the first
  const bars = [...html.split('<div class="mvx1">')[0].matchAll(/<rect x="([-\d.]+)" y="([\d.]+)" width="([\d.]+)"/g)]
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
  assert.match(words, /→ [A-Za-z]+ \d+ \w+ Now: –/);
  assert.match(words, /18 –/);
});

test("an old forecast says so, and one with nothing left for today says that instead", async () => {
  freezeTime("2026-10-14T09:00:00Z"); // 42 hours after it was made
  assert.match(text(await renderLayout("full", PRAHA, {})), /old forecast updated 12 Oct 17:20/);
  freezeTime("2026-10-19T09:00:00Z"); // after its last day
  const words = text(await renderLayout("full", PRAHA, {}));
  assert.match(words, /No forecast for today yet\. The latest is from 12\.10\. 17:20/);
  assert.doesNotMatch(words, /Mon 12 Oct/);
});

test("on the last day there is no tomorrow", async () => {
  freezeTime("2026-10-17T09:00:00Z");
  assert.doesNotMatch(text(await renderLayout("full", PRAHA, {})), /Tomorrow/);
});

test("in the evening the day layouts move on to tomorrow, unless switched off", async () => {
  freezeTime("2026-10-12T19:30:00Z"); // 21:30 in Prague
  const on = text(await renderLayout("full", PRAHA, {}));
  assert.match(on, /Tomorrow Tue 13 Oct/);
  assert.match(on, /Wed 14 Oct/);
  const off = text(await renderLayout("full", PRAHA, { evening: false }));
  assert.match(off, /Today Mon 12 Oct/);
});

test("wind in km/h", async () => {
  freezeTime("2026-10-12T15:40:00Z");
  const today = PRAHA.forecast.parts.find((p) => p.day === "2026-10-12" && p.part === "day");
  const words = text(await renderLayout("full", PRAHA, { wind: "kmh" }));
  assert.match(words, new RegExp(`${Math.round(today.wind * 3.6)} km/h`));
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

test("daylight says how much shorter it is than the day before", async () => {
  freezeTime("2026-10-12T10:00:00Z");
  const words = text(await renderLayout("full", PRAHA, {}));
  // 12 Oct: 07:19–18:17 (no 11 Oct in the data); 13 Oct: 07:20–18:15, 3 minutes shorter
  assert.match(words, /of 10 h 58 min Clouds/);
  assert.match(words, /of 10 h 55 min \(−3\)/);
  const longer = variant((f) => { for (const p of f.parts) if (p.day === "2026-10-13") p.sunset = "18:20"; });
  assert.match(text(await renderLayout("full", longer, { lang: "cs" })), /z 11 h 0 min \(\+2\)/);
});

test("Czech time follows summer time, hour by hour", async () => {
  const template = `${inline("shared")}{% for e0 in stamps %}{% assign e = e0 %}${inline("partials/local")}{{ le | date: "%H:%M" }} {% endfor %}`;
  const stamps = ["2026-10-25T00:30:00Z", "2026-10-25T01:30:00Z", "2026-03-29T00:30:00Z", "2026-03-29T01:30:00Z"]
    .map((iso) => new Date(iso).getTime() / 1000);
  freezeTime("2026-10-24T12:00:00Z");
  const html = await new Liquid({ timezoneOffset: 0 }).parseAndRender(template, { ...PRAHA, stamps });
  assert.match(text(html), /02:30 02:30 01:30 03:30\s*$/);
});

// files of 23 October 2026 (17:30 UTC) from the new open data: the blend for Benešov, the
// AI's file for it, and the obec Miličín (605 m) in it
const fixture = (name) => JSON.parse(readFileSync(new URL(`../test/fixtures/2026-10-23-${name}.json`, import.meta.url)));
const BENESOV = fixture("CZ0201");
const BENESOV_AI = fixture("CZ0201-ai");
const MILICIN = fixture("CZ0201-milicin");
const NOW_NEW = "2026-10-24T10:00:00Z";

for (const [name, data] of [["blend", BENESOV], ["AI", BENESOV_AI], ["obec", { IDX_0: BENESOV, IDX_1: MILICIN }]]) {
  for (const [layout, view] of CASES) {
    for (const lang of ["en", "cs"]) {
      test(`${name}: ${layout} ${view ?? ""} ${lang}`, async () => {
        freezeTime(NOW_NEW);
        const html = await renderLayout(layout, data, { view, lang });
        const words = text(html);
        assert.doesNotMatch(words, /Liquid error|NaN|undefined|Infinity|\{\{|\{%/);
        assert.doesNotMatch(html, /points=""|="NaN/);
        assert.match(words, /\d+°/);
      });
    }
  }
}

test("the footer names the forecast: the blend or the AI", async () => {
  freezeTime("2026-10-12T15:40:00Z");
  assert.match(text(await renderLayout("full", PRAHA, {})), /MeteoVerdict · 17:40 $/);
  freezeTime(NOW_NEW);
  const ai = text(await renderLayout("full", BENESOV_AI, {}));
  assert.match(ai, /MeteoVerdict AI · 12:00/);
  assert.doesNotMatch(ai, /CC BY-SA/);
  assert.doesNotMatch(ai, /models/);
  // the blend's file has no `models` block since 23 October (an older file still has one: ignored)
  const blend = text(await renderLayout("full", BENESOV, {}));
  assert.match(blend, /MeteoVerdict · 12:00 $/);
  assert.doesNotMatch(blend, /models|undefined/);
});

test("the ± of the high, from tomorrow on, with the 80 % range (the blend's and, since 23 October, the AI's)", async () => {
  freezeTime(NOW_NEW);
  const blend = text(await renderLayout("full", BENESOV, { view: "five_days" }));
  assert.equal((blend.match(/° ±\d/g) ?? []).length, 4); // not today
  assert.match(text(await renderLayout("full", BENESOV, {})), /9° ±2/);
  assert.equal((text(await renderLayout("full", BENESOV_AI, { view: "five_days" })).match(/° ±\d/g) ?? []).length, 4);
  const noRange = structuredClone(BENESOV_AI);
  delete noRange.forecast.hourly.temperature_2m_lo;
  delete noRange.forecast.hourly.temperature_2m_hi;
  assert.doesNotMatch(text(await renderLayout("full", noRange, { view: "five_days" })), /±/);
  assert.doesNotMatch(text(await renderLayout("full", PRAHA, { view: "five_days" })), /±/); // older file
});

test("threshold badges come from MeteoVerdict's flags", async () => {
  freezeTime(NOW_NEW);
  const html5 = await renderLayout("full", BENESOV, { view: "five_days" });
  const five = text(html5);
  const badges = html5.match(/<span class="mv-badge">[^<]*<\/span>/g) ?? [];
  // Sunday: heavy rain, ground frost and a gust over the threshold (two badges at most: "Rain", "Frost");
  // ground frost again on Tuesday
  assert.equal(badges.filter((b) => b.includes(">Rain<")).length, 1);
  assert.equal(badges.filter((b) => b.includes(">Frost<")).length, 2);
  assert.match(text(await renderLayout("full", BENESOV, { view: "five_days", lang: "cs" })), /Déšť.*Mráz/);
  // a gust over the threshold, shown in the wind unit
  const gusty = structuredClone(BENESOV);
  for (const p of gusty.forecast.parts) Object.assign(p, { heavy_rain: false, ground_frost: false, gust_over_threshold: p.day === "2026-10-26", gust: p.day === "2026-10-26" ? 16.2 : 5 });
  const g = text(await renderLayout("full", gusty, { view: "five_days", wind: "kmh" }));
  assert.match(g, /gusts 58 km\/h/); // the number on the card
  assert.match(g, /Gusts$|Gusts /); // and the badge
  assert.doesNotMatch(g, /Strong wind/);
  const calm = structuredClone(gusty);
  for (const p of calm.forecast.parts) p.gust_over_threshold = false;
  assert.doesNotMatch(text(await renderLayout("full", calm, { view: "five_days" })), /Gusts/);
});

test("an obec: its name, its temperatures and rain, the okres's sky", async () => {
  freezeTime(NOW_NEW);
  const both = { IDX_0: BENESOV, IDX_1: MILICIN };
  const words = text(await renderLayout("full", both, {}));
  const day = (doc, d) => doc.find((p) => p.day === d && p.part === "day");
  assert.match(words, /^ ?Today/);
  assert.match(words, new RegExp(`${Math.round(day(MILICIN.parts, "2026-10-24").tmax)}°`));
  assert.match(words, /Miličín .*MeteoVerdict/);
  assert.doesNotMatch(words, /test/);
  assert.notEqual(Math.round(day(MILICIN.parts, "2026-10-25").tmax), Math.round(day(BENESOV.forecast.parts, "2026-10-25").tmax));
  assert.match(words, new RegExp(`(Tomorrow|Tmrw) .*${Math.round(day(MILICIN.parts, "2026-10-25").tmax)}°`));
  // the place name setting still wins
  assert.match(text(await renderLayout("full", both, { place: "Chata" })), /Chata .*MeteoVerdict/);
  // an obec file that does not fit the okres file's hours is left out
  const short = structuredClone(MILICIN);
  short.hourly.temperature_2m = short.hourly.temperature_2m.slice(0, 100);
  const okres = text(await renderLayout("full", { IDX_0: BENESOV, IDX_1: short }, {}));
  assert.doesNotMatch(okres, /Miličín/);
  assert.match(okres, /Benešov/);
});

test("a day's high and low span its parts (the AI's whole day can cover fewer hours)", async () => {
  freezeTime(NOW_NEW);
  const ai = structuredClone(BENESOV_AI);
  const rows = ai.forecast.parts.filter((p) => p.day === "2026-10-24");
  const day = rows.find((p) => p.part === "day");
  const pm = rows.find((p) => p.part === "afternoon");
  Object.assign(day, { tmax: 11.2, tmin: 7 });
  Object.assign(pm, { tmax: 15.6 });
  const words = text(await renderLayout("full", ai, {}));
  assert.match(words, /^ ?Today .*Oct 16°/);
  assert.match(words, new RegExp(`low ${Math.round(Math.min(...rows.filter((p) => p.part !== "day").map((p) => p.tmin)))}°`));
});

test("an obec file from the AI says MeteoVerdict AI, whatever the okres file", async () => {
  freezeTime(NOW_NEW);
  const words = text(await renderLayout("full", { IDX_0: BENESOV, IDX_1: { ...MILICIN, model: "ai" } }, {}));
  assert.match(words, /MeteoVerdict AI · 12:00/);
  assert.match(text(await renderLayout("full", { IDX_0: BENESOV_AI, IDX_1: MILICIN }, {})), /MeteoVerdict AI/);
});

test("next 24 and 48 hours: the span of days, the six facts, the symbols every 3 and 6 hours", async () => {
  freezeTime(NOW_NEW); // 12:00 in Prague on Saturday 24 October; summer time ends that night
  const h24 = text(await renderLayout("full", BENESOV_AI, { view: "next_24h" }));
  assert.match(h24, /Next 24 hours Frost Saturday 24 Oct → Sunday 25 Oct/);
  for (const fact of ["Rain", "Sunshine", "Clouds", "Wind", "Pressure", "Humidity"]) assert.match(h24, new RegExp(fact));
  assert.match(h24, /gusts \d+/);
  assert.match(h24, /→ Sunday 25 Oct Now: \d+° Rain/); // "Now" over the temperature now, no time
  assert.doesNotMatch(h24, /Now ·/);
  assert.match(h24, /dew point -?\d+°/);
  assert.match(h24, /Rain from tomorrow 08:00/);
  assert.match(h24, /15 .*18 .*21 .*Sun 00 .*03 .*06 .*09/); // every 3 hours
  const h48 = text(await renderLayout("full", BENESOV_AI, { view: "next_48h", lang: "cs" }));
  assert.match(h48, /Příštích 48 hodin Mráz sobota 24\. 10\. → pondělí 26\. 10\./);
  assert.match(h48, /18 .*Ne 00 .*06 .*12 .*18 .*Po 00 .*06/); // every 6 hours, midnights with the day
  assert.doesNotMatch(h48, /NaN|undefined/);
});

test("the 24-hour head has the weekday in full and a short date, with or without a badge", async () => {
  freezeTime(NOW_NEW);
  const calm = structuredClone(BENESOV_AI);
  for (const p of calm.forecast.parts) Object.assign(p, { frost: false, ground_frost: false, heavy_rain: false, gust_over_threshold: false });
  assert.match(text(await renderLayout("full", calm, { view: "next_24h" })), /Next 24 hours Saturday 24 Oct → Sunday 25 Oct/);
});

test("the wind says its gusts", async () => {
  freezeTime(NOW_NEW);
  const words = text(await renderLayout("full", BENESOV_AI, {}));
  assert.match(words, /Wind \d+ m\/s gusts \d+/);
});

test("a head with badges keeps the date after them (the date is what gets cut), short in the 24-hour head", async () => {
  freezeTime(NOW_NEW);
  const two = structuredClone(BENESOV);
  for (const p of two.forecast.parts) if (p.day === "2026-10-25") Object.assign(p, { frost: true, ground_frost: true, heavy_rain: true, gust_over_threshold: false });
  const days = text(await renderLayout("full", two, {}));
  assert.match(days, /Tmrw Frost Rain Sun 25 Oct/);
  const one = structuredClone(two);
  for (const p of one.forecast.parts) p.heavy_rain = false;
  assert.match(text(await renderLayout("full", one, {})), /Tomorrow Frost Sun 25 Oct/);
  const h24 = text(await renderLayout("full", two, { view: "next_24h" }));
  assert.match(h24, /Next 24 hours Frost Rain Saturday 24 Oct → Sunday 25 Oct/);
  assert.match(text(await renderLayout("full", two, { view: "next_24h", lang: "cs" })), /Příštích 24 hodin Mráz Déšť sobota 24\. 10\. → neděle 25\. 10\./);
});
