# MeteoVerdict for TRMNL

Weather for your Czech district on a [TRMNL](https://trmnl.com) e-ink display: today and
tomorrow, the next 24 hours or five days, with temperature, rain, sunshine, clouds, wind,
sunrise and sunset. In English or Czech.

![Today and tomorrow in Prague](screenshots/today-tomorrow.png)

The forecast is [MeteoVerdict](https://jerrywoof.github.io/MeteoVerdict/)'s. Every day,
MeteoVerdict checks how well 11 weather models forecast what ČHMÚ stations then measured,
and blends them, weighting each model by how accurate it has been in your okres over the
last 90 days. So you get a forecast tuned for where you live rather than one model's
opinion. Free, no API key.

## Views

A weather display gets a glance on your way out, so each view answers one question:
*what's today like, and tomorrow?*, *when will it rain?*, *what does the week look like?*
Pick the view for the full screen in the plugin's settings.

### Today and tomorrow

Two days side by side. For each:
- the symbol, high and low, and a one-word summary;
- rain with its chance, hours of sunshine out of the day's daylight, cloud cover and wind;
- sunrise and sunset;
- night, morning, afternoon and evening, each with its own symbol;
- the hourly temperature curve, with rain bars, the night hatched and a dashed line at the
  current time.

### Next 24 hours

![The next 24 hours in Prague](screenshots/next-24-hours.png)

For "do I need an umbrella?":
- the temperature now;
- a plain sentence about rain: *Rain from 15:00*, *Rain until 20:00*, or *Dry for the next
  24 hours*;
- the next sunset and sunrise, and tomorrow in one line;
- every 3 hours, a symbol, the temperature and the rain, over the hourly curve.

### 5 days

![Five days in Prague](screenshots/five-days.png)

For planning the week:
- each day's symbol, high and low, rain, sunshine and wind;
- one continuous temperature curve over the five days;
- a closing line naming the warmest, wettest and sunniest day.

### Czech

![Dnes a zítra v Brně](screenshots/today-tomorrow-cs.png)

Every view also comes in Czech (*Jazyk: Čeština*), with Czech day and month names and
decimal commas.

## Sharing the screen

TRMNL can split the screen between plugins. Each split size has its own compact layout,
so you can show two or four places at once, or the weather next to your calendar.

| Half, wide: today and the next four days | Half, tall: today in detail, tomorrow in a line |
|---|---|
| ![Praha and Brno](screenshots/mashup-half-horizontal.png) | ![Praha and Ostrava](screenshots/mashup-half-vertical.png) |

| Quarter: today at a glance, tomorrow in a line |
|---|
| ![Praha, Brno, Ostrava and Plzeň](screenshots/mashup-quadrants.png) |

## Install

Until the recipe is published, add it as a private plugin. That takes about five minutes.

1. In TRMNL go to **Plugins → Private Plugin → Add new**, name it, e.g. *MeteoVerdict*.
2. **Strategy:** Polling. **Polling URL:**

   ```
   https://jerrywoof.github.io/MeteoVerdict/api/v1/okresy/{{ okres }}.json
   ```

   `{{ okres }}` is filled in from the form in step 3.
3. **Form fields:** paste [`src/settings.yml`](src/settings.yml). It creates four fields:
   - **Okres:** a dropdown of all 77;
   - **View:** what the full screen shows;
   - **Place name:** optional;
   - **Language:** English or Czech.

   Save, fill in the form and save again.
4. **Edit Markup:** paste each file from [`dist/`](dist) into its tab:

   | Tab | File |
   |---|---|
   | Full | [`full.liquid`](dist/full.liquid) |
   | Half Horizontal | [`half_horizontal.liquid`](dist/half_horizontal.liquid) |
   | Half Vertical | [`half_vertical.liquid`](dist/half_vertical.liquid) |
   | Quadrant | [`quadrant.liquid`](dist/quadrant.liquid) |

   Then click **Force Refresh**.
5. **Refresh rate:** hourly. The forecast itself changes twice a day, but the 24-hour view
   and the "now" line move with the clock.
6. Add the plugin to a playlist, or to a mashup.

Times follow the time zone of your TRMNL account.

## What's on the screen, and how far to trust it

| Value | Where it comes from |
|---|---|
| Temperature, rain, wind | MeteoVerdict's blend of 11 models, weighted and bias-corrected per okres and lead day ([methodology](https://github.com/JerryWoof/MeteoVerdict/blob/main/docs/methodology.md)) |
| Chance of rain | The weighted share of the models that forecast at least 0.2 mm for that period |
| Clouds, sunshine | The plain average of the models. Not checked against observations, and the models disagree a lot on sunshine |
| Sunrise, sunset | Calculated for the okres's forecast point (NOAA solar equations) |
| Symbol | Rain, sleet or snow when likely; showers at a 30 % chance; otherwise by cloud cover |

The forecast is for one point per okres, so in a large or hilly okres your village can
differ from it, especially in temperature at night.

The forecast updates at about 06:00 and 18:00 UTC. The footer shows when it was last
updated and how many models went into it.

## Develop

```bash
npm ci
npm run build                 # src/ → dist/ (inlines the includes)
npm test                      # every layout, view and language against saved data
node scripts/render.mjs out.html --view next_24h --okres CZ0642 --lang cs
npm run screenshots           # screenshots/ with headless Chrome (live data)
npm run settings              # regenerate src/settings.yml from MeteoVerdict's okres list
```

- **Edit in `src/`.** `src/shared.liquid` holds the settings, the labels in both languages,
  the icons and the styles. `src/views/` holds the three full-screen views, and
  `src/partials/` the pieces they share: a day's numbers, the icons, the hourly chart and
  the footer.
- **`dist/` is for pasting.** TRMNL wants one self-contained template per layout, so
  `npm run build` inlines every `{% include %}` and strips the comments. Commit `dist/`
  together with `src/`.
- **Rendering and tests use [liquidjs](https://liquidjs.com).** TRMNL runs Ruby Liquid, so
  the templates stick to what both support. For example, no filters inside `if` conditions.
- **Data:** the open data files are documented in MeteoVerdict's
  [open data docs](https://github.com/JerryWoof/MeteoVerdict/blob/main/docs/open-data.md).

## Licence

- **Code:** [MIT](LICENSE).
- **Forecast data:** © MeteoVerdict, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
  It is built from [Open-Meteo.com](https://open-meteo.com/) (CC BY 4.0) with models of
  DWD, ECMWF, NOAA, Météo-France, GeoSphere Austria, KNMI, DMI, ČHMÚ and the UK Met
  Office, and from ČHMÚ observations (CC BY 4.0). The footer of every layout credits
  MeteoVerdict.

A non-commercial, independent project, not affiliated with TRMNL, ČHMÚ or Open-Meteo.
