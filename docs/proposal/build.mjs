// Mockups of the new MeteoVerdict AI dashboard: 2, 3 and 5 days (800x480, black and white).
// A proposal only: static HTML drawn from a saved AI okres file, nothing here is in dist/.
//   node docs/proposal/build.mjs [chrome binary]      -> docs/proposal/{2-days,3-days,5-days}.{html,png}
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const chrome = process.argv[2] ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const doc = JSON.parse(readFileSync(join(here, "../../test/fixtures/2026-10-23-CZ0201-ai.json"), "utf-8"));
const PLACE = "Benešov";
const NOW = "2026-10-24T10:00:00Z"; // 12:00 Prague, the clock of the mockups
const { hourly: H, parts: P } = doc.forecast;

// ---------- data helpers ----------
const prague = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Prague", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false });
const local = (iso) => { const [d, h] = prague.format(new Date(iso)).split(" "); return { day: d, hour: Number(h) % 24 }; };
const hours = H.time.map((t, i) => ({ i, t: `${t.slice(0, 16)}:00Z`, ...local(`${t.slice(0, 16)}:00Z`) }));
const DAYNAMES = ["neděle", "pondělí", "úterý", "středa", "čtvrtek", "pátek", "sobota"];
const SHORT = ["Ne", "Po", "Út", "St", "Čt", "Pá", "So"];
const dow = (d) => new Date(`${d}T12:00:00Z`).getUTCDay();
const fmtDate = (d) => `${Number(d.slice(8))}. ${Number(d.slice(5, 7))}.`;
const num = (v, n = 0) => (v == null ? "–" : v.toFixed(n).replace(".", ",").replace("-", "−"));
const deg = (v) => `${num(Math.round(v))}°`;

function day(d) {
  const rows = P.filter((p) => p.day === d);
  const parts = ["night", "morning", "afternoon", "evening"].map((n) => rows.find((p) => p.part === n));
  const whole = rows.find((p) => p.part === "day");
  const hs = hours.filter((h) => h.day === d);
  const sum = (k) => hs.reduce((s, h) => s + (H[k][h.i] ?? 0), 0);
  const max = (k) => Math.max(...hs.map((h) => H[k][h.i] ?? -Infinity));
  const hi = hs.map((h) => H.temperature_2m_hi[h.i]).filter((v) => v != null);
  const warm = hs.reduce((a, b) => (H.temperature_2m[b.i] > H.temperature_2m[a.i] ? b : a));
  return {
    d, parts, whole, hs,
    tmax: Math.max(...parts.map((p) => p.tmax)), tmin: Math.min(...parts.map((p) => p.tmin)),
    // the ± of the high: half of the 80 % range at the warmest hour
    pm: (H.temperature_2m_hi[warm.i] - H.temperature_2m_lo[warm.i]) / 2,
    rain: sum("precipitation"), snow: sum("snowfall"),
    pop: Math.max(...parts.map((p) => p.rain_probability)),
    gust: Math.max(...parts.map((p) => p.gust ?? 0)), wind: Math.max(...parts.map((p) => p.wind ?? 0)),
    sun: parts.reduce((s, p) => s + p.sunshine, 0),
    heavy: parts.some((p) => p.heavy_rain), frost: parts.some((p) => p.frost), ground: parts.some((p) => p.ground_frost),
    gustFlag: parts.some((p) => p.gust_over_threshold),
    fog: max("fog_probability"), cape: max("cape"), minVis: Math.min(...hs.map((h) => H.visibility[h.i] ?? 20)),
    sunrise: rows[0].sunrise, sunset: rows[0].sunset,
    symbol: parts[2].symbol === "clear" || parts[2].symbol === "partly" ? parts[2].symbol : whole.symbol === "clear" ? "clear" : parts[2].symbol,
  };
}
const DAYS = [...new Set(P.map((p) => p.day))].filter((d) => d >= "2026-10-24").map(day);

