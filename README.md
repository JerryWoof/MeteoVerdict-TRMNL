# MeteoVerdict for TRMNL

Weather for your Czech district on a [TRMNL](https://trmnl.com) e-ink display: the next
24 or 48 hours, today and tomorrow, or five days, with temperature and its range, rain with
its timing and chance, sunshine, clouds, wind and gusts, pressure, humidity, sunrise and
sunset, and badges for frost, rain and gusts. In English or Czech.

![The next 24 hours in Prague](screenshots/next-24-hours.png)

The forecast is [MeteoVerdict](https://meteoverdict.cz/)'s. Every day,
MeteoVerdict checks how well about 20 weather models forecast what ČHMÚ stations then
measured, and blends them, weighting each model by how accurate it has been in your okres
over the last 90 days. On top of that it runs its own AI model (MeteoVerdict AI, the
default). So you get a forecast tuned for where you live rather than one model's opinion.
Free, no API key.

## Views

A weather display gets a glance on your way out. Pick the view in the plugin's settings
(*View*); every view comes in English and Czech.

### Next 24 hours, and next 48 hours

![The next 24 hours in Prague](screenshots/next-24-hours.png)

For "what will it do, and when?" The window starts now (the head says which days it spans:
*Friday 23 October → Saturday 24 October*):
- the temperature now, a plain sentence about the rain (*Rain from tomorrow 08:00 · 1.1 mm ·
  84 % chance*, *Rain until 20:00*, *Dry for the next 24 hours*), the high and low of the
  window, and the next sunset and sunrise;
- six facts over the window: rain, sunshine, clouds, wind with its gusts, pressure with its
  trend and humidity with the dew point;
- a symbol and temperature every 3 hours (every 6 in the 48-hour view);
- one hourly temperature curve with rain bars, the night as a dot screen, a line at
  midnight and the highest and lowest value written on it.

### Today and tomorrow

![Today and tomorrow in Prague](screenshots/today-tomorrow.png)

Two days side by side. For each:
- the symbol, high and low (tomorrow's high with its ±, half of the 80 % range of the
  forecast: *11° ±1*), and a one-word summary;
- rain with its chance, hours of sunshine out of the day's daylight (and how many minutes
  longer or shorter the day is than the day before), cloud cover and wind with its gusts;
- sunrise and sunset, and for the second day how much warmer or colder it gets;
- night, morning, afternoon and evening, each with its own symbol;
- under both days, one hourly temperature curve with rain bars, the night dotted, a dashed
  line at the current time and the hours 06, 12 and 18;
- up to two threshold badges in the day's head.

After 18:00 the screen moves on to tomorrow and the day after, since by then that's what
you want to know. This can be switched off in the settings.

### 5 days

![Five days in Prague](screenshots/five-days.png)

For planning the week:
- each day's symbol, high (with its ± from tomorrow on) and low, rain with its chance,
  sunshine, wind, and the gusts when they are 10 m/s or more;
- one continuous temperature curve over the five days, rain bars under it;
- a closing line naming the warmest, wettest and sunniest day.

### Thresholds

A day gets up to two badges, from MeteoVerdict's own threshold flags:

| Badge | When |
|---|---|
| Frost / Mráz | MeteoVerdict's corrected night minimum (the night ending that morning) is 1 °C or less, or the ground (5 cm) is forecast to reach 0 °C or below |
| Rain / Déšť | MeteoVerdict's calibrated chance of at least 5 mm in a part of the day is high enough to flag it |
| Gusts / Nárazy | The strongest gust of the day is 13.5 m/s or more; shows it, in your wind unit |
| Hot / Vedro | 30 °C or more |

These are MeteoVerdict's thresholds on its forecast, **not official ČHMÚ warnings**, and the
footer says so whenever a badge is shown. Official warnings: [chmi.cz](https://www.chmi.cz/).

### MeteoVerdict AI or the combined forecast

By default (*Forecast: MeteoVerdict AI*) the values come from MeteoVerdict's own AI model,
as on the website, and the footer says *MeteoVerdict AI*. The AI is still experimental.
With *Forecast: MeteoVerdict (all models combined)* everything is the combined forecast,
which is checked against the stations every day, and the footer says *MeteoVerdict*. Both
files have the same format (`forecast.model`, `forecast.sources` telling for every field
where it comes from, `forecast.hourly`, `forecast.parts`).

### An obec

With a second polling URL (see below) the temperature, rain and wind of any of 6,258
municipalities, corrected for its elevation, replace the okres's, and the footer shows its name.

## Install

Add it to your TRMNL as a private plugin. That takes about five minutes.

1. In TRMNL go to **Plugins → Private Plugin → Add new**, name it, e.g. *MeteoVerdict*.
2. **Strategy:** Polling. **Polling URL:**

   ```
   https://meteoverdict.cz/api/v1/{{ forecast_model }}/{{ okres_code }}.json
   ```

   `{{ forecast_model }}` and `{{ okres_code }}` are filled in from the form in step 3.
   (Installed before October 2026 with `…/api/v1/okresy/{{ okres_code }}.json`? That
   still works and is the combined forecast; switch to the URL above for MeteoVerdict AI.)
3. **Form fields:** paste [`src/settings.yml`](src/settings.yml), then save, fill in the
   form and save again. It creates these fields:

   | Field | |
   |---|---|
   | About This Plugin | The description and links. Nothing to fill in |
   | Okres | A dropdown of all 77. Required |
   | Forecast | MeteoVerdict AI, the default, or MeteoVerdict (all models combined) |
   | View | What the screen shows: today and tomorrow, next 24 hours, next 48 hours, or 5 days |
   | Obec | Optional: the id of an obec in that okres (`velemin`), for its own forecast; needs the two-line polling URL below |
   | Place name | Shown in the footer instead of the okres (or obec) name. Optional |
   | Move on to tomorrow in the evening | After 18:00 *Today and tomorrow* shows tomorrow and the day after. On by default |
   | Wind speed in | m/s or km/h |
   | Language | English or Czech |
4. **Edit Markup:** paste [`dist/full.liquid`](dist/full.liquid) into the *Full* tab. The
   plugin has a full-screen layout only. Then click **Force Refresh**. (TRMNL takes at
   most 100 kB per tab; the file is about 60 kB.)
5. **Refresh rate:** hourly. The forecast itself changes a few times a day, but the
   24-hour view and the "now" line move with the clock.
6. Add the plugin to a playlist.

### An obec (private plugins)

The obec's own forecast comes as a second polling URL: the layouts then use the obec's
temperature, rain and wind and show its name. With the form field *Obec* (the obec's id,
e.g. `velemin`, in the okres chosen in *Okres*), the polling URL is these two lines:

```
https://meteoverdict.cz/api/v1/{{ forecast_model }}/{{ okres_code }}.json
https://meteoverdict.cz/api/v1/{{ forecast_model | replace: "okresy", "obce" }}/{{ okres_code }}/{{ obec }}.json
```

Leave *Obec* empty for the okres only (then use the one-line URL above: with an empty
field the second address does not exist).

Or write the two URLs out in full, one per line, with a fixed obec: the okres file, then
the obec's. With MeteoVerdict AI (both files from `ai/`):

```
https://meteoverdict.cz/api/v1/ai/okresy/CZ0525.json
https://meteoverdict.cz/api/v1/ai/obce/CZ0525/spindleruv-mlyn.json
```

With the combined forecast, the same without `ai/`.

With the full addresses the Okres, Forecast and Obec fields of the form are not used. The obec's address is its okres code and
its name in lower case without diacritics, with `-` for spaces (`CZ0201/benesov`,
`CZ0525/spindleruv-mlyn`; a repeated name in one okres gets `-2`, `-3`). The
[Data page](https://meteoverdict.cz/data.html#trmnl) finds it for you
and lists all obce in [`api/v1/obce/index.json`](https://meteoverdict.cz/api/v1/obce/index.json).
If the obec's file doesn't match the okres file (another okres, or a forecast run apart),
the layouts fall back to the okres.

Times are Czech time (CET, or CEST in summer), hour by hour, whatever your TRMNL
account's time zone. The forecast is for Czechia, so that is the clock it should be read
by.

## Publishing

The plugin is not published as a TRMNL recipe; install it as a private plugin as above.
[`recipe/README.md`](recipe/README.md) keeps the notes for publishing it later: the icon,
the texts for TRMNL's forms, a checklist, and where it stands against TRMNL's recipe
requirements (its own styles exceed the linter's limit on inline layout styles).

## What's on the screen, and how far to trust it

| Value | Where it comes from |
|---|---|
| Temperature, rain, wind, clouds, sunshine | MeteoVerdict AI (experimental), by default (the file's `forecast.sources` says where each field comes from; a few come from the combined forecast); with the combined forecast, MeteoVerdict's blend of about 20 models, weighted and bias-corrected per okres and lead day ([methodology](https://github.com/JerryWoof/MeteoVerdict/blob/main/docs/methodology.md)) |
| ± of the high | Half of the 80 % range of the temperature (the AI's or the blend's) at the day's warmest hour: the true high falls inside the range about 8 times in 10 |
| Chance of rain | MeteoVerdict's chance of rain for each part of the day; the 24-hour sentence takes the highest of the parts it covers |
| Thresholds | MeteoVerdict's flags in the open data: frost and ground frost from the corrected night minimum, heavy rain from the calibrated chance of 5 mm, gusts corrected against ČHMÚ gust observations |
| Obec | MeteoVerdict AI or the blend at the obec's own point, corrected for its elevation (the okres's stations check it only indirectly) |
| Sunrise, sunset | Calculated for the okres's forecast point (NOAA solar equations) |
| Day and part-of-day symbols | MeteoVerdict's: rain, sleet or snow when likely; showers at a 30 % chance; otherwise by cloud cover |
| Hourly symbols (24 and 48 hours) | The plugin's own, per hour: rain, sleet or snow from 0.5 mm, showers from 0.1 mm, otherwise clear under 25 % cloud, partly cloudy under 70 % |
| Pressure, humidity, dew point, gusts | MeteoVerdict's hourly values, as in the open data |

The full-screen footer shows which forecast it is (*MeteoVerdict AI*, or *MeteoVerdict*
for the combined forecast), with the time of the screen and when it was made. A forecast older than
30 hours gets an *old forecast* badge. If the data has nothing left for today, the screen
says so instead of showing an old day.

The forecast starts at midnight UTC, so today's first hour is 01:00 (02:00 in summer);
the curve is held level from the left edge to that hour.

## Develop

```bash
npm ci
npm run build                 # src/ → dist/ (inlines the includes)
npm test                      # every view and language against saved data (the blend,
                              # the AI's file, an obec), plus Ruby Liquid vs liquidjs
node scripts/render.mjs out.html --view next_48h --okres CZ0642 --lang cs
node scripts/render.mjs out.html --ai 1 --obec CZ0525/spindleruv-mlyn
npm run screenshots           # screenshots/ with headless Chrome (live data)
npm run settings              # regenerate src/settings.yml from MeteoVerdict's okres list
```

- **Edit in `src/`.** `src/shared.liquid` holds the settings, the polling inputs (one file,
  or `IDX_0` and `IDX_1` with an obec), the labels in both languages, the icons and the
  styles. `src/views/days.liquid` draws the views (two days, five days, 24 and 48
  hours) from one loop over the days, and `src/partials/` holds the pieces they share: a
  day's numbers, the icons, the hourly chart, the threshold badges and the footer.
- **Pixel-exact charts.** The charts are SVGs at their real size on the 800 × 480 panel
  (no stretched viewBox), so the night's dot screen and the lines land on whole pixels.
- **`dist/` is for pasting.** TRMNL wants one self-contained template per layout, so
  `npm run build` inlines every `{% include %}` and strips the comments. Commit `dist/`
  together with `src/`. The layout leaves out the `view view--full` wrapper,
  because TRMNL adds it. `scripts/render.mjs` adds it too.
- **Recipe checks.** `scripts/recipe.test.mjs` runs the checks of TRMNL's recipe linter
  that can run locally, and prints the inline-style count it limits.
- **Two Liquid engines.** Rendering and most tests use [liquidjs](https://liquidjs.com), but
  TRMNL runs Ruby Liquid. So `scripts/render.rb` renders the same layouts with the `liquid`
  gem in strict mode, and a test checks that both engines produce the same text. CI
  installs Ruby for this. The templates stick to what both engines support: for example,
  no filters inside `if` conditions or `[]` indices.
- **Data:** the open data files are documented in MeteoVerdict's
  [open data docs](https://github.com/JerryWoof/MeteoVerdict/blob/main/docs/open-data.md).
  The October 2026 refresh is planned in [`docs/plan-2026-10-refresh.md`](docs/plan-2026-10-refresh.md).

## Data sources and licences

- **Code:** [MIT](LICENSE).
- **Forecast data:** © MeteoVerdict, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/),
  including the MeteoVerdict AI output. It is built from [Open-Meteo.com](https://open-meteo.com/)
  (CC BY 4.0) with the models of DWD, ECMWF, NOAA, Météo-France, GeoSphere Austria, KNMI,
  DMI, ČHMÚ, Environment and Climate Change Canada, the Japan Meteorological Agency, the
  China Meteorological Administration and the UK Met Office (CC BY-SA 4.0), and from ČHMÚ
  observations (CC BY 4.0). Boundaries: ČÚZK (CC BY 4.0). Obec elevations: Copernicus DEM
  GLO-90. The footer of every layout credits MeteoVerdict.
- **Non-commercial.** MeteoVerdict uses Open-Meteo's free, non-commercial API, so this
  plugin is free and without ads, and stays that way.
- **Thresholds, not warnings.** Only ČHMÚ issues weather warnings in Czechia (Act 262/2024
  Sb.); the badges are MeteoVerdict's thresholds.

A non-commercial, independent project, not affiliated with TRMNL, ČHMÚ or Open-Meteo.
