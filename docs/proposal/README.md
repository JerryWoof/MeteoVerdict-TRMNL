# Návrhy dashboardu (historie)

Mockupy z října 2026, ze kterých vznikla dnešní podoba pohledů. Nic z toho už není třeba
spouštět; slouží jako záznam rozhodnutí.

- `v2/` (výběr vlastníka): **Příštích 24 hodin**, **48 hodin**, **Dnes a zítra** a **5 dní**
  ve stylu dnešních obrazovek (`24-hours.png`, `48-hours.png`, `2-days.png`, `5-days.png`).
  Implementováno v `src/views/days.liquid`. Generuje je `v2.mjs`.
- první návrh (`2-days`, `3-days`, `5-days`, `build.mjs`): hodinový průběh, části dne s
  teplotním pásem, týdenní přehled. Zamítnuto, 3 dny se neimplementovaly.

Pravidlo všech variant: nahoře to nejdůležitější velké, ostatní nenápadně, upozornění
„Odznaky nejsou výstrahy ČHMÚ“, když je na obrazovce odznak.
