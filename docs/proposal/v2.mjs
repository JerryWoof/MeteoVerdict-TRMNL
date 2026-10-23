// Proposal v2: today's designs (Today and tomorrow, 5 days) with a few more of the new data,
// and a 1-day view in the same style. Mockups only: they reuse the CSS of the real views and
// draw their own markup from a saved AI okres file; nothing here is in src/ or dist/.
//   node docs/proposal/v2.mjs [chrome binary]   -> docs/proposal/v2/{24-hours,2-days,5-days}.{html,png}
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { freezeTime, page, renderLayout } from "../../scripts/render.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "v2");
mkdirSync(out, { recursive: true });
const chrome = process.argv[2] ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const doc = JSON.parse(readFileSync(join(here, "../../test/fixtures/2026-10-23-CZ0201-ai.json"), "utf-8"));
const PLACE = "Benešov";
const NOW = "2026-10-24T10:00:00Z"; // 12:00 Prague
const { hourly: H, parts: P } = doc.forecast;

// the real views' CSS (shared styles, Today and tomorrow, 5 days, next 24 hours)
freezeTime(NOW);
const css = (await Promise.all(["today_tomorrow", "five_days", "next_24h"].map((view) => renderLayout("full", doc, { view, lang: "cs" }))))
  .flatMap((h) => [...h.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1])).join("\n");

// ---------- data ----------
const prague = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Prague", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false });
const hours = H.time.map((t, i) => { const iso = `${t.slice(0, 16)}:00Z`; const [d, h] = prague.format(new Date(iso)).split(" "); return { i, t: iso, day: d, hour: Number(h) % 24 }; });
const DAYS = ["neděle", "pondělí", "úterý", "středa", "čtvrtek", "pátek", "sobota"];
const MONTHS = ["ledna", "února", "března", "dubna", "května", "června", "července", "srpna", "září", "října", "listopadu", "prosince"];
const SHORT = ["Ne", "Po", "Út", "St", "Čt", "Pá", "So"];
const dow = (d) => new Date(`${d}T12:00:00Z`).getUTCDay();
const long = (d) => `${DAYS[dow(d)]} ${Number(d.slice(8))}. ${MONTHS[Number(d.slice(5, 7)) - 1]}`;
const dm = (d) => `${Number(d.slice(8))}. ${Number(d.slice(5, 7))}.`;
const num = (v, n = 0) => (v == null ? "–" : v.toFixed(n).replace(".", ",").replace("-", "−"));
const dec1 = (v) => (Math.round(v * 10) / 10 === Math.round(v) ? String(Math.round(v)) : (Math.round(v * 10) / 10).toFixed(1).replace(".", ","));
const hm = (s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));

function day(d) {
  const rows = P.filter((p) => p.day === d);
  const parts = ["night", "morning", "afternoon", "evening"].map((n) => rows.find((p) => p.part === n));
  const hs = hours.filter((h) => h.day === d);
  const warm = hs.reduce((a, b) => (H.temperature_2m[b.i] > H.temperature_2m[a.i] ? b : a));
  const noon = hs.find((h) => h.hour === 13) ?? hs[12];
  return {
    d, parts, hs,
    tmax: Math.max(...parts.map((p) => p.tmax)), tmin: Math.min(...parts.map((p) => p.tmin)),
    pm: Math.round((H.temperature_2m_hi[warm.i] - H.temperature_2m_lo[warm.i]) / 2),
    rain: hs.reduce((s, h) => s + (H.precipitation[h.i] ?? 0), 0), snow: hs.reduce((s, h) => s + (H.snowfall[h.i] ?? 0), 0),
    pop: Math.max(...parts.map((p) => p.rain_probability)),
    wind: Math.max(...parts.map((p) => p.wind)), gust: Math.max(...parts.map((p) => p.gust ?? 0)), dir: H.wind_direction_10m[noon.i],
    sun: parts.reduce((s, p) => s + p.sunshine, 0), cloud: Math.round(parts.reduce((s, p) => s + p.cloud, 0) / 4),
    heavy: parts.some((p) => p.heavy_rain), frost: parts.some((p) => p.frost), ground: parts.some((p) => p.ground_frost), gustFlag: parts.some((p) => p.gust_over_threshold),
    fog: Math.max(...hs.map((h) => H.fog_probability[h.i] ?? 0)),
    sunrise: rows[0].sunrise, sunset: rows[0].sunset, symbol: rows.find((p) => p.part === "day").symbol,
    word: { clear: "Jasno", partly: "Polojasno", cloudy: "Zataženo", showers: "Přeháňky", rain: "Déšť", sleet: "Déšť se sněhem", snow: "Sněžení" }[parts[2].symbol],
  };
}
const DAYLIST = [...new Set(P.map((p) => p.day))].filter((d) => d >= "2026-10-24").map(day);
const light = (d) => hm(d.sunset) - hm(d.sunrise);
const lightTxt = (d) => `${Math.floor(light(d) / 60)} h ${light(d) % 60} min`;

