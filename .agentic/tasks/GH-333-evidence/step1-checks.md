# Step 1 checks

- `pytest tests/design`: green (guard reads the English drawings through `in_spanish`; mutation tests use the new words).
- `npm --prefix web run test -- src/design`: 238 passed.
- `scripts/design/compare.sh --strict` (full registry, 173 screens, fresh sample): the four Analysis rows
  (Analisis, AnalisisOscuro, AnalisisCompu, AnalisisCompuOscuro) captured with no notes. 59 other rows
  (Onboarding*, Inicio*) carry "browser has been closed / Failed to find context" notes, a browser crash
  mid-run that touches no Analysis file, so `--strict` exited non-zero. Not rerun in this run (turn cap):
  the delivery gate or the next run should repeat it.
- Changed `section` keys: none (no `screens.json` section names an Analysis label).
- Base evidence: base-mobile-targets.json, base-compare-counts.txt, base-attribution.md (regions inferred, see its header), step1-inventory.md.
