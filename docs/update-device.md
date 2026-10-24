# Jak aktualizovat plugin na zařízení TRMNL

Platí pro soukromý plugin MeteoVerdict (Plugins → Private Plugin) po změně z 24. 10. 2026:
nový formát dat MeteoVerdictu (bez bloku `models`) a nové pohledy. Plugin má teď **jen
celoobrazovkové rozvržení (záložka Full)** a čtyři pohledy: *Dnes a zítra*, *Příštích 24
hodin*, *Příštích 48 hodin* a *5 dní*. Pohled *Víkend* a rozvržení pro půl a čtvrt
obrazovky zmizely.

## 1. Co aktualizovat

- [`dist/full.liquid`](../dist/full.liquid) (asi 60 kB) do záložky **Full**.
- Formulář [`src/settings.yml`](../src/settings.yml): změnil se seznam pohledů (přibyl
  *Next 48 hours*, zmizel *Weekend*) a popisy.

Soubory získáte z větve `main` repa (`git pull`, nebo na GitHubu **Code → Download ZIP**).

## 2. Postup v TRMNL

1. Přihlaste se na [usetrmnl.com](https://usetrmnl.com), **Plugins → Private Plugin** a
   otevřete plugin *MeteoVerdict*.
2. **Polling URL** zůstává, má být přesně:

   ```
   https://meteoverdict.cz/api/v1/{{ forecast_model }}/{{ okres_code }}.json
   ```

   Máte-li ještě starou adresu `…/api/v1/okresy/{{ okres_code }}.json`, funguje dál
   (kombinovaná předpověď); pro MeteoVerdict AI ji přepište na adresu výše. U pluginu s
   obcí (dvě adresy na dvou řádcích, obě buď s `ai/`, nebo obě bez) nic neměňte.
3. **Formulář (Form fields):** smažte obsah editoru, vložte celý `src/settings.yml` a
   uložte. TRMNL po vložení někdy vynuluje hodnoty, proto v hlavním formuláři znovu
   zkontrolujte *Okres*, *Forecast*, **View** (výchozí *Today and tomorrow*; vyberte
   *Next 24 hours*, *Next 48 hours* nebo *5 days*), *Language*, *Wind speed in* a
   uložte. Pole *View* s hodnotou `weekend` už neexistuje: nastavte jinou.
4. **Edit Markup:** v záložce **Full** označte celý obsah (Ctrl/Cmd + A), smažte ho a
   vložte `dist/full.liquid` včetně úvodního komentáře a `<style>`. Ostatní záložky
   (Half Horizontal, Half Vertical, Quadrant) vyprázdněte nebo ponechte, nepoužívají se.
   Uložte (**Save**). Soubor nesmí mít víc než 100 kB.
5. Klikněte na **Force Refresh**; TRMNL znovu stáhne data a vykreslí náhled.
6. Zařízení si novou obrazovku vezme při příštím probuzení podle *Refresh rate*
   (doporučeno hodinově). Hned: v **Devices** u zařízení vyvolejte obnovení.

### Obec místo okresu

Nové pole formuláře **Obec** (po vložení `settings.yml`): id obce v okrese vybraném v poli
*Okres*, tedy název malými písmeny bez diakritiky, s `-` místo mezer (např. `velemin` u
okresu Litoměřice). Polling URL má pak dva řádky:

```
https://meteoverdict.cz/api/v1/{{ forecast_model }}/{{ okres_code }}.json
https://meteoverdict.cz/api/v1/{{ forecast_model | replace: "okresy", "obce" }}/{{ okres_code }}/{{ obec }}.json
```

Filtr `replace` v polling URL funguje (ověřeno: z `ai/okresy` udělá `ai/obce`). Bez vyplněné
obce druhá adresa neexistuje (`…/CZ0423/.json`), proto pro samotný okres nechte jen první
řádek. Obec bez pole lze dál zadat i ručně: dva řádky s pevným okresem a obcí.

## 3. Jak ověřit

- V náhledu záložky Full nejsou texty `Liquid error`, `NaN`, `undefined`, `{{`.
- **Patička** vpravo: `MeteoVerdict AI · HH:MM` (výchozí) nebo `MeteoVerdict · HH:MM`
  (kombinovaná předpověď). Čas je aktuální český čas. Odznaky (*Mráz*,
  *Déšť*, *Nárazy*) jsou v hlavičce dne; jsou-li dva, „Tomorrow“ se zkrátí na „Tmrw“, a kdyby to nestačilo, datum se uřízne. Datum je vždy krátké (24 Oct); v pohledech 24 h, 48 h a 5 dní stojí před ním plný název dne (Saturday), v Dnes a zítra zkratka (Sat).
- *Příštích 24 hodin*: hlavička s rozsahem dnů (`sobota 24. října → neděle 25. října`),
  šest údajů (srážky, slunce, oblačnost, vítr s nárazy, tlak, vlhkost) a graf s časovou
  osou. *48 hodin* je stejné, s popisky po 6 hodinách.
- *Dnes a zítra* a *5 dní*: maxima od zítřka mají „±“; vítr má nárazy.
- Pokud je vlevo dole `old forecast` / `stará předpověď`, jsou data starší než 30 hodin;
  zkontrolujte https://meteoverdict.cz/api/v1/ai/okresy/CZ0100.json (`forecast.generated`)
  a Polling URL.
- Prázdná obrazovka: otevřete Polling URL s kódem svého okresu v prohlížeči. Soubor musí
  existovat (`CZ0100`, velkými písmeny) a mít `forecast.hourly` a `forecast.parts`.

## 4. Vrácení zpět

Předchozí šablony jsou v historii gitu (`git log -- dist/`); vložte je stejným postupem.