// ---------- symbols ----------
const sun = `<g stroke="#000" stroke-width="4" stroke-linecap="round"><circle cx="32" cy="32" r="11"/><path d="M32 6v7M32 51v7M6 32h7M51 32h7M13.6 13.6l5 5M45.4 45.4l5 5M13.6 50.4l5-5M45.4 18.6l5-5"/></g>`;
const moon = `<path d="M38 8a24 24 0 1 0 18 36A19 19 0 0 1 38 8z"/>`;
const cloud = (fill = "#fff") => `<path d="M18 50H46A9 9 0 0 0 46 32A13 13 0 0 0 21 30A10 10 0 0 0 18 50Z" fill="${fill}" stroke="#000" stroke-width="3.5" stroke-linejoin="round"/>`;
const drops = `<path d="M24 48l-3 8M33 48l-3 8M42 48l-3 8" stroke="#000" stroke-width="3.5" stroke-linecap="round"/>`;
const drop1 = `<path d="M30 48l-3 8M40 48l-3 8" stroke="#000" stroke-width="3.5" stroke-linecap="round"/>`;
const flakes = `<g stroke="#000" stroke-width="2.5" stroke-linecap="round"><path d="M22 47v10M17.7 49.5l8.6 5M17.7 54.5l8.6-5M42 47v10M37.7 49.5l8.6 5M37.7 54.5l8.6-5"/></g>`;
const symbol = (name, size, night = false) => {
  const orb = night ? moon : sun;
  const body = {
    clear: orb, partly: `<g transform="translate(2 0) scale(.62)">${orb}</g>${cloud()}`,
    cloudy: `<g transform="translate(-8 -12)">${cloud("#000")}</g>${cloud()}`,
    showers: `<g transform="translate(2 -6) scale(.62)">${orb}</g><g transform="translate(0 -8)">${cloud()}</g>${drop1}`,
    rain: `<g transform="translate(0 -8)">${cloud()}</g>${drops}`, sleet: `<g transform="translate(0 -8)">${cloud()}</g>${drops}`,
    snow: `<g transform="translate(0 -8)">${cloud()}</g>${flakes}`,
  }[name] ?? "";
  return `<svg width="${size}" height="${size}" viewBox="0 0 64 64" style="overflow:visible;flex:none">${body}</svg>`;
};
const compass = (from) => from == null ? "" : ["S","SV","V","JV","J","JZ","Z","SZ"][Math.round(from / 45) % 8];
const arrow = (from, size = 13) => from == null ? "" : `<svg width="${size}" height="${size}" viewBox="-6 -6 12 12" style="vertical-align:-1px;overflow:visible"><g transform="rotate(${(from + 180) % 360})"><path d="M0-5V5M-3.5 1.5 0 5l3.5-3.5" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`;
const riseSvg = `<svg class="mv-glyph" viewBox="0 0 24 24"><path d="M2 19h20M6.5 19a5.5 5.5 0 0 1 11 0M12 3v7M8.5 6.5 12 3l3.5 3.5" fill="none" stroke="#000" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const setSvg = `<svg class="mv-glyph" viewBox="0 0 24 24"><path d="M2 19h20M6.5 19a5.5 5.5 0 0 1 11 0M12 3v7M8.5 6.5 12 10l3.5-3.5" fill="none" stroke="#000" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const hourSymbol = (h) => {
  const p = H.precipitation[h.i] ?? 0, c = H.cloud_cover[h.i], t = H.temperature_2m[h.i];
  const info = DAYLIST.find((q) => q.d === h.day), m = h.hour * 60 + 30;
  const night = m < hm(info.sunrise) || m >= hm(info.sunset);
  const name = p >= 0.5 ? (t <= 0.5 ? "snow" : t <= 2 ? "sleet" : "rain") : p >= 0.1 ? "showers" : c < 25 ? "clear" : c < 70 ? "partly" : "cloudy";
  return { name, night };
};

