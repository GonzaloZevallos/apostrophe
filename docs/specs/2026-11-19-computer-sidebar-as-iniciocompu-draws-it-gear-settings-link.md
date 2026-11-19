---
status: draft
---
## Goal
Rebuild the computer sidebar (900 px and wider) in `web/src/shell/Shell.tsx` exactly as `InicioCompu` and `InicioCompuOscuro` draw it. It is for the business owner working at the computer, who wants to reach any place of the app from one fixed sidebar with Settings one click away. The sidebar holds the Wordmark, the new-sale entry with its visible label, the four places, Expenses and Analysis, and a gear-icon Settings link that replaces the business row. This is part 7 of 7 of GH-495.

## Acceptance criteria
- At 900 px and wider, the sidebar shows the Wordmark, the new-sale entry with its visible label and no `aria-haspopup`, Home, Sales, Customers, Products, Expenses, Analysis and a gear-icon Settings link, placed as the drawings place them.
- The sidebar has exactly one link with accessible name "Settings", taken from the Copy module. It is a link, not a button. A Testing Library test through the real router at computer width shows that clicking it opens `/settings`.
- The business row (avatar and business name) is gone from the sidebar, and the computer header shows no avatar.
- `common:settingsFor` is removed if a search finds no other reader. If one is found, the key stays.
- The marked sidebar entry, including on `/settings` and its screens, comes only from `placeOf` in `routes.ts`, never from a pathname, state or history.
- The sidebar crop rows in `scripts/design/screens.json` give exact AE 0 against `InicioCompu` and against `InicioCompuOscuro`.
- Any element the drawing shows for a feature that is not built yet is left out and listed in the PR. Nothing in the sidebar opens an unbuilt feature.
- The PR reports "built as drawn; the business row is gone".
- Every new link or button has an element box of at least 44x44 CSS px. The drawn gear is a child element.
- The missing-price line under the sidebar's "+ New sale" stays exactly as it is, and its tests pass in light and dark with no assertion loosened.
- `Shell.language.test.tsx` and the sidebar e2e use the new link's name. No e2e locator for the business row remains, and the row is not put back, visible or hidden.
- On the computer, New sale, Home, Sales, Customers, Products, Expenses, Analysis and Settings each open in one click from the sidebar.
- No offender list grows and no capture or check tolerance is widened.
- `/more` and `/mas` keep answering exactly like any unknown address, with no redirect.
- `docs/product/navigation.md` describes the new sidebar, and every line that said Settings is reached through the business row now names the gear link.
- CI checks, web, vitest, e2e and docs are green.

## Out of scope
- Any change to what a destination does.
- Any change to the phone bar, its +, the phone header or the phone "Settings" avatar.
- A header avatar on the computer.
- Any change to Home's computer header, which keeps the business name above its visible h1.
- Moving or removing the sidebar's missing-price line, or renaming `useNuevaVentaMissing` (that belongs to #806).
- Any element for a feature not built yet.
- Any redirect for `/more` or `/mas`.
- Widening a tolerance or listing an offender.

## Decisions
- The request's invariant 7, that `/more` and `/mas` redirect permanently to `/`, is replaced: both keep answering like any unknown address.
  - Reason: the owner's rule of 2026-11-16 (Retired address, delivered in part 1 of GH-780) is newer than the GH-495 plan and removes every redirect for retired paths.
- Only the sidebar loses the business name. On the computer, Home keeps it above its visible h1.
  - Reason: Home's computer header is outside this task and navigation.md criterion 37 keeps it, so no visible loss needs escalating.
- The missing-price line under the sidebar's "+ New sale" stays as it is.
  - Reason: it is a first-run rule (ADR-0046), not an unbuilt feature. The drawings show a business that has prices, so the line does not appear in the AE 0 crop.
- The sidebar entry marked on Settings screens is whatever `placeOf` gives.
  - Reason: the invariants make the routes registry the only source of the marked entry.

## Risks
- `ae.mjs` compares two capture runs, not a build against a drawing. If the crop tooling (possibly delivered by blocker #790) cannot give AE against `InicioCompu`/`InicioCompuOscuro`, the work stops and goes to the owner. It is not replaced by a by-eye judgement or a wider tolerance.
- The drawings may show a difference other than an unbuilt-feature element (spacing, divider, order). Each one goes to the owner before building, which can delay the task.
- e2e specs or helpers may use the business row as a landmark. All of them must be migrated in this task.

## Screens
This task touches the UI. The screens come from the design stage (`InicioCompu`, `InicioCompuOscuro`).

## Slices
### computer-sidebar-as-drawn
#### Acceptance criteria
- The sidebar at 900 px and wider matches `InicioCompu` and `InicioCompuOscuro` with exact AE 0, with the gear Settings link (accessible name "Settings", from the Copy module) in place of the business row and no computer header avatar.
- The marked entry comes only from `placeOf`, every capability opens in one click from the sidebar, and the missing-price line is unchanged.
- `Shell.language.test.tsx`, the sidebar e2e and a new Testing Library test (the gear opens Settings) pass. Every business-row e2e locator is migrated, and `docs/product/navigation.md` and the `screens.json` crop rows are updated.
#### Risks
- ae-against-drawing-tooling
- unlisted-drawing-differences
- e2e-business-row-landmark