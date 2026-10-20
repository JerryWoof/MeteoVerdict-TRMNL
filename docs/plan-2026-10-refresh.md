# Refresh plan, October 2026

MeteoVerdict changed a lot since the plugin was last updated (12 October): forecasts for
6,258 obce, MeteoVerdict AI as the site's default model, the 80 % "±" range of the blend,
thresholds instead of warnings, gusts, frost probability. This plan says what the plugin
takes from that, how it looks, and which data files it needs.

Inputs: a data audit, e-ink design research and a user-value review (notes outside the
repo), then a critique of this plan.

## What the plugin shows (and what it leaves out)

| New in MeteoVerdict | On the display | Why |
|---|---|---|
| Thresholds: frost, ground frost, heavy rain, gusts | Badges, now from the API's own flags (`gust_over_threshold`, `heavy_rain`, `frost`, `ground_frost`) instead of the plugin's home-made rules; a gust badge gives the gust (*Gusts 16 m/s*) | Most value per pixel; the same numbers as the site |
| "Not a ČHMÚ warning" | A short line in the footer whenever a badge is on screen (*thresholds, not ČHMÚ warnings*); the word "warning" is gone from the plugin and README | Act 262/2024 Sb.; licensing plan 3C |
| ± range of the blend temperature | A light dotted band around the temperature curve; the day's high as *14° ±2* in the 5-day view only | Honest about uncertainty, cheap in pixels |
| MeteoVerdict AI | Optional (a second polling URL); the footer names the forecast: *MeteoVerdict AI (exp.)* or *MeteoVerdict · 19 models* | The site defaults to AI, but AI is experimental and its licence undecided: the plugin keeps the blend as default |
| Obce | Optional: an obec's temperature, rain and wind replace the okres's; the title shows the obec's name, the footer says *obec (test)* | Matters in hilly okresy; 6,258 options do not fit a select, so the obec is picked on the Data page |
| Rain probability, mm | Kept: *Rain from 15:00 · 2 mm · 60 %* | Already the plugin's strength; the sentence gains mm and chance |
| p_best, model ranking | Not shown | Means nothing at a glance |
| Radar, satellite, 100 m heatmap | Not shown | A dithered 1-bit image of a radar frame that is 15–60 min old by the time it is seen is noise |

## Data (MeteoVerdict repo, `web/scripts/build-api.mjs`, from published files only)

Two new kinds of files in `api/v1`, built from what Pages already has (`data/scores/ai/fc/outlook.json`,
`data/scores/ai/ai-forecast.json`, `data/forecast/obce-{okres}.json`):

1. **`api/v1/ai/okresy/{code}.json`**: the okres file's schema (`okres`, `forecast.hourly`,
   `forecast.parts`, `licence`, `attribution`, `notice`), with the AI's parts of day
   (`fc/outlook.json`), hourly temperature and wind from the AI where it has them and the
   blend elsewhere, no `temperature_2m_lo/hi` where the AI's temperature is used, and
   `forecast.model: "ai"`, `forecast.sources` (per field, `ai` or `blend`) and
   `forecast.source` (the sentence). No `models` block (~30 kB).
2. **`api/v1/obce/{okres}/{slug}.json`**: a small file per obec (~3 kB, ~20 MB in all;
   the Pages budget is 900 MB and the site is at ~790 MB): `obec` (name, okres, lat,
   lon, elevation), `test: true`, `generated`, `hourly` (`time` on the okres file's
   axis, `temperature_2m`, `precipitation`, `wind_speed_10m`; null where the obec has no
   value) and `parts` (`day`, `part`, `tmin`, `tmax`, `precipitation`, `wind`, computed
   from those hours with the outlook's rules: Prague parts of day, night 0–6, morning
   6–12, afternoon 12–18, evening 18–24, plus `day`). The slug: lowercase ASCII of the
   name, `-` for anything else; unique within an okres (the build fails otherwise).
   `api/v1/obce/index.json`: `[{okres, name, slug, lat, lon}]` for the Data page's picker.
   Blend only for now; AI obce later if the budget allows.

The plugin then polls one or two URLs:

```
https://jerrywoof.github.io/MeteoVerdict/api/v1/okresy/{{ okres_code }}.json        blend (default, unchanged)
https://jerrywoof.github.io/MeteoVerdict/api/v1/ai/okresy/{{ okres_code }}.json     AI instead
https://jerrywoof.github.io/MeteoVerdict/api/v1/obce/CZ0201/benesov.json            optional second line: an obec
```

With two lines TRMNL gives `IDX_0` and `IDX_1`; the templates read either shape. The
Data page's TRMNL section gets a small builder (okres or obec, blend or AI) that prints
the polling URL to paste.

## Settings

Unchanged: okres, view, place name, evening switch, wind unit, language. New text in
the about box (19 models, AI, obce, thresholds, attribution). No model select: the
polling URL decides, and the footer says which it is. Default stays the blend.

## Design

The current look is clean but the charts are dominated by night hatching, the curve has
no numbers, rain bars are tiny, and the low temperature is written three ways.

- **Charts:** night as a light dot screen instead of diagonal hatching; the ± band as a
  denser dot screen hugging the curve; rain bars in the bottom third, at least 0.2 mm;
  the curve's high and low written on it (HTML labels over the SVG, so they don't stretch).
  Patterns of single black pixels look the same on 1-bit, 2-bit and 4-bit screens.
