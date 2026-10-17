---
status: accepted
date: 2026-10-17
---

# App text lives in one package and two guards keep it there

GH-53. The app is English and every text the front shows lives in `web/src/copy/`, one keyed
section file per area (`app-text.md`). A convention alone drifts the first time a screen
writes a label inline, so two front guards and a backend guard (written by `backend-text`,
`tests/architecture/test_app_text.py`) keep it. No translation library and no language switch:
Zeta decides on translations later, and this makes that one edit in one place.

## Decision

1. **The package.** `web/src/copy/index.ts` re-exports one section per area; every entry is
   `as const` and a parametrised entry is a function. `LIMITED_COPY` and `LONG_REFUSALS` stay
   per section and `copyLimits.test.ts` lists the sections.
2. **The visible-literal rule** (`web/src/architecture/appText.ts`). `findVisibleLiterals` parses
   every non-test `.ts`/`.tsx` under `web/src` with the TypeScript parser (outside `copy/`,
   `architecture/`, `test/`, `design/` and `routes.ts`) and flags every string, template part or
   JSX text that has a letter, except in a closed list of contexts that show nothing: import and
   export specifiers and dynamic import paths, type positions, `===`/`!==` operands and `case`
   labels, property names and element-access arguments, `className`/`data-*`, a closed list of
   non-visible props, and `Intl.NumberFormat`'s first argument. A context added later joins the
   list with its reason; never a per-file exemption.
3. **The ledgers.** The allowance is one file per owner, `textLeft/<owner>.json`: `shared`,
   `getting-in-settings`, `sales-customers`, `varieties-stock-catalog` and
   `home-analysis-expenses-onboarding`. A file is in exactly one
   (`tests/test_text_ledgers.py`), so parallel subtasks never edit the same list. A ledger only
   shrinks: an offending file in no ledger fails, and so does an entry whose file no longer
   offends. Most entries are not Spanish text but a literal the closed list does not know
   (a URL path, a DOM event name); they leave the ledger when the file stops writing them.
4. **The Spanish rule over `copy/`** (`copySpanish.ts`). A section that does not export
   `PENDING = true` has each value rendered (functions with the `SAMPLES` of the limits),
   NFC-normalised, trimmed and case-folded. It fails when the value equals any value of
   `fixtures/copyBaseline.es.json`, keys ignored, unless the section's `SAME_IN_BOTH` lists it
   with a reason; or when it trips `spanishMarkers.json`, the accented letters and a closed
   stoplist of unambiguous Spanish words that the backend guard reads too. The sample name stands
   for seller data and is never judged.
5. **The locale ban** (`localeBan.ts`). No non-test file under `web/src` uses the `to`-`Locale`
   family or `Intl`'s date-time and relative-time formatters: they answer in the reader's
   language, so every format lives in `web/src/format/` with its own words.
6. **`PENDING` and the ledgers are both removed** by the closing subtask: every section then
   carries the Spanish rule and every ledger is empty.
7. **Design material stays Spanish.** `pantallas/` and `muestra.md` are the design reference for
   structure, not for words; their `section` crops run on the design side only.

## Known risks

- An unaccented Spanish word that is in neither the baseline nor the stoplist passes; review owns it.
- `SAME_IN_BOTH` is a hole by design; each entry carries a reason a reviewer reads.
- Plurals ("1 customers") are covered only by the `SAMPLES` render and review.
- All guards parse or read files and nothing else, so they give the same verdict on any date.
