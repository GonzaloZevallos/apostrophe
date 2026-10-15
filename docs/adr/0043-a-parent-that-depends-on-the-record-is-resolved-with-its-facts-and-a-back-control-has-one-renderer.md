---
status: accepted
date: 2026-10-13
---

# A parent that depends on the record is resolved with its facts, and a back control has one renderer

GH-135 found the chrome worked out in several places: the registry could not say that an
archived variety's page returns to Archivadas, a stock entry form had two parents, and six
pages drew a back arrow of their own beside the shell's. A fact that two files each decide
is eventually decided two ways.

## Decision

- **A parent may depend on the record's state.** `Parent` in `web/src/routes.ts` gains the
  variant `{ live, archived }`. Only `variety` uses it: `{ live: 'varieties', archived:
  'varieties-archived' }`.
- **`parentOf` stays static and total.** Its parameter is `StaticParentId`, every id whose
  parent is not the state variant, derived from the declarations by a conditional type (never
  listed by hand). `parentOf('variety', …)` does not compile.
- **`resolveParent(id, viewport, facts)` answers any id.** `facts` (`ScreenFacts`:
  `archived: 'yes' | 'no' | 'unknown'`, `varietyName: string | null`) is required, so no
  caller can forget it. `'yes'` resolves to the archived side; `'no'` and `'unknown'` resolve
  to the live side, and that rule is written there and nowhere else. When the resolved parent
  is the variety's page its label is the variety's name, or the registry title ("Variedad")
  while the name is unknown. Only `chromeOf` (`web/src/shell/chrome.ts`) calls it. `BackArrow` receives the resolved parent and
  resolves nothing itself. `useScreenFacts` (`web/src/shell/useScreenFacts.ts`) reads the facts
  without fetching: the succeeded detail query, then the `keys.varieties()` and
  `keys.archivedVarieties()` caches, then `'unknown'`.
- **`placeOf` climbs the live side.** A load-time assertion (`parentSidesDisagree`, run when
  `routes.ts` loads) requires both sides of a state-dependent parent to give the same `Place`,
  so a variety's mark never depends on its state. It returns its violations, so a test can
  hand it a registry that breaks the rule.
- **`archived_parent` in `scripts/design/screens.json`** mirrors the variant. The front's
  `routes.test.ts` compares it with `routes.ts` in both directions (a variant with no field
  fails, a field with no variant fails, a different path fails) and `tests/test_static_spa.py`
  checks it is a registered path. There is no exemption list.
- **The three sources of a parent are chained.** `routes.ts` equals `screens.json` (ADR-0033's
  cross-check and the one above), and `tests/design/test_back_table.py` checks every row of
  navigation.md's back-with-no-history table against `screens.json` (an archived variety's
  page against `archived_parent`). A row it cannot map fails.
- **The stock entry form (new) has parent Variedades** in `routes.ts` and `screens.json`;
  editing an entry keeps "Todas las entradas".

## To be implemented by the next subtasks

- **`useScreenFacts` reads a variety's facts in this order**: the succeeded detail query
  (`keys.variety(id)`); then the `keys.varieties()` and `keys.archivedVarieties()` caches
  through observers with `enabled: false`, so nothing is fetched; then `'unknown'`. It never
  uses another id's data, `placeholderData` or `keepPreviousData`.
- **The back control is a type** (amends ADR-0037): `components/BackButton.tsx` is the only
  renderer of a back control, imported only by modules under `web/src/shell/` and by
  `screens/Analisis.tsx`. The Onboarding sits outside `Shell` on purpose and draws its
  "Atrás" as a plain text `Boton` of kind `link`, with no glyph. The `back` kind leaves `Boton` and `BotonLink`, and an AST guard
  catches a `‹` written outside the shell.

## Consequences

- A fifth state-dependent parent is one more `{ live, archived }` in `routes.ts`, one
  `archived_parent` in `screens.json`, a row in the test's map, and the assertion keeps its
  mark honest.
- A deep link to an archived variety shows the live parent until the detail query resolves,
  then flips once; the arrow row is always reserved.