// ---------- symbols (the plugin's own, 64x64) ----------
const sun = `<g stroke="#000" stroke-width="4" stroke-linecap="round"><circle cx="32" cy="32" r="11"/><path d="M32 6v7M32 51v7M6 32h7M51 32h7M13.6 13.6l5 5M45.4 45.4l5 5M13.6 50.4l5-5M45.4 18.6l5-5"/></g>`;
const cloud = (fill = "#fff") => `<path d="M18 50H46A9 9 0 0 0 46 32A13 13 0 0 0 21 30A10 10 0 0 0 18 50Z" fill="${fill}" stroke="#000" stroke-width="3.5" stroke-linejoin="round"/>`;
const drops = `<path d="M24 48l-3 8M33 48l-3 8M42 48l-3 8" stroke="#000" stroke-width="3.5" stroke-linecap="round"/>`;
const drop1 = `<path d="M30 48l-3 8M40 48l-3 8" stroke="#000" stroke-width="3.5" stroke-linecap="round"/>`;
const flakes = `<g stroke="#000" stroke-width="2.5" stroke-linecap="round"><path d="M22 47v10M17.7 49.5l8.6 5M17.7 54.5l8.6-5M42 47v10M37.7 49.5l8.6 5M37.7 54.5l8.6-5"/></g>`;
const SYM = {
  clear: sun,
  partly: `<g transform="translate(2 0) scale(.62)">${sun}</g>${cloud()}`,
  cloudy: `<g transform="translate(-8 -12)">${cloud("#000")}</g>${cloud()}`,
  showers: `<g transform="translate(2 -6) scale(.62)">${sun}</g><g transform="translate(0 -8)">${cloud()}</g>${drop1}`,
  rain: `<g transform="translate(0 -8)">${cloud()}</g>${drops}`,
  sleet: `<g transform="translate(0 -8)">${cloud()}</g>${drops}`,
  snow: `<g transform="translate(0 -8)">${cloud()}</g>${flakes}`,
};
const sym = (name, size) => `<svg width="${size}" height="${size}" viewBox="0 0 64 64" style="overflow:visible">${SYM[name] ?? SYM.cloudy}</svg>`;
const arrow = (from, size = 12) => `<svg width="${size}" height="${size}" viewBox="-6 -6 12 12" style="vertical-align:-1px"><g transform="rotate(${(from + 180) % 360})"><path d="M0-5V5M-3.5 1.5 0 5l3.5-3.5" fill="none" stroke="#000" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`;

