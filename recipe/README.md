# Publishing MeteoVerdict as a TRMNL Recipe

Everything needed to submit the plugin as a public [Recipe](https://trmnl.com/recipes):
the texts for TRMNL's forms, the icon, and a checklist. The plugin is **not published
yet**. You submit it from TRMNL yourself; the TRMNL team then reviews it.

> **One open blocker.** TRMNL's linter (Chef) allows at most 6 uses of `padding`,
> `margin`, `font-size`, `text-align`, `justify-content`, `border-radius`,
> `background-color` and `object-fit` in all the markup together, including CSS in
> `<style>` blocks. The plugin has 212 (`npm test` prints the count). Everything else
> Chef checks passes. See [The inline-style check](#the-inline-style-check) for the options.

## Files

| File | What it's for |
|---|---|
| [`icon.png`](icon.png) | The recipe icon, 512 × 512 PNG, black on white. Upload it in the plugin's settings |
| [`icon.svg`](icon.svg) | Its source. Re-export: `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars --force-device-scale-factor=1 --window-size=512,512 --screenshot=recipe/icon.png file://$PWD/recipe/icon.svg` |
| [`../src/settings.yml`](../src/settings.yml) | Form fields, now with the *About This Plugin* field: the recipe's public description, categories and links |
| [`../dist/`](../dist) | The four layouts to paste into **Edit Markup** |

The icon is a sun half behind a cloud, with a tick on the cloud for the verdict. The
strokes are thick so it still reads at the 28 to 40 px TRMNL shows icons at. TRMNL does not
publish an icon size. Recipe icons on trmnl.com are square PNGs (512 × 512 and
2000 × 2000 both occur), so 512 × 512 is a safe choice.

## Texts to paste

**Name** (the private plugin's name becomes the recipe's; Chef wants a capital first
letter and at most 50 characters):

```
MeteoVerdict
```

**Description.** A recipe's public description is the `description` of its
`author_bio` form field. It is already in [`src/settings.yml`](../src/settings.yml) (the
`about` field), so pasting the form fields sets it. It is about 160 words: TRMNL says that
under 100 words the recipe page is left out of Google and other search engines. It is
written in English with one Czech line:

> Weather for your Czech district (okres) on your TRMNL: today and tomorrow, the next 24
> hours, five days or the weekend, with temperature and its range, rain with its timing
> and chance, sunshine, clouds, wind, sunrise and sunset, and badges for frost, ground
> frost, heavy rain, gusts and heat. Compact layouts for half and quarter screens let you
> show two or four places at once, or the weather next to your calendar.
>
> The forecast is MeteoVerdict's. Every day it checks how well about 20 weather models
> forecast what ČHMÚ stations then measured, and blends them, weighting each model by how
> accurate it has been in your okres over the last 90 days. By default the temperature and
> wind come from MeteoVerdict AI, its own AI model. Free, no API key, no account.
>
> Počasí pro váš okres podle MeteoVerdictu, česky i anglicky.
>
> The badges are MeteoVerdict's thresholds, not official ČHMÚ warnings (chmi.cz). Questions
> and bugs: GitHub issues. Forecast data © MeteoVerdict, CC BY-SA 4.0, built from
> Open-Meteo.com, ČHMÚ and the weather services' model data. Not affiliated with TRMNL,
> ČHMÚ or Open-Meteo.

**Short description**, if a form asks for one-liner text:

```
Weather for your Czech okres: MeteoVerdict's blend of about 20 models, tuned per district. English or Czech.
```

**Categories:** `environment,life`, set in the `about` field. TRMNL allows up to two from
[its list](https://trmnl.com/api/categories). There is no weather category, and
*environment* is the closest. Change the second one to `nature` or `travel` if you prefer.

**Links** (also in the `about` field): `github_url` is this repository, which is the
contact point through its issues. `learn_more_url` is the MeteoVerdict site.

**Featured image (the preview screenshot).** TRMNL takes this from the recipe master's
current screen, through a button in the plugin's settings. You don't upload a file. Set
the master up so that screen looks like
[`screenshots/today-tomorrow.png`](../screenshots/today-tomorrow.png): okres *Praha*,
view *Today and tomorrow*, language *English*, place name empty. That is the screen that
best shows what the plugin does.

## Checklist

Do these in order. Steps 1 to 4 set up a separate *recipe master*, so your own plugin and
its settings stay private. TRMNL recommends this, and whatever the master shows becomes
the public preview.

1. **Merge this branch**, so `dist/` and `src/settings.yml` on GitHub are the versions to
   paste.
2. **Create the master.** In TRMNL go to **Plugins → Private Plugin → Add new**. Name it
   `MeteoVerdict`. Make a new one rather than forking a recipe, because Chef rejects forks.
   - **Strategy:** Polling. **Polling URL:**
     `https://jerrywoof.github.io/MeteoVerdict/api/v1/{{ forecast }}/{{ okres_code }}.json`
   - **Fastest refresh rate:** hourly is enough. The forecast changes twice a day, and the
     24-hour view's "now" line moves by the hour.
3. **Form fields:** paste [`src/settings.yml`](../src/settings.yml) and save. Then fill in
   the form: okres *Praha*, view *Today and tomorrow*, place name empty, language
   *English*. Save again.
4. **Edit Markup:** paste each file from [`dist/`](../dist) into its tab (Full, Half
   Horizontal, Half Vertical, Quadrant). Leave **Shared** empty. Click **Force Refresh**.
5. **Preview every layout** in the markup editor on TRMNL OG and on TRMNL X, in
   landscape and, for TRMNL X, in portrait. Check that nothing is cut off. See the open
   questions below about TRMNL X.
6. **Upload the icon:** [`recipe/icon.png`](icon.png), in the plugin's settings.
7. **Featured image:** in the plugin's settings, click the button that sets the current
   screen as the featured image.
8. **Freeze the preview:** keep the master out of every playlist, so TRMNL stops
   regenerating its screen. A preview with an old date is fine; a preview showing your
   own place is not.
9. **Publish:** click the icon next to **Publish plugin?** and choose **Public**. Chef
   runs and lists anything it objects to. Expect the inline-style suggestion until that is
   resolved. If Chef blocks the public submission, choose **Unlisted** to get a shareable
   link right away. You can resubmit as public later.
10. **For your own TRMNL**, install the recipe like any user would, and set your own okres
    and place name there.

After it is published, every change to the master goes out to everyone who installed it.
Try changes on a copy first.

## Requirements, and where the plugin stands

Sources: TRMNL's [recipe publishing tips](https://trmnl.com/blog/plugin-recipe-publishing-tips),
[Plugin Recipes](https://help.trmnl.com/en/articles/10122094-plugin-recipes),
[Recipe best practices](https://help.trmnl.com/en/articles/11395668-recipe-best-practices),
[form builder](https://help.trmnl.com/en/articles/10513740-custom-plugin-form-builder),
[demo data](https://help.trmnl.com/en/articles/12772238-demo-data-for-publishing-plugins)
and the [Chef source](https://gist.github.com/ryanckulp/fbe5f68c51db1ae214a97da24be4d62b).
`scripts/recipe.test.mjs` runs the Chef checks that can be run locally.

### Chef (automated)

| Check | Status |
|---|---|
| `author_bio` field present | **Done**: the `about` field |
| `author_bio` has a category | **Done**: `environment,life` |
| Every custom field used in the polling URL or the markup | **Done**: `okres_code` in the URL, the rest in the markup (tested) |
| Featured image | **You**: checklist step 7 |
| Icon | **You**: checklist step 6, [`icon.png`](icon.png) |
| No `view view--full` (etc.) wrapper, because TRMNL adds it | **Done**: removed from all four layouts. The local renderer adds it as TRMNL does |
| Every layout has content | **Done** |
| Not a fork | **You**: create the master fresh (step 2) |
| No `opacity` | **Done**: none (tested) |
| No async JavaScript, no `window.onload` | **Done**: the plugin has no JavaScript |
| `<img>` URLs respond | **Done**: no `<img>`, the symbols are inline SVG |
| Highcharts: animations off, unique ids | **N/A**: the charts are inline SVG |
| Title capitalised, 50 characters or fewer | **Done**: `MeteoVerdict` |
| Webhook plugins need a copyable URL | **N/A**: the plugin polls |
| At most 6 of the 8 layout CSS properties | **Open**: 212. See below |
| *Advisory:* links in field descriptions are HTML `<a>` | **Done**: the `about` field uses `<a href class="underline">` |
| *Advisory:* responsive classes (`lg:`, `portrait:`) | **Not done**: the layouts are sized for 800 × 480. See the open questions |

### Review (manual)

| Guideline | Status |
|---|---|
| Adds value over similar recipes | **Done**: the forecast is tuned per Czech okres, and the description says so |
| Family friendly | **Done** |
| `author_bio` has a way to contact the author | **Done**: `github_url` and the link to the issues |
| `default`/`placeholder` used sensibly; no `optional: false` | **Done**: defaults on view, evening switch, wind and language. A placeholder on the place name. `optional` only on the place name |
| Okres has no default | **Done, on purpose**: TRMNL turns a select default into lower case (`cz0100`), and the files are `CZ0100.json`, so a default would point the polling URL at a missing file. A required field without a default is allowed; installers pick their okres before saving. If the reviewer asks for a default, the fix is `{{ okres_code \| upcase }}` in the polling URL together with `default: cz0100`. Test that on a copy first, since TRMNL doesn't document filters in polling URLs |
| Truthy values work in Liquid | **Done**: the evening switch accepts `true`/`false`, `"true"`/`"false"` and `"no"` |
| No personal information | **Done**: the data is a public forecast. The master uses Praha and no place name (step 3) |
| Polling: public API, no random URLs | **Done**: one static, public, keyless JSON per okres on GitHub Pages |
| Framework and Liquid first, CSS only where needed | **Partly**: Framework `layout`/`title_bar` plus the plugin's own classes. See the inline-style check |
| No inline `opacity`; `label--gray` gets `1bit:text--black` | **Done**: there's no opacity, and Framework gray labels aren't used. Everything is pure black on white |
| Provided fonts | **Done**: Inter, the Framework's font |
| Preview on TRMNL OG and TRMNL X (landscape and portrait) | **You**: step 5 |
| Keep markup DRY with the Shared tab | **Optional**: `dist/` inlines the shared part into each layout, which works but is repeated four times. Moving it into the Shared tab is possible later |

### The inline-style check

Chef counts the words `padding`, `margin`, `font-size`, `text-align`, `justify-content`,
`border-radius`, `background-color` and `object-fit` anywhere in the markup, CSS
included, and asks for 6 or fewer. TRMNL's guide explains the reason: the Framework's
classes should do this styling. The plugin styles its own classes in a `<style>` block
(it uses no `style=""` attributes), and repeats that block in each of the four layouts,
which comes to 212. The options:

1. **Restyle onto Framework classes** (`p--`, `m--`, `text--center`, `flex--between`,
   `rounded--`, `bg--black`, `value--`/`title--` sizes). This is the real fix. It's a big
   change to the look, the Framework's type scale differs from the current pixel sizes,
   and it needs testing on the device again.
2. **Ask TRMNL** (Discord or support) whether a class-based `<style>` block is acceptable
   for a public recipe, or whether the reviewer can override this suggestion.
3. **Publish as Unlisted** now. It needs no Chef pass, you get a shareable link
   immediately, and you can submit it as public later.