// ---------- chart: the real style plus the ± band ----------
function chart({ days, w, h, axis = true, labels = false, now = false, band = false }) {
  const hs = hours.filter((x) => days.includes(x.day));
  const n = hs.length, k = w / n, floor = axis ? h - 16 : h - 2, top = labels ? 20 : 6, plot = floor - top, curveH = plot * 0.62, rainH = plot * 0.4;
  const t = (key) => hs.map((a) => H[key][a.i]);
  const lo = Math.min(...t("temperature_2m_lo")), hi = Math.max(...t("temperature_2m_hi"));
  const span = Math.max(hi - lo, 4), top0 = hi + (span - (hi - lo)) / 2;
  const y = (v) => top + ((top0 - v) / span) * curveH;
  const cx = (j) => (j + 0.5) * k;
  let s = `<svg class="mv-chart" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`;
  for (const d of days) {
    const info = DAYLIST.find((q) => q.d === d), first = hs.findIndex((a) => a.day === d), at = (m) => (first + m / 60) * k;
    s += `<rect x="${Math.round(first * k)}" y="0" width="${Math.round(at(hm(info.sunrise)) - first * k)}" height="${floor}" fill="url(#mv-night)"/>`;
    s += `<rect x="${Math.round(at(hm(info.sunset)))}" y="0" width="${Math.round((first + 24) * k - at(hm(info.sunset)))}" height="${floor}" fill="url(#mv-night)"/>`;
    if (axis) for (const hh of [6, 12, 18]) {
      const gx = Math.round((first + hh) * k) + 0.5;
      s += `<path d="M${gx} ${floor - 5}V${floor}" stroke="#000" stroke-width="1"/><text x="${gx}" y="${h - 2}" text-anchor="middle" class="mv-tick">${String(hh).padStart(2, "0")}</text>`;
    }
  }
  s += `<g fill="#000" shape-rendering="crispEdges">${hs.map((a, j) => { const p = H.precipitation[a.i] ?? 0; if (p < 0.1) return ""; const bh = Math.round(Math.min(p, 3) / 3 * rainH + 2); return `<rect x="${Math.round(j * k + 0.5)}" y="${floor - bh}" width="${Math.max(k - 1, 1).toFixed(1)}" height="${bh}"/>`; }).join("")}</g>`;
  const line = hs.map((a, j) => `${cx(j).toFixed(1)},${y(H.temperature_2m[a.i]).toFixed(1)}`).join(" ");
  if (band) {
    const up = hs.map((a, j) => `${cx(j).toFixed(1)},${y(H.temperature_2m_hi[a.i]).toFixed(1)}`), dn = hs.map((a, j) => `${cx(j).toFixed(1)},${y(H.temperature_2m_lo[a.i]).toFixed(1)}`).reverse();
    // the 80 % range: a dotted outline, so the night's dot screen and the curve stay readable
    s += `<polygon points="${[...up, ...dn].join(" ")}" fill="#fff" fill-opacity=".6" stroke="#000" stroke-width="1" stroke-dasharray="1 3"/>`;
  }
  s += `<polyline points="${line}" fill="none" stroke="#000" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>`;
  if (labels) {
    const v = t("temperature_2m"), jx = v.indexOf(Math.max(...v)), jn = v.indexOf(Math.min(...v));
    s += `<text x="${Math.min(Math.max(cx(jx), 16), w - 16)}" y="${y(v[jx]) - 7}" text-anchor="middle" class="mv-lab">${Math.round(v[jx])}°</text><text x="${Math.min(Math.max(cx(jn), 16), w - 16)}" y="${y(v[jn]) + 20}" text-anchor="middle" class="mv-lab">${Math.round(v[jn])}°</text>`;
  }
  if (now) { const j = hs.findIndex((a) => a.t === NOW) + 0.5; s += `<path d="M${Math.round(j * k) + 0.5} 0V${floor}" stroke="#000" stroke-width="2" stroke-dasharray="4 3"/>`; }
  return s + `<path d="M0 ${floor + 1}H${w}" stroke="#000" stroke-width="2" shape-rendering="crispEdges"/></svg>`;
}
// wind every 3 hours under a chart: direction, speed, and the gust when it is 10 m/s or more
const windStrip = (days, w, { gusts = true } = {}) => {
  const hs = hours.filter((x) => days.includes(x.day)), k = w / hs.length;
  return `<div class="wstrip" style="width:${w}px">${hs.map((a, j) => (a.hour % 3 === 1 ? `<span style="left:${(j + 0.5) * k - 20}px">${arrow(H.wind_direction_10m[a.i])} ${num(H.wind_speed_10m[a.i], 0)}${gusts && H.wind_gusts_10m[a.i] >= 10 ? `<b>↯${num(H.wind_gusts_10m[a.i], 0)}</b>` : ""}</span>` : "")).join("")}</div>`;
};

// ---------- badges ----------
const badge = (t) => `<span class="mv-badge">${t}</span>`;
function alerts(d) {
  const a = [];
  if (d.frost) a.push("Mráz"); else if (d.ground) a.push("Mráz");
  if (d.heavy) a.push("Déšť");
  if (a.length < 2 && d.gustFlag) a.push(`Nárazy ${Math.round(d.gust)} m/s`);
  if (a.length < 2 && d.fog >= 0.4) a.push("Mlha");
  if (a.length < 2 && d.snow >= 0.5) a.push(`Sníh ${dec1(d.snow)} cm`);
  return a.map(badge).join("");
}
const NOTE = "Odznaky nejsou výstrahy ČHMÚ";
const pr = () => { const j = hours.find((a) => a.t === NOW).i, ahead = H.pressure_msl[j + 6] - H.pressure_msl[j]; return `${Math.round(H.pressure_msl[j])} hPa ${Math.abs(ahead) < 1 ? "→" : ahead > 0 ? "↗" : "↘"}`; };
const titleBar = (note, pressureNote = true) => `<div class="title_bar"><span class="title">${PLACE}</span>${note ? `<span class="mv-note2">${NOTE}</span>` : ""}<span class="instance">${pressureNote ? `${pr()} · ` : ""}MeteoVerdict AI · 12:00</span></div>`;
const defs = `<svg width="0" height="0" style="position:absolute"><defs><pattern id="mv-night" width="3" height="3" patternUnits="userSpaceOnUse"><rect width="1" height="1" fill="#000" shape-rendering="crispEdges"/></pattern></defs></svg>`;
const EXTRA = `
.title_bar{position:relative}
.mv-note2{position:absolute;left:105px;font-size:12px;font-weight:600;white-space:nowrap;font-family:Inter,"Helvetica Neue",Arial,sans-serif}
.mv-1 .temps{display:flex;flex-direction:column;flex:none}
.wstrip{position:relative;height:17px;font-size:12px;font-weight:700;white-space:nowrap}
.wstrip span{position:absolute;top:0;width:40px;text-align:center}
.wstrip b{font-weight:800;margin-left:2px}
.mv-1 { display:flex; flex-direction:column; gap:6px }
.mv-1 .body { flex:1; display:flex; gap:16px; min-height:0 }
.mv-1 .left { width:330px; flex:none; display:flex; flex-direction:column; gap:6px }
.mv-1 .right { flex:1; min-width:0; display:flex; flex-direction:column }
.mv-1 .hero { display:flex; align-items:center; gap:6px; height:96px }
.mv-1 .hero > svg { width:92px; height:92px; flex:none }
.mv-1 .mv-max { font-size:80px }
.mv-1 .min { font-size:20px; font-weight:600; margin-top:2px }
.mv-1 .side { margin-left:auto; text-align:right; line-height:1.3 }
.mv-1 .what { font-size:18px; font-weight:800; white-space:nowrap }
.mv-1 .mv-facts { grid-template-columns:1fr 1fr; row-gap:2px }
.mv-1 .mv-fact:nth-child(n+3) { border-top:1px solid #000 }
.mv-1 .mv-fact:nth-child(2n+1) { border-left:0 }
.mv-1 .cells { display:grid; grid-template-columns:repeat(8,1fr); text-align:center }
.mv-1 .cells .h { font-size:14px; font-weight:700 }
.mv-1 .cells svg { width:34px; height:34px; display:block; margin:0 auto }
.mv-1 .cells .t { font-size:18px; font-weight:800; line-height:1 }
.mv-1 .cells .r { font-size:12px; font-weight:700; min-height:14px }
.mv-1 .hero{display:flex;align-items:center;gap:10px;height:96px}.mv-1 .say{flex:1;border:2px solid #000;border-radius:8px;padding:5px 10px;font-size:19px;font-weight:800;line-height:1.2}.mv-1 .say small{display:block;font-size:14px;font-weight:600;margin-top:2px}
.mv-1 .mv-facts.f6{grid-template-columns:repeat(6,1fr)}.mv-1 .mv-fact+.mv-fact{border-left:1px solid #000}
.mv-1 .mv-part .n,.mv-1 .n{font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase}.mv-1 .t{font-size:19px;font-weight:800;line-height:1}.mv-1 svg{overflow:visible}
.mv-1 .mv-chart{margin-top:0}
.mv-1{gap:2px !important}.mv-1>*{flex:none}.mrow{position:relative;height:30px;width:800px}
.gut{position:absolute;left:0;top:2px;width:100px;line-height:1.05;font-size:11px}.gut span{display:block;font-size:10px;font-weight:700;letter-spacing:.8px;text-transform:uppercase}.gut b{display:block;font-size:15px;font-weight:800;white-space:nowrap}.gut b i{font-size:10px;font-style:normal;font-weight:600;margin-left:3px}
.legend{position:absolute;left:0;top:14px;font-size:10px;font-weight:700;line-height:1.5;white-space:nowrap}
.g2{position:absolute;right:12px;top:0;font-size:10px;font-weight:700;display:none}
.mv-1 .top{display:flex;gap:14px;align-items:center}
.mv-1 .say{flex:1;border:2px solid #000;border-radius:8px;padding:6px 10px;font-size:20px;font-weight:800;line-height:1.2}
.mv-1 .say small{display:block;font-size:15px;font-weight:600;margin-top:2px}
.mv-1 .mv-facts.f6{grid-template-columns:repeat(6,1fr)}
.mv-1 .mv-fact:nth-child(n+3){border-top:0}.mv-1 .mv-fact:nth-child(2n+1){border-left:1px solid #000}.mv-1 .mv-fact:first-child{border-left:0}
.mv-1 .hero{height:auto}
.mv-1 .hero>svg{width:80px;height:80px}.mv-1 .mv-max{font-size:60px}.mv-1 .hero>svg{width:60px;height:60px}.mv-1 .say{padding:3px 10px;font-size:19px}.mv-1 .cells .h{font-size:13px}.mv-1 .cells .t{font-size:16px}
.mv-1 .mv-kv2 { font-size:14px; font-weight:600; white-space:nowrap }
.mv-5 .card .f2 { font-size:13px; font-weight:700; line-height:1.3; white-space:nowrap }
.mv-5 .card .b .mv-badge{font-size:11px}
`;
const shell = (inner, note, pressureNote = true) => `<div class="view view--full"><style>${css}${EXTRA}</style>${defs}<div class="layout">${inner}</div>${titleBar(note, pressureNote)}</div>`;

// ---------- 2 days (Today and tomorrow + wind, band, pressure) ----------
function twoDays() {
  const [a, b] = DAYLIST;
  const col = (d, i, prev) => {
    const dt = prev == null ? 0 : Math.round(d.tmax) - Math.round(prev.tmax);
    const al = alerts(d);
    return `<div class="col"><div class="mv-head"><span class="when">${i ? "Zítra" : "Dnes"}${al}</span><span class="date">${al ? `${SHORT[dow(d.d)]} ${dm(d.d)}` : long(d.d)}</span></div>
      <div class="hero">${symbol(d.symbol, 92)}<div class="temps"><span class="mv-max">${Math.round(d.tmax)}°${i && d.pm >= 1 ? `<small class="mv-pm">±${d.pm}</small>` : ""}</span><span class="min">min ${Math.round(d.tmin)}°</span></div>
      <div class="side"><div class="what">${d.word}</div>${Math.abs(dt) >= 2 ? `<div class="diff">o ${Math.abs(dt)} ° ${dt > 0 ? "tepleji" : "chladněji"}</div>` : ""}<div class="mv-sun">${riseSvg} ${d.sunrise}</div><div class="mv-sun">${setSvg} ${d.sunset}</div></div></div>
      <div class="mv-facts">
        <div class="mv-fact"><span>Srážky</span><b>${dec1(d.rain)} mm</b><i>${Math.round(d.pop * 100)} % šance</i></div>
        <div class="mv-fact"><span>Slunce</span><b>${dec1(d.sun)} h</b><i>z ${lightTxt(d)}</i></div>
        <div class="mv-fact"><span>Oblačnost</span><b>${d.cloud} %</b><i>přes den</i></div>
        <div class="mv-fact"><span>Vítr</span><b>${Math.round(d.wind)} m/s</b><i>nárazy ${Math.round(d.gust)}</i></div>
      </div>
      <div class="mv-parts">${d.parts.map((p, j) => `<div class="mv-part"><div class="n">${["Noc", "Ráno", "Odpoledne", "Večer"][j]}</div>${symbol(p.symbol, 38, j === 0 || (j === 3 && hm(d.sunset) < 1200))}<div class="t">${Math.round(j === 0 ? p.tmin : p.tmax)}°</div></div>`).join("")}</div></div>`;
  };
  return shell(`<div class="mv mv-tt"><div class="cols">${col(a, 0)}${col(b, 1, a)}</div>
    ${chart({ days: [a.d, b.d], w: 780, h: 132, now: true })}</div>`, alerts(a) + alerts(b) !== "");
}

