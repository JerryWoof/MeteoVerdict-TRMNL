# Jak aktualizovat plugin na zařízení TRMNL

Platí pro soukromý plugin MeteoVerdict (Plugins → Private Plugin) po změně formátu dat
z 23. 10. 2026. Šablony teď čtou nový formát (`forecast.model`, `forecast.sources`,
`forecast.hourly`, `forecast.parts`, bez bloku `models`), takže stačí **vložit nové
šablony**. Polling URL ani formulář se měnit nemusí.

> Dokud šablony nepřekopírujete, starý plugin dál funguje, jen v patičce kombinované
> předpovědi zmizí počet modelů (blok `models` v datech už není). Aktualizace je tedy bez
> spěchu; nové šablony už počet modelů nehledají a patička říká jen `MeteoVerdict`.

## 1. Co aktualizovat

Čtyři soubory z adresáře [`dist/`](../dist) v nejnovější verzi repa (větev `main` po sloučení
tohoto PR): `full.liquid`, `half_horizontal.liquid`, `half_vertical.liquid`,
`quadrant.liquid`. Případně stáhněte repo (`git pull`, nebo na GitHubu **Code → Download ZIP**).

Formulář (`src/settings.yml`) se změnil jen v popisu pole *Forecast*; vkládat ho znovu
není nutné (viz krok 3).

## 2. Postup v TRMNL

1. Přihlaste se na [usetrmnl.com](https://usetrmnl.com), **Plugins → Private Plugin** a
   otevřete plugin *MeteoVerdict*.
2. Zkontrolujte **Polling URL**. Má být přesně:

   ```
   https://meteoverdict.cz/api/v1/{{ forecast_model }}/{{ okres_code }}.json
   ```

   `{{ forecast_model }}` a `{{ okres_code }}` doplní formulář (krok 3). Jestli tam máte
   starou adresu `…/api/v1/okresy/{{ okres_code }}.json`, funguje dál (kombinovaná
   předpověď), ale pro MeteoVerdict AI ji přepište na adresu výše. U pluginu s obcí (dvě
   adresy na dvou řádcích) nic neměňte, jen zkontrolujte, že obě adresy mají stejné
   pořadí `ai/` nebo bez něj:

   ```
   https://meteoverdict.cz/api/v1/ai/okresy/CZ0525.json
   https://meteoverdict.cz/api/v1/ai/obce/CZ0525/spindleruv-mlyn.json
   ```

3. **Formulář (Form fields):** pole *Forecast* nabízí „MeteoVerdict AI“ (hodnota
   `ai/okresy`, výchozí) a „MeteoVerdict (all models combined)“ (`okresy`). Nic dalšího
   se nemění. Chcete-li aktuální popisy, vložte do editoru formuláře znovu
   [`src/settings.yml`](../src/settings.yml), uložte a pak v hlavním formuláři znovu
   zkontrolujte *Okres*, *Forecast*, *View*, *Language* a uložte (po vložení YAML
   TRMNL hodnoty někdy vynuluje).
4. **Edit Markup:** v každé záložce označte obsah (Ctrl/Cmd + A), smažte ho a vložte
   odpovídající soubor:

   | Záložka | Soubor |
   |---|---|
   | Full | `dist/full.liquid` |
   | Half Horizontal | `dist/half_horizontal.liquid` |
   | Half Vertical | `dist/half_vertical.liquid` |
   | Quadrant | `dist/quadrant.liquid` |

   Soubory nesmí mít víc než 100 kB (největší, `full.liquid`, má asi 90 kB). Vložte vždy
   celý soubor včetně úvodního komentáře a `<style>`. Uložte (**Save**).
5. Klikněte na **Force Refresh**. TRMNL znovu stáhne data a vykreslí náhled.
6. Zařízení si novou obrazovku vezme při příštím probuzení podle *Refresh rate* (doporučeno
   hodinově). Chcete-li to hned: v **Devices** na svém zařízení stiskněte tlačítko
   (krátce) pro obnovení, nebo počkejte na další cyklus.

## 3. Jak ověřit

- V náhledu pluginu (záložky Full, Half…, Quadrant) nejsou texty `Liquid error`, `NaN`,
  `undefined`, `{{`; všude jsou čísla s `°`.
- **Patička** celé obrazovky vpravo: `MeteoVerdict AI · HH:MM` (výchozí) nebo
  `MeteoVerdict · HH:MM` (kombinovaná předpověď). Čas je aktuální český čas. Nesmí tam
  být `0 models` ani prázdné místo.
- V pohledu *5 dní* a *Dnes a zítra* mají maxima od zítřka „±“ (např. `11° ±2`), u obou
  předpovědí.
- Odznaky (*Mráz*, *Déšť*, *Nárazy*) jsou prahy MeteoVerdictu, ne výstrahy ČHMÚ.
- Pokud je vlevo dole `old forecast` / `stará předpověď`: data jsou starší než 30 hodin;
  zkontrolujte https://meteoverdict.cz/api/v1/ai/okresy/CZ0100.json (pole
  `forecast.generated`), případně Polling URL.
- Chyba „no data“ / prázdná obrazovka: otevřete Polling URL s vaším kódem okresu v prohlížeči.
  Soubor musí existovat (`CZ0100`, velkými písmeny) a mít `forecast.hourly` a
  `forecast.parts`.

## 4. Vrácení zpět

Předchozí šablony jsou v historii gitu (`git log -- dist/`); vložte je stejným postupem.
