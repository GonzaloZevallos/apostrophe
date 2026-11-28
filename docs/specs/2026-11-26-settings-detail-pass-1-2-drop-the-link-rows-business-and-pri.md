---
status: draft
---
## Goal

Settings lists every configuration screen as its own row. The Business and Prices pages repeat some of those rows as links that the approved drawings do not have. This task removes the duplicate links from both pages, on phone and computer.

Each setting is then reached from one place, the Settings list. Every path named to the seller, in the app copy or in the product docs, matches what they actually tap.

## Acceptance criteria

- The Business page (phone and computer) no longer shows the "Currency and decimals" or "Withdrawal reasons" link rows. The business name field and its save remain.
- The Prices page (phone and computer) no longer shows the "Customer types ›" link row. The two switches, their help lines, the past-sales line and Save remain.
- With Customer types saved off, Prices shows no link and the `customerTypes` Settings row stays hidden. With it saved on, the row shows.
- Currency and decimals, Withdrawal reasons and Customer types each open from their own Settings row.
- In `web/src/routes.ts`, `settings-customer-types` has `parent: 'settings'`. A routes test asserts it.
- "‹ Settings" and Close with no history on the Customer types list land on Settings, whether it was opened from the row or by typing the address.
- `/settings/prices/customer-types` still opens the list and is not redirected.
- `emptyStates:selectorNoReasons` reads "Add them in Settings → Withdrawal reasons.".
- No string in the Copy module and no file in `docs/product/` names "Settings → Business → Currency and decimals", "Settings → Business → Withdrawal reasons" or "Settings → Prices → Customer types". This covers `selector.md`, `analysis.md`, `money.md`, `catalog.md`, `pinned-catalog.md` and `customers.md`.
- The stale comments in `BusinessGroup.tsx` and `PaymentsGroup.tsx` no longer name the removed rows.
- BusinessGroup and PricingGroup tests assert that the removed rows are absent.
- `web/e2e/customerTypes.spec.ts` opens the list from the Settings row.
- No e2e or vitest locator uses a removed link, and no link is put back, visible or hidden.
- No offender list, tolerance or check is widened.
- Light and dark Design captures, phone 375 and computer, are attached for ConfiguracionNegocio, ConfiguracionNegocioCompu, ConfiguracionPrecios, ConfiguracionPreciosCompu and ConfiguracionMoneda.

## Out of scope

- Any redirect or any other route change.
- Any change to the Currency and decimals, Withdrawal reasons or Customer types screens, beyond the back destination of Customer types.
- The language control on the Business page, which shows only with 2 or more Selectable languages.
- Extra polish on the computer.

## Decisions

- The language control on the Business page is left as it is.
  - Reason: The drawing shows only the name field because no Business has two Selectable languages before #317. Removing the control would be a behaviour change the request does not ask for.
- `docs/product/settings.md` and `docs/product/pricing-settings.md` are rewritten by the PM's definitions, not edited in the diff.
  - Reason: `pricing-settings.md` described the removed Prices row and a 3-tap path to Customer types. `settings.md` said no screen parent changes. Both now state the new behaviour in one place.
- The `ENTRY_PARENTS` entry for Customer types may be removed or kept, as long as back always lands on Settings.
  - Reason: With `parent: 'settings'` the entry adds nothing. The behaviour, not the mechanism, is what the seller sees.

## Risks

`customerTypes.spec.ts` gains a step: it closes Prices and taps the Settings row. If a written tap budget for that flow breaks, work stops and the owner is asked before any budget is widened.

Removing the rows may break e2e or vitest locators beyond the ones named. D-69509906 requires migrating all of them in this task.

## Screens

The screens come from the design stage.

## Slices

### settings-drop-duplicate-links

#### Acceptance criteria

- The Business page shows no "Currency and decimals" or "Withdrawal reasons" link, and the Prices page shows no "Customer types ›" link, on phone and computer.
- `settings-customer-types` has parent `settings`, back and Close land on Settings, and `/settings/prices/customer-types` still resolves without a redirect.
- `emptyStates:selectorNoReasons` and the listed docs name only Settings-row paths.
- Tests assert the removed rows are absent and the new parent is in place. Every locator that used a removed link is migrated, and no check is widened.
- Light and dark Design captures of the five touched screens are attached.

#### Risks

- tap-budget-stop
- e2e-locator-migration