// ---------- 5 days (+ wind direction and gusts, the band) ----------
function fiveDays() {
  const ds = DAYLIST.slice(0, 5);
  const best = (k, f = (v) => v) => ds.reduce((x, y) => (f(y[k]) > f(x[k]) ? y : x));
  const card = (d, i) => `<div class="card"><div class="d">${i ? SHORT[dow(d.d)] : "Dnes"}</div><div class="n">${dm(d.d)}</div>${symbol(d.symbol, 66)}
    <div class="mv-max">${Math.round(d.tmax)}°${i && d.pm >= 1 ? `<small class="mv-pm">±${d.pm}</small>` : ""}</div><div class="lo">${Math.round(d.tmin)}°</div>
    <div class="f">${riseSvgDrop()}<b>${dec1(d.rain)} mm</b> · ${Math.round(d.pop * 100)} %<br>${sunGlyph()}<b>${Math.round(d.sun)} h</b> · ${Math.round(d.wind)} m/s</div>
    <div class="f2">${d.gust >= 10 ? `nárazy ${Math.round(d.gust)} m/s` : "&nbsp;"}</div>
    <div class="b">${alerts(d) || "&nbsp;"}</div></div>`;
  const w = best("tmax"), r = best("rain"), s = best("sun");
  const flagged = ds.some((d) => alerts(d));
  const inner = `<div class="mv mv-5"><div class="mv-head"><span class="when">Předpověď na 5 dní</span><span class="date">${long(ds[0].d)} – ${long(ds.at(-1).d)}</span></div>
    <div class="cards">${ds.map(card).join("")}</div>${chart({ days: ds.map((d) => d.d), w: 780, h: 118, axis: false, now: true })}
    <div class="sum">Nejtepleji <b>${DAYS[dow(w.d)]} ${Math.round(w.tmax)}°</b>${r.rain >= 0.5 ? ` · Nejvíc srážek <b>${DAYS[dow(r.d)]} ${dec1(r.rain)} mm</b>` : ""}${s.sun > 0 ? ` · Nejvíc slunce <b>${DAYS[dow(s.d)]} ${Math.round(s.sun)} h</b>` : ""}</div></div>`;
  return shell(inner, flagged);
}
const dropGlyph = `<svg class="mv-glyph" viewBox="0 0 24 24"><path d="M12 2.5C9 7.5 6 10.5 6 15a6 6 0 0 0 12 0c0-4.5-3-7.5-6-12.5z" fill="#000"/></svg>`;
const sunGlyphSvg = `<svg class="mv-glyph" viewBox="0 0 24 24"><g stroke="#000" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="4.5" fill="#000"/><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1"/></g></svg>`;
function riseSvgDrop() { return dropGlyph; }
function sunGlyph() { return sunGlyphSvg; }