// ---------- the hourly chart: temperature with its ± band, rain bars, night as dots ----------
// `from`..`to`: indices into `hours` (inclusive); a Prague day starts at hour 0
function chart({ days, w, h, axisEvery = 6, labels = true, rainScale = 3, now = null }) {
  const hs = hours.filter((x) => days.includes(x.day));
  const n = hs.length;
  const x = (k) => (k / n) * w;
  const top = labels ? 18 : 6, floor = h - 16, plot = floor - top, curveH = plot * 0.66, rainH = plot * 0.34;
  const vals = hs.map((a) => H.temperature_2m[a.i]);
  const lo = Math.min(...hs.map((a) => H.temperature_2m_lo[a.i] ?? H.temperature_2m[a.i]));
  const hi = Math.max(...hs.map((a) => H.temperature_2m_hi[a.i] ?? H.temperature_2m[a.i]));
  const span = Math.max(hi - lo, 4), pad = (span - (hi - lo)) / 2;
  const y = (v) => top + ((hi + pad - v) / span) * curveH;
  // x of an hour's centre: the value is for the hour ending at its time, so it sits half an hour before
  const cx = (k) => x(k + 0.5);
  let svg = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block;overflow:visible">`;
  // night: 18:00-07:00 Prague approximated by sunrise/sunset of each day
  for (const d of days) {
    const info = DAYS.find((q) => q.d === d);
    const [rh, rm] = info.sunrise.split(":").map(Number), [sh, sm] = info.sunset.split(":").map(Number);
    const first = hs.findIndex((a) => a.day === d);
    const at = (hh, mm) => first + hh + mm / 60;
    svg += `<rect x="${x(first)}" y="0" width="${x(at(rh, rm)) - x(first)}" height="${floor}" fill="url(#dots)"/>`;
    svg += `<rect x="${x(at(sh, sm))}" y="0" width="${x(first + 24) - x(at(sh, sm))}" height="${floor}" fill="url(#dots)"/>`;
    if (first > 0) svg += `<path d="M${x(first)} 0V${floor}" stroke="#000" stroke-width="1"/>`;
  }
  // rain bars
  hs.forEach((a, k) => {
    const mm = H.precipitation[a.i] ?? 0;
    if (mm <= 0) return;
    const bh = Math.max(2, Math.min(mm / rainScale, 1) * rainH);
    svg += `<rect x="${x(k) + 1}" y="${floor - bh}" width="${x(1) - 2}" height="${bh}" fill="#000"/>`;
  });
  // the ± band as an outline (white-filled so it lifts off the night dots) and the curve
  const up = hs.map((a, k) => `${cx(k).toFixed(1)},${y(H.temperature_2m_hi[a.i] ?? H.temperature_2m[a.i]).toFixed(1)}`);
  const dn = hs.map((a, k) => `${cx(k).toFixed(1)},${y(H.temperature_2m_lo[a.i] ?? H.temperature_2m[a.i]).toFixed(1)}`).reverse();
  svg += `<polygon points="${[...up, ...dn].join(" ")}" fill="#fff" fill-opacity=".72" stroke="#000" stroke-width="1" stroke-dasharray="1 3"/>`;
  svg += `<polyline points="${hs.map((a, k) => `${cx(k).toFixed(1)},${y(vals[k]).toFixed(1)}`).join(" ")}" fill="none" stroke="#000" stroke-width="3" stroke-linejoin="round"/>`;
  svg += `<path d="M0 ${floor}H${w}" stroke="#000" stroke-width="2"/>`;
  // labels: the highest and lowest value on the curve
  if (labels) {
    const kmax = vals.indexOf(Math.max(...vals)), kmin = vals.indexOf(Math.min(...vals));
    for (const [k, anchor, dy] of [[kmax, "middle", -7], [kmin, "middle", 19]]) {
      svg += `<text x="${Math.min(Math.max(cx(k), 16), w - 16)}" y="${y(vals[k]) + dy}" text-anchor="${anchor}" class="lab">${deg(vals[k])}</text>`;
    }
  }
  // hour axis
  hs.forEach((a, k) => {
    if (a.hour % axisEvery === 0) {
      svg += `<path d="M${x(k)} ${floor}v4" stroke="#000" stroke-width="1"/>`;
      if (a.hour > 0) svg += `<text x="${x(k)}" y="${h - 2}" text-anchor="middle" class="tick">${String(a.hour).padStart(2, "0")}</text>`;
    }
  });
  if (now) {
    const k = hs.findIndex((a) => a.t === now) + 0.5;
    svg += `<path d="M${x(k)} 0V${floor}" stroke="#000" stroke-width="2" stroke-dasharray="4 3"/>`;
  }
  return svg + "</svg>";
}

// ---------- badges and the key fact of a day ----------
const badge = (t) => `<span class="badge">${t}</span>`;
function flags(d) {
  const out = [];
  if (d.gustFlag) out.push(`Nárazy ${num(d.gust, 0)} m/s`);
  if (d.heavy) out.push("Silný déšť");
  if (d.frost) out.push("Mráz");
  else if (d.ground) out.push("Přízemní mráz");
  return out;
}
// the one fact worth a glance for a day, in order of how much it changes the day
function keyFact(d) {
  const f = flags(d);
  if (d.gustFlag) return { icon: "wind", text: `Nárazy ${num(d.gust, 0)} m/s`, flag: true };
  if (d.heavy) return { icon: "drop", text: `Silný déšť ${num(d.rain, 0)} mm`, flag: true };
  if (d.snow >= 0.5) return { icon: "snow", text: `Sníh ${num(d.snow, 0)} cm`, flag: false };
  if (d.rain >= 1 || d.pop >= 0.5) return { icon: "drop", text: `Déšť ${num(d.rain, d.rain < 10 ? 1 : 0)} mm`, flag: false };
  if (f.length) return { icon: "frost", text: f[0], flag: true };
  if (d.fog >= 0.4) return { icon: "fog", text: "Mlha", flag: false };
  if (d.sun >= 4) return { icon: "sun", text: `Slunce ${num(d.sun, 0)} h`, flag: false };
  return { icon: "none", text: `Vítr ${num(d.wind, 0)} m/s`, flag: false };
}
const dayLabel = (d, i) => (i === 0 ? "Dnes" : i === 1 ? "Zítra" : DAYNAMES[dow(d)]);

