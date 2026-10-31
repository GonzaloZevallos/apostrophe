---
status: accepted
date: 2026-10-07
---

# `muestra.md` is rendered from the seed at a pinned date, and the screens are checked against it

The design README says every La Huerta figure on a screen comes from `muestra.md`. Nothing
held the screens to it: after the seed grew (an adjustment, withdrawals) `muestra.md` and the
screens drew different businesses, and Análisis drew figures that were in neither the seed
nor the file (GH-90).

## Decision

- **The date is pinned and the script is the only author.** The seed dates every record
  `ago(n)` from the day it runs, so a capture taken on the real day goes stale by itself.
  `scripts/design/capture_muestra.py` seeds an in-memory app at the date `muestra.md` states
  on its `Capturada:` line (07/10/2026, a Wednesday) and prints every table from API answers,
  adding only format. Nobody types a figure.
- **A byte-for-byte check.** `tests/design/test_muestra_seed.py` renders at the stated date
  and compares with the file's generated section.
- **The screens are read as visible text.** `tests/design/muestra_guard.py` drops comments,
  `<script>` and `<style>`, turns every tag and every ` · ` into a break, and works over those
  parts with regexes. It is not an HTML parser.
- **A period is keyed on the range it shows** ("Hoy 07/10", "05/10 – 11/10"; on Análisis the
  month heading, each week's range or start date, and "Desde el primer registro"), never on a
  marker: no screen has a comment, and nothing proves the design tool keeps one. A range
  belongs to the tab bar nearest to it and must be its selected tab's.
- **Labels and order.** Each known label is paired with the value next to it and compared with
  the row `muestra.md` has for that period. On Inicio the cost lines are exactly the ones it
  has, in its order, with the pending note under exactly the pending ones. A right figure under
  the wrong period fails.
- **Entities, dates, denylist.** A variety's name is paired with its status, grams, detail,
  days left and price; a customer with their balance and "desde"; a sale row, "Venta del
  dd/mm", an account row and a sale line with the rows of their tables. Every dd/mm must be in
  `muestra.md`, and a full date must be the capture date. A denylist of stale literals is kept
  per family.
- **Families are switched on by the piece that fixes them.** `tests/design/muestra_families.py`
  declares `inicio`, `variedades`, `ventas`, `analisis` and a reserved `otras`, each with no
  screens until its own piece lists them in its own entry, so parallel pieces never edit the
  same lines. A family with no screens passes.
- **What a seed change costs:** recapture `muestra.md` with the script, then fix the screens
  the guard names.

## Known risks

- The captured dates age against the real calendar: the screens say "Hoy 07/10" forever.
- `scripts/design/compare.sh` runs the live app on the real date, so it judges layout and
  never figures.
- Figures or colours set by an inline script are invisible to the guard.
- A screen that shows no range for a period fails loudly, and needs a copy decision, not a
  quieter guard.

## Amendment (GH-526): the muestra pause

Los dibujos del rediseño del 29/10/2026 se copiaron a `pantallas/` tal cual, y un dibujo no se
edita para que pase un test. Cinco de los siete dibujos que el guard de `muestra.md` lee ya no
muestran las cifras de la muestra: `Inicio`, `InicioOscuro`, `InicioCompu`, `Analisis` y
`AnalisisCompu`. Por decisión del PM, la concordancia de cifras con `muestra.md` se pausa solo
para esos archivos, hasta que su pieza del rediseño (#497 para Inicio, #321 para Análisis)
actualice la muestra o el dibujo.

- **`PAUSED_CEILING`** (`tests/design/muestra_families.py`) es un literal propio, nunca
  calculado a partir de `PAUSED`: pares (archivo, issue del README del rediseño). Solo admite
  `Inicio`, `InicioOscuro`, `InicioCompu`, `VentaDetalle`, `ClienteFicha`, `Analisis` y
  `AnalisisCompu`.
- **`PAUSED`** es la lista de archivos pausados. `pause_problems` la rechaza si tiene un nombre
  fuera del tope, un duplicado, un archivo que no existe o un issue que no es un entero
  positivo; un test la corre sobre el árbol real.
- **Qué se salta:** solo la concordancia de cifras, es decir los `CHECKS` de la familia. Siguen
  aplicando las fechas (`date_problems`), la lista de literales prohibidos y todo lo demás que
  el guard revisa, incluida la revisión de rótulos en inglés de Análisis
  (`spanish_label_problems`, GH-333), que es una función aparte. `check_screen` no cambia: la
  pausa vive en `test_muestra_screens.py`, que llama a esas revisiones directamente para un
  archivo pausado. Un test falla si un archivo pausado ya concuerda con la muestra: se quita de
  la lista.
- **Solo puede achicarse.** Agregar un archivo exige tocar el tope literal, que está acotado a
  los siete dibujos y a un issue del README; nunca se edita `muestra.md`, `check_screen` ni una
  lista de prohibidos para que pase un test.
