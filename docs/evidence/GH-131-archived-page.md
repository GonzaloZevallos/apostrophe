# GH-131 evidence: the archived variety's page, before and after

Review evidence only (ADR-0042 and its before-run amendment). No product code. Images stay in the run's scratch directories and are attached to the PR, never committed.

## Setup

- Base SHA: `6956624` (`69566240b6fc2660d20e67100fdb91a99527fd68`, `origin/master`, merged into the branch at its start). Exported with `git archive` to a scratch directory.
- Head SHA: `2e1cdc1be46fb0687661a622331b9efe529369a5` (the branch with all four dependencies merged: `registry`, `critical-kind`, `archived-page-sections`, `restore-landing`).
- `@fontsource/plus-jakarta-sans`: 5.3.0, one install (the worktree's `web/node_modules`, linked into both copies).
- Overlay: head's whole `scripts/design/` over the base's own `app/` and `web/`. Its diff stat against the base equals `git diff --stat 6956624..2e1cdc1 -- scripts/design`, and the two `scripts/` trees are byte-identical (`diff -rq`):

```
 scripts/design/capture_muestra.py | 30 ++++++++++++++++++++++++++++++
 scripts/design/sample_app.py      | 15 +++++++++++++++
 scripts/design/screens.json       | 18 ++++++++++++------
 3 files changed, 57 insertions(+), 6 deletions(-)
```

- **One addition to the overlay, outside `scripts/design/`.** The base has no drawing for `Archivadas`, `ArchivadasCompu`, `VariedadArchivada` and `VariedadArchivadaCompu` (`pantallas/*.dc.html`), and head's registry names them: the first base run stopped at `assertScreens` ("ArchivadasOscuro: design Archivadas has no pantallas/Archivadas.dc.html"). Those four files were copied from head into the base copy, and nothing else. So for those four drawings, the design side is the same file on both sides (design AE 0 says nothing about them), and the base's `app/` and `web/` were never patched. `VariedadDetalle.dc.html` stays the base's own.
- Captures: `scripts/design/compare.sh --strict` over the whole registry (147 rows, file order, no `--only`), each side on a fresh sample, both seeded on 2026-10-16 (Argentina). Both exit 0, 147 rows `ok` on each side. The base run was repeated once after the drawings fix above (the first, failed attempt wrote no captures); the head run is the first.
- `node scripts/design/ae.mjs <before> <after>` over all 147 rows: `docs/evidence/GH-131/ae-full.txt` (294 lines, AE 0 lines included, scratch paths stripped).

## What may differ

Only rows on this list: every `Variedades*` row, every `Archivadas*` row, the "Todas las entradas" rows and the eight archived rows.

## Difference table (every non-zero line)

| Screen | Side | Result | Class |
| --- | --- | --- | --- |
| Archivadas | built | AE 39508 | intended (Archivada Insignia, Oculta, Restaurar with icon and word) |
| ArchivadasOscuro | built | AE 39615 | intended, same |
| ArchivadasCompu | built | AE 610778 | intended (two panes, the archived page in the right pane) |
| ArchivadasCompuOscuro | built | AE 612284 | intended, same |
| VariedadArchivada | built | FAIL different dimensions | intended (read-only sections; the page is taller) |
| VariedadArchivadaOscuro | built | FAIL different dimensions | intended, same |
| VariedadArchivadaCompu | built | AE 610778 | intended (same capture as ArchivadasCompu: the first archived variety selected) |
| VariedadArchivadaCompuOscuro | built | AE 612284 | intended, same |
| VariedadDetalle | design | FAIL different dimensions | intended design change, **not on the list above**: head's `VariedadDetalle.dc.html` now holds two frames (variety with history, and variety with no history with the critical "Eliminar variedad"), so the drawing is taller. Built is AE 0. |
| VariedadDetalleOscuro | design | FAIL different dimensions | same |

Every other line, 284 of 294, is AE 0: no `Variedades*` row differs (the head's sample seeds the archived variety on both sides, so "Archivadas (1)" is drawn on both), and no "Todas las entradas" row differs. The built `VariedadDetalle` is AE 0: no registry row reaches a variety with no history, so **there is no capture of the critical delete trigger**; it is judged by its front test and the drawing.

## Looked at (compare.sh sheets, light theme)

`VariedadArchivada`, `Archivadas`, `ArchivadasCompu` after, and `VariedadArchivada` before, side by side with the drawing. The dark sheets, `VariedadArchivadaCompu` and `VariedadDetalle` were not opened (turn cap); their numbers are in the table. Against the drawing, the after sheets show:

- Known design defects (drawing data, not code): the drawing says 25 g with "Avisame abajo de 10 g", % índica 60, "Frutal y dulce" and 28/08; the sample seeds 15 g, 40 %, "Frutos rojos" and 06/09. The sample's figures are what `muestra.md` records.
- Known design defect, already an open finding: the built "En el catálogo" card is a two-column grid labelled "Mostrar en el catálogo" with "40 %"; the drawing is one column labelled "Catálogo" with the bare figure.
- Built section headings have more vertical air than the drawing's (the page is about 100 px taller).

The before sheet shows the defects this task fixes: "ok · Archivada" in the status colour, a secondary Restaurar, and no threshold, catalog or Oculta.

## Result

No difference found outside the list except the `VariedadDetalle` drawing, which is the drawings subtask's intended edit. No regression found.

## Notes added at merge

- Master moved after the captures (PR #259, `83fae65`, 23:28 Argentina time) and was merged into the branch at `8b0533f`, so the branch contains `origin/master`. The incoming changes are documentation only (`docs/evidence/GH-247/`, `docs/product/design-capture.md`): no file under `app/`, `web/` or `scripts/` changed, so the captures stay valid. The head SHA the captures used stays `2e1cdc1`.
- The `VariedadDetalle` and `VariedadDetalleOscuro` design-side difference comes from the planned `drawings` change, which the brief's "what may differ" list does not name. Planned, not a defect.