// ---------- next 24 hours: the 2-days design, the window limited to the next 24 hours ----------
function next24() {
  const i0 = hours.find((a) => a.t === NOW).i;
  const win = hours.filter((h) => h.i > i0 && h.i <= i0 + 24); // the hours ending after now, for 24 hours
  const dayInfo = DAYLIST[0], tmInfo = DAYLIST[1], now = hours[i0];
  const v = (key) => win.map((a) => H[key][a.i]);
  const temp = v("temperature_2m"), prec = v("precipitation").map((q) => q ?? 0);
  const night = (a) => { const q = DAYLIST.find((d) => d.d === a.day), m = a.hour * 60 + 30; return m < hm(q.sunrise) || m >= hm(q.sunset); };
  const hhmm = (a) => `${String(a.hour).padStart(2, "0")}:00`;
  const hi = Math.max(...temp), lo = Math.min(...temp);
  const rain = prec.reduce((t, q) => t + q, 0), snow = v("snowfall").reduce((t, q) => t + (q ?? 0), 0), sunH = v("sunshine_duration").reduce((t, q) => t + q, 0) / 3600;
  const wind = Math.max(...v("wind_speed_10m")), gust = Math.max(...v("wind_gusts_10m")), cloud = Math.round(v("cloud_cover").reduce((t, q) => t + q, 0) / 24);
  const pop = Math.max(...P.filter((q) => (q.day === dayInfo.d && ["afternoon", "evening"].includes(q.part)) || (q.day === tmInfo.d && ["night", "morning"].includes(q.part))).map((q) => q.rain_probability));
  const jrain = prec.findIndex((q) => q >= 0.1);
  const al = alerts({ ...dayInfo, heavy: dayInfo.heavy || tmInfo.heavy, frost: tmInfo.frost, ground: tmInfo.ground, gustFlag: dayInfo.gustFlag || tmInfo.gustFlag, gust: Math.max(dayInfo.gust, tmInfo.gust), fog: Math.max(dayInfo.fog, tmInfo.fog), snow });
  const nowSym = hourSymbol(now);
  const sunset = hm(dayInfo.sunset) > 12 * 60 ? dayInfo.sunset : tmInfo.sunset, sunrise = tmInfo.sunrise;
  const p0 = H.pressure_msl[hours[i0].i], ahead = H.pressure_msl[hours[i0].i + 6] - p0;

  // the chart, as in Today and tomorrow: night dots, rain bars, the curve, the hours; the extremes written on it
  const W = 780, H2 = 136, k = W / 24, floor = H2 - 16, top = 22, plot = floor - top, curveH = plot * 0.62, rainH = plot * 0.4;
  const span = Math.max(hi - lo, 4), top0 = hi + (span - (hi - lo)) / 2, y = (t) => top + ((top0 - t) / span) * curveH;
  const nights = [];
  let run = null;
  win.forEach((a, j) => { if (night(a) && run === null) run = j; if (run !== null && (!night(a) || j === win.length - 1)) { nights.push([run, night(a) ? j + 1 : j]); run = null; } });
  let c = `<svg class="mv-chart" width="${W}" height="${H2}" viewBox="0 0 ${W} ${H2}">${nights.map(([a, b]) => `<rect x="${Math.round(a * k)}" y="0" width="${Math.round(b * k) - Math.round(a * k)}" height="${floor}" fill="url(#mv-night)"/>`).join("")}`;
  win.forEach((a, j) => {
    if (a.hour % 3 === 0) c += `<path d="M${Math.round((j + 1) * k) + 0.5} ${floor - 5}V${floor}" stroke="#000" stroke-width="1"/><text x="${Math.round((j + 1) * k) + 0.5}" y="${H2 - 2}" text-anchor="middle" class="mv-tick">${String(a.hour).padStart(2, "0")}</text>`;
    if (a.hour === 0) c += `<path d="M${Math.round((j + 1) * k) + 0.5} 0V${floor}" stroke="#000" stroke-width="1"/>`;
  });
  c += `<g fill="#000" shape-rendering="crispEdges">${win.map((a, j) => { if (prec[j] < 0.1) return ""; const bh = Math.round(Math.min(prec[j], 3) / 3 * rainH + 2); return `<rect x="${Math.round(j * k + 0.5)}" y="${floor - bh}" width="${(k - 1).toFixed(1)}" height="${bh}"/>`; }).join("")}</g>`;
  c += `<polyline points="${win.map((a, j) => `${((j + 0.5) * k).toFixed(1)},${y(temp[j]).toFixed(1)}`).join(" ")}" fill="none" stroke="#000" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>`;
  for (const [j, val, dy] of [[temp.indexOf(hi), hi, -7], [temp.indexOf(lo), lo, 20]]) c += `<text x="${Math.min(Math.max((j + 0.5) * k, 16), W - 16)}" y="${y(val) + dy}" text-anchor="middle" class="mv-lab">${Math.round(val)}°</text>`;
  c += `<path d="M0 ${floor + 1}H${W}" stroke="#000" stroke-width="2" shape-rendering="crispEdges"/></svg>`;

  const cells = win.map((a, j) => ({ a, j })).filter(({ a }) => a.hour % 3 === 0).map(({ a, j }) => { const q = hourSymbol(a); return `<div style="position:absolute;left:${Math.round((j + 1) * k) - 36}px;width:72px;text-align:center"><div class="n">${a.hour === 0 ? `${SHORT[dow(a.day)]} 00` : String(a.hour).padStart(2, "0")}</div>${symbol(q.name, 38, q.night)}<div class="t">${Math.round(H.temperature_2m[a.i])}°</div></div>`; }).join("");
  const sentence = jrain >= 0 ? `Srážky ${win[jrain].day === now.day ? "od" : "zítra od"} ${hhmm(win[jrain])}` : "Příštích 24 hodin bez srážek";
  return shell(`<div class="mv mv-tt mv-1"><div class="mv-head"><span class="when">Příštích 24 hodin${al}</span><span class="date">${long(now.day)}</span></div>
    <div class="hero">${symbol(nowSym.name, 92, nowSym.night)}<div class="temps"><span class="mv-max">${Math.round(H.temperature_2m[hours[i0].i])}°</span><span class="min">teď · 12:00</span></div>
      <div class="say">${sentence}<small>${rain >= 0.1 ? `${dec1(rain)} mm · ` : ""}${Math.round(pop * 100)} % šance${snow >= 0.1 ? ` · sníh ${dec1(snow)} cm` : ""}</small></div>
      <div class="side"><div class="what">max ${Math.round(hi)}° · min ${Math.round(lo)}°</div><div class="mv-sun">${setSvg} ${sunset}</div><div class="mv-sun">${riseSvg} ${sunrise}</div></div></div>
    <div class="mv-facts f6">
      <div class="mv-fact"><span>Srážky</span><b>${dec1(rain)} mm</b><i>${Math.round(pop * 100)} % šance</i></div>
      <div class="mv-fact"><span>Slunce</span><b>${dec1(sunH)} h</b><i>z ${lightTxt(dayInfo)}</i></div>
      <div class="mv-fact"><span>Oblačnost</span><b>${cloud} %</b><i>průměr</i></div>
      <div class="mv-fact"><span>Vítr</span><b>${Math.round(wind)} m/s</b><i>nárazy ${Math.round(gust)}</i></div>
      <div class="mv-fact"><span>Tlak</span><b>${Math.round(p0)} hPa</b><i>${Math.abs(ahead) < 1 ? "stabilní" : ahead > 0 ? "stoupá" : "klesá"}</i></div>
      <div class="mv-fact"><span>Vlhkost</span><b>${Math.round(H.relative_humidity_2m[hours[i0].i])} %</b><i>rosný bod ${Math.round(H.dew_point_2m[hours[i0].i])}°</i></div>
    </div>
    <div class="mv-parts" style="position:relative;display:block;height:76px">${cells}</div>${c}</div>`, al !== "", false);
}

for (const [name, html] of Object.entries({ "24-hours": next24(), "2-days": twoDays(), "5-days": fiveDays() })) {
  const file = join(out, `${name}.html`);
  writeFileSync(file, page(html).replace("</style>", ".screen{filter:grayscale(1) contrast(20)}</style>"));
  execFileSync(chrome, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1", "--virtual-time-budget=8000", `--screenshot=${join(out, `${name}.png`)}`, "--window-size=800,480", `file://${file}`], { stdio: "ignore" });
  console.log(`${name}.png`);
}
