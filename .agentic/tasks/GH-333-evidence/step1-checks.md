# Step 1 checks

- `pytest tests/design`: green. The guard reads the English drawings through `in_spanish`;
  `spanish_label_problems` flags a Spanish product label left on a drawing, and
  `test_the_analisis_guard_rejects_a_spanish_product_label` feeds it six (a cost line, the best week, the
  grams given away, the pending note, the month heading, the grouped heading) on both drawings.
- `npm --prefix web run test -- src/design`: 238 passed.
- `scripts/design/compare.sh --strict` (full registry, 173 screens, fresh sample): exit 0, all 173 rows
  `ok`, no notes. The four Analysis rows (Analisis, AnalisisOscuro, AnalisisCompu, AnalisisCompuOscuro)
  included. (A first run had 59 Onboarding*/Inicio* rows with browser-closed notes and exited non-zero;
  this rerun is the one that counts.)
- Changed `section` keys: none (no `screens.json` section names an Analysis label).
- Base evidence: base-mobile-targets.json, base-compare-counts.txt, base-attribution.md (read from the base
  DOM; raw nodes in base-dom-nodes.json), step1-inventory.md.
- Not mine: `ruff format --check .` reports 62 files on the base, among them `test_sample_app.py`
  (untouched here); the declared `lint` is `ruff check .`, which passes.