// ---------- page ----------
const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#fff}
.s{width:800px;height:480px;overflow:hidden;position:relative;background:#fff;color:#000;font-family:Inter,"Helvetica Neue",Arial,sans-serif;padding:8px 10px 0}
.tick{font-size:11px;font-weight:700}.lab{font-size:15px;font-weight:800;paint-order:stroke;stroke:#fff;stroke-width:4px}
.badge{display:inline-block;background:#000;color:#fff;border-radius:4px;padding:0 6px;font-size:12px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;line-height:1.5;white-space:nowrap}
.foot{position:absolute;left:10px;right:10px;bottom:3px;display:flex;justify-content:space-between;font-size:12px;font-weight:600;white-space:nowrap}
.foot b{font-weight:800}
.big{font-weight:800;letter-spacing:-3px;line-height:1;white-space:nowrap}
.pm{font-size:34%;font-weight:700;letter-spacing:0;vertical-align:90%;margin-left:2px}
.small{font-size:13px;font-weight:600}
.head{display:flex;justify-content:space-between;align-items:center;background:#000;color:#fff;border-radius:7px;padding:2px 10px;font-size:19px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;white-space:nowrap}
.head span:last-child{font-size:15px;font-weight:600;letter-spacing:0;text-transform:none}
.col+.col{border-left:2px solid #000}
`;
const defs = `<svg width="0" height="0" style="position:absolute"><defs><pattern id="dots" width="3" height="3" patternUnits="userSpaceOnUse"><rect width="1" height="1" fill="#000" shape-rendering="crispEdges"/></pattern></defs></svg>`;
const NOTE = "Odznaky jsou prahy MeteoVerdictu, ne výstrahy ČHMÚ";
const foot = (extra = "") => `<div class="foot"><span><b>${PLACE}</b></span><span>${NOTE}</span><span>MeteoVerdict AI · 12:00${extra}</span></div>`;
const page = (title, body) => `<!doctype html><html lang="cs"><head><meta charset="utf-8"><title>${title}</title><style>${CSS}</style></head><body>${defs}<div class="s">${body}</div></body></html>`;
const pressure = () => {
  const now = hours.find((a) => a.t === NOW.replace(":00:00Z", ":00:00Z"));
  const ahead = H.pressure_msl[now.i + 6] - H.pressure_msl[now.i];
  return { v: H.pressure_msl[now.i], trend: Math.abs(ahead) < 1 ? "→" : ahead > 0 ? "↗" : "↘" };
};
const nowHour = hours.find((a) => a.t === NOW);

// ---------- 2 days: the hourly course ----------
function twoDays() {
  const [a, b] = DAYS;
  const col = (d, i) => {
    const f = flags(d);
    return `<div class="col" style="width:50%;padding:${i ? "0 0 0 12px" : "0 12px 0 0"};height:168px">
      <div style="display:flex;justify-content:space-between;align-items:baseline"><span style="font-size:20px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px">${dayLabel(d.d, i)}</span><span class="small">${SHORT[dow(d.d)]} ${fmtDate(d.d)}</span></div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:2px">
        ${sym(d.symbol, 76)}
        <div><div class="big" style="font-size:84px">${deg(d.tmax)}${i ? `<span class="pm">±${num(d.pm)}</span>` : ""}</div></div>
        <div style="margin-left:auto;text-align:right">
          <div style="font-size:30px;font-weight:800;line-height:1">${deg(d.tmin)}</div><div class="small">noc</div>
          <div style="margin-top:6px;font-size:22px;font-weight:800;line-height:1">${d.rain >= 0.1 ? `${num(d.rain, 1)} mm` : "sucho"}</div><div class="small">${Math.round(d.pop * 100)} % šance</div>
        </div>
      </div>
      <div style="margin-top:4px;display:flex;gap:6px;align-items:center;white-space:nowrap" class="small">${f.map(badge).join("")}<span>☀ ${num(d.sun, 1)} h · ↑${d.sunrise} ↓${d.sunset} · vítr ≤${num(d.wind, 0)} m/s</span></div>
    </div>`;
  };
  // wind strip under the chart: direction, speed and, when it matters, the gust, every 3 hours
  const strip = (days) => {
    const hs = hours.filter((x) => days.includes(x.day));
    return hs.map((x, k) => (x.hour % 3 === 1 ? { x, k } : null)).filter(Boolean).map(({ x, k }) => {
      const g = H.wind_gusts_10m[x.i];
      return `<div style="position:absolute;left:${(k / hs.length) * 780 - 15}px;width:44px;text-align:center;font-size:12px;font-weight:700;line-height:1.15">${arrow(H.wind_direction_10m[x.i])} ${num(H.wind_speed_10m[x.i], 0)}${g >= 10 ? `<br><span style="font-weight:800">↯${num(g, 0)}</span>` : ""}</div>`;
    }).join("");
  };
  const p = pressure();
  return page("2 dny", `
    <div style="display:flex;margin-top:0">${col(a, 0)}${col(b, 1)}</div>
    <div style="position:absolute;left:10px;top:182px">${chart({ days: [a.d, b.d], w: 780, h: 200, axisEvery: 3, now: NOW })}</div>
    <div style="position:absolute;left:10px;top:386px;width:780px;height:38px"><span style="position:absolute;left:0;top:-3px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase"></span>${strip([a.d, b.d])}</div>
    <div class="small" style="position:absolute;left:10px;top:432px;width:780px;white-space:nowrap">
      Vítr m/s se šipkou směru, ↯ nárazy od 10 m/s · tlak ${num(p.v, 0)} hPa ${p.trend} · vlhkost ${num(H.relative_humidity_2m[nowHour.i], 0)} % · rosný bod ${deg(H.dew_point_2m[nowHour.i])}
    </div>
    ${foot()}`);
}

// ---------- 3 days: parts of the day with a temperature band ----------
function threeDays() {
  const ds = DAYS.slice(0, 3);
  const all = ds.flatMap((d) => d.parts);
  const lo = Math.floor(Math.min(...all.map((p) => p.tmin))) - 1, hi = Math.ceil(Math.max(...all.map((p) => p.tmax))) + 1;
  const CH = 196, CT = 4;
  const ty = (v) => CT + ((hi - v) / (hi - lo)) * (CH - CT - 4);
  const colW = 260;
  const LABELS = ["noc", "ráno", "odpol.", "večer"];
  const cols = ds.map((d, i) => {
    const f = flags(d);
    const cell = (p, k) => `<div style="width:${colW / 4 - 1}px;text-align:center;font-size:11px;font-weight:700">
        <div style="text-transform:uppercase;letter-spacing:.5px;font-size:10px">${LABELS[k]}</div>${sym(p.symbol, 30)}
        <div style="font-size:12px;font-weight:800;margin-top:1px">${p.rain_probability >= 0.2 ? `${Math.round(p.rain_probability * 100)} %` : "&nbsp;"}</div></div>`;
    // a floating bar per part, tmin..tmax on one axis for all three days
    const bars = d.parts.map((p, k) => {
      const bw = colW / 4 - 10, x0 = i * colW + k * (colW / 4) + 5;
      return `<rect x="${x0}" y="${ty(p.tmax)}" width="${bw}" height="${Math.max(ty(p.tmin) - ty(p.tmax), 3)}" rx="3" fill="${p.precipitation >= 0.5 ? "url(#dots)" : "#000"}" stroke="#000" stroke-width="2"/>
        <text x="${x0 + bw / 2}" y="${ty(p.tmax) - 3}" text-anchor="middle" class="lab" style="font-size:13px">${deg(p.tmax)}</text>
        <text x="${x0 + bw / 2}" y="${ty(p.tmin) + 13}" text-anchor="middle" class="lab" style="font-size:12px;font-weight:700">${deg(p.tmin)}</text>`;
    }).join("");
    d.bars = bars;
    return `<div class="col" style="width:${colW}px;padding:0 ${i === 2 ? 0 : 8}px 0 ${i ? 8 : 0}px;height:${CH + 10}px;position:relative">
      <div style="display:flex;justify-content:space-between;align-items:baseline"><span style="font-size:19px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px">${dayLabel(d.d, i)}</span><span class="small">${SHORT[dow(d.d)]} ${fmtDate(d.d)}</span></div>
      <div style="display:flex;align-items:center;gap:4px">
        ${sym(d.symbol, 58)}<div class="big" style="font-size:70px;letter-spacing:-3px">${deg(d.tmax)}${i ? `<span class="pm">±${num(d.pm)}</span>` : ""}</div>
        <div style="margin-left:auto;font-size:22px;font-weight:800;line-height:1;text-align:right">${deg(d.tmin)}</div>
      </div>
      <div style="font-size:14px;font-weight:800;white-space:nowrap;margin-top:1px">${d.rain >= 0.1 ? `${num(d.rain, 1)} mm` : "sucho"} <span class="small">· ${Math.round(d.pop * 100)} % · vítr ≤${num(d.wind, 0)}</span></div>
      <div style="height:22px;margin-top:2px;white-space:nowrap;overflow:hidden">${f.map(badge).join(" ")}</div>
      <div style="display:flex;margin-top:3px;gap:1px">${d.parts.map(cell).join("")}</div>
    </div>`;
  }).join("");
  const grid = [0, 1, 2].map((i) => `<path d="M${i * colW} 0V${CH}" stroke="#000" stroke-width="${i ? 2 : 0}"/>`).join("");
  return page("3 dny", `
    <div style="display:flex">${cols}</div>
    <div style="position:absolute;left:10px;top:222px;width:780px">
      <svg width="780" height="${CH + 4}" style="display:block;overflow:visible">${grid}${ds.map((d) => d.bars).join("")}</svg>
    </div>
    <div class="small" style="position:absolute;left:10px;top:436px;white-space:nowrap">Pruh = nejnižší až nejvyšší teplota části dne · tečkovaně: část dne se srážkami · % = šance srážek</div>
    ${foot()}`);
}

// ---------- 5 days: one glance per day ----------
function fiveDays() {
  const ds = DAYS.slice(0, 5);
  const colW = 156;
  const cols = ds.map((d, i) => {
    const k = keyFact(d);
    const popW = Math.round(d.pop * 100);
    return `<div class="col" style="width:${colW}px;text-align:center;padding:0 4px;height:290px">
      <div style="font-size:18px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px">${i === 0 ? "Dnes" : SHORT[dow(d.d)]}</div>
      <div class="small" style="margin-top:-1px">${fmtDate(d.d)}</div>
      <div style="margin:2px 0 0">${sym(d.symbol, 58)}</div>
      <div class="big" style="font-size:64px;letter-spacing:-3px;margin-top:2px">${deg(d.tmax)}${i ? `<span class="pm">±${num(d.pm)}</span>` : ""}</div>
      <div style="font-size:22px;font-weight:800;margin-top:2px">${deg(d.tmin)}</div>
      <div style="margin:9px 6px 0"><div style="height:9px;border:2px solid #000;border-radius:5px;position:relative"><div style="position:absolute;left:0;top:0;bottom:0;width:${popW}%;background:#000"></div></div>
        <div style="font-size:13px;font-weight:800;margin-top:2px">${popW} % <span style="font-weight:600">srážky${d.rain >= 0.1 && k.icon !== "drop" ? ` · ${num(d.rain, 1)} mm` : ""}</span></div></div>
      <div style="margin-top:8px;height:24px">${k.flag ? badge(k.text) : `<span style="font-size:14px;font-weight:700">${k.text}</span>`}</div>
    </div>`;
  }).join("");
  const days = ds.map((d) => d.d);
  return page("5 dní", `
    <div class="head"><span>5 dní</span><span>${SHORT[dow(days[0])]} ${fmtDate(days[0])} – ${SHORT[dow(days.at(-1))]} ${fmtDate(days.at(-1))}</span></div>
    <div style="display:flex;margin-top:6px">${cols}</div>
    <div style="position:absolute;left:10px;top:326px">${chart({ days, w: 780, h: 124, axisEvery: 12, labels: false, rainScale: 3 })}</div>
    ${foot()}`);
}

const OUT = { "2-days": twoDays(), "3-days": threeDays(), "5-days": fiveDays() };
for (const [name, html] of Object.entries(OUT)) {
  const file = join(here, `${name}.html`);
  writeFileSync(file, html);
  // grayscale + contrast stands in for the black-and-white panel, as in scripts/screenshots.mjs
  execFileSync(chrome, ["--headless", "--disable-gpu", "--hide-scrollbars", `--screenshot=${join(here, `${name}.png`)}`, "--window-size=800,480", `file://${file}`], { stdio: "ignore" });
  console.log(`${name}.png`);
}