- **Type:** fewer sizes: hero 80–96 px, values 20–22 px, labels 12–13 px caps. The low
  is always *low 7°* / *min 7°*.
- **Badges:** one fixed-height row, black for frost / heavy rain / gusts / heat.
- **Next 24 hours:** no wrapped lines; the rain sentence with mm and chance; the rest as
  a two-column key/value list.
- **Weekend beyond the forecast:** the day that is there gets the full width.
- **Footer:** place · forecast (*MeteoVerdict · 19 models* / *MeteoVerdict AI (exp.)*) ·
  updated; plus the thresholds line when a badge shows.

Mockup, today and tomorrow (800 × 480):

```
┌ TODAY · FROST ─────── Mon 12 Oct ┐ ┌ TOMORROW ─────────── Tue 13 Oct ┐
│ ☁  14°        Partly cloudy      │ │ ☂  15°          Showers          │
│    low 7°     ↑07:19  ↓18:17     │ │    low 5°       ↑07:20  ↓18:15   │
│ RAIN 0.1 mm  SUN 8 h  CLOUD  WIND│ │ RAIN 0.2 mm  SUN 9.5 h  ...      │
│ night  morning  afternoon  even. │ │ ...                              │
│ ·  ·  ·  ·╭──14°──╮·  ·  ·  ·  · │ │ ·  ·  ·╭─15°─╮  ·  ·  ·  ·  ·  │
│ ·7° ·  ·╱░░░░░░░░░╲ ·  ·  ·  ·  │ │  5°╱░░░░░░░░░╲  ·  ·  ·  ·  ·  │
│ ▁▁ ·  ·  ·  ·  ·  ·  ·  ▂▃ ·  · │ │                                  │
└──────────────────────────────────┘ └──────────────────────────────────┘
 Praha                      MeteoVerdict · 19 models · updated 12 Oct 17:20
```

## Tests and screenshots

- Fixtures: a fresh okres file with `temperature_2m_lo/hi`, gusts and frost flags; an AI
  okres file; an obec file. Tests for each shape, single and `IDX_` polling, the
  badges from the flags, the thresholds line, the ± band, both languages.
- `npm run screenshots` regenerates every view in English and Czech, the mashups, the
  thresholds demo (simulated winter), an AI and an obec example.

## Order

1. MeteoVerdict PR: the AI and obec files, tests, `docs/open-data.md`. Merge when CI is
   green and Daily is not running.
2. This repo: templates, tests, screenshots, README. PR, CI, merge.
3. MeteoVerdict PR: the Data page's TRMNL section (new screenshots, the URL builder),
   README mention.
4. The TRMNL marketplace: prepared, published only with the owner's OK.

## After the critique

An opus review changed the plan in these ways (they override the sections above):

- **AI**: a select field in the polling URL, `api/v1/{{ forecast_model }}/{{ okres_code }}.json`
  with `okresy` (blend, default) or `ai/okresy`, so marketplace installs can choose too.
  The AI file takes only **temperature and wind** from the AI (its verified fields; cloud,
  sunshine, gusts and the symbol stay the blend's), has no ± (the blend's range is never
  centred on the AI), and its `licence` is CC BY-SA 4.0 as decided for the AI output for now.
- **Obce**: a private-plugin option only (a second polling line). The obec file is on the
  okres file's hourly axis with no gaps (where the obec has no value: the okres value plus
  the obec's mean offset), its parts carry `night_min`, `frost`, `ground_min` and
  `ground_frost` shifted by the obec's own offset, and ids are `{slug}` with `-2`, `-3` for
  repeated names (never a build failure). Every obec file carries `licence`, `attribution`
  and `notice`.
- **Charts**: drawn at their real pixel size (no stretched viewBox) with `crispEdges`, so
  the dot screens land on whole pixels on a 1-bit panel. An hour axis (06 · 12 · 18) and
  the curve's high and low on it, inside the SVG. **No ± band** on the hourly charts: the
  ± is a number, from tomorrow on and in the 5-day view.
- **Badges**: from the API's flags; the **black-ice badge is dropped** (the plugin's own
  rule, and a ČHMÚ warning phenomenon); heat stays as a plain fact (*31°*). "Warnings" is
  renamed everywhere.
- **Credit** on screen: the footer names MeteoVerdict and the licence, so a shared
  screenshot keeps its attribution. The model count stays dynamic.

Out of scope for now: a "Tonight / frost" view, AI obce, a native TRMNL X (1040 × 780) layout.

## Outcome (21 October 2026)

Built as planned, then changed with the owner:
- **MeteoVerdict AI is the default** (form field `forecast_model`, renamed from `forecast`,
  which clashed with the data's `forecast`); the combined forecast stays a choice.
- **One chart under both days** in today and tomorrow and the weekend, curves from edge to
  edge, no lines at midnight in any chart.
- **Badges in one word:** *Frost* (air or ground) and *Rain* (heavy rain); gusts and heat as before.
- **No licence or thresholds note on screen**; the README and the About box say both.
  Obce without the "(test)" label.
- **Obce with the AI:** `api/v1/ai/obce/{okres}/{id}.json` (MeteoVerdict #248).
- **Size:** the Full layout is under TRMNL's 100 kB limit (91 kB): the two-day layout and a
  day's numbers are in the file once each, and the build fails above 95 kB.
