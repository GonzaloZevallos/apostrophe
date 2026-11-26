---
status: draft
---
## Goal

On the phone Products screen, the New product action in the title row must never look like the green Settings avatar. The owner can then see the add action at once and open New product in one tap, without opening Settings by mistake. The action becomes the labelled pill (`agregar` icon + "Product") drawn in Productos / ProductosOscuro when it fits the title row at 320 and 246 CSS px. Otherwise it becomes the neutral round + drawn in Clientes. One measurement picks the look, and that look ships on every phone width.

## Acceptance criteria

- Before building, the pill is measured on the live `/varieties` at 320 and 246 CSS px, in light and dark. The PR records the width the row needs, the width available in each cell, and the look chosen.
- If the pill fits in all four cells, the header shows the green pill on every phone width, with the `agregar` icon and the visible word "Product" and no literal "+". If it does not fit, it shows the neutral round + on every phone width, with no switching by width.
- The neutral round + uses the surface, border and ink tokens of the round button in Clientes.dc.html, in light and dark. It is never green and never has the class `boton-icono--lleno`.
- In the Products phone title block, green appears only on the Settings avatar and, if it shipped, on the pill.
- At 320 and 246 CSS px, in light and dark, "Products", the action and the Settings avatar stay on one row. Nothing wraps, shrinks, overlaps, clips or scrolls sideways. Targets are at least 44×44 px and gaps at least 8 px.
- In both looks the action links to New product (`VARIETY_NEW`), and its accessible name is "New product".
- Every visible text comes from the English Copy module. A new key, with its en-XA and generated types, is added only if no existing one carries "Product". No Spanish from the drawing ships, and the product-word sweep and `copyLimits.test.ts` stay green.
- Every e2e and vitest locator that used the green button or `boton-icono--lleno` is migrated in the same diff. No old element is kept, visible or hidden, for a locator (D-69509906).
- The `Productos` / `ProductosOscuro` rows in `scripts/design/screens.json` and their WalkState are updated. No row is marked not-captured, and the mobile check adds no offender.
- The PR attaches light and dark Design captures at 320, 375 and 430 px against Productos / ProductosOscuro, and all three widths show the same header.
- The computer layout (900 px and up) is byte-identical before and after in both themes.
- `docs/product/varieties.md` and `docs/product/icon-and-text-rule.md` describe the look that shipped.

## Out of scope

- Other phone headers (Customers, Sales and others) with the same green-circle clash. Each gets its own issue.
- The + in the phone bar, which opens New sale.
- Switching live between the pill and the round + by phone width.
- Any change to the computer layout.
- Shortening "Products", shrinking the avatar, reducing gaps or targets, or wrapping the row to make the pill fit.
- Any setting to rename "Product" per Business.
- The Publish catalog button in the title row.

## Decisions

- The measurement decides once, and its result ships on every phone width, with no live switching by width.
  - Reason: the owner's rule measures at 320 px, the narrowest supported width, and live switching would make one screen look different from phone to phone without serving the job.
- Only the Products phone header changes.
  - Reason: the request names only Products and its drawings. Clientes.dc.html is cited only as the drawing of the neutral round button.
- The pill's visible text is the word "Product" next to the `agregar` icon, never a literal "+".
  - Reason: the icon-and-text rule says that a leading "+" in a doc label stands for the `agregar` icon.
- The accessible name stays "New product" in both looks.
  - Reason: a screen reader announces the same thing whichever look ships, and the name contains the visible word "Product".
- The neutral round + is built only from existing tokens, in both themes.
  - Reason: the Clientes drawing already defines it, and no new token is needed for a button that already exists in the design.

## Risks

The pill is likely not to fit at 246 CSS px. GH-903 measured 317.3 px needed with "New product" against 198 px available, so the round + is the probable outcome. It is fully acceptable.
Migrating the locators that relied on `boton-icono--lleno` may touch e2e helpers shared with other specs.

## Screens

The screens come from the design stage.

## Slices

### products-header-add-action

#### Acceptance criteria

- The PR records the measurement of the pill at 320 and 246 CSS px, in light and dark, and the look chosen. That look ships on every phone width.
- The action is either the green pill (`agregar` icon + "Product") or the neutral round + from Clientes.dc.html. It is never a green round button next to the avatar.
- At 320 and 246 CSS px, in light and dark, the title row holds on one line, with targets of at least 44 px, gaps of at least 8 px, and no wrap, shrink or sideways scroll.
- The action opens New product, and its accessible name is "New product" in both looks. All text comes from the English Copy module.
- Every e2e and vitest locator of the old green button is migrated in the same diff, and no old element is kept (D-69509906).
- The `screens.json` rows and WalkState are updated, the PR has light and dark Design captures at 320, 375 and 430 px, and the computer layout is unchanged.

#### Risks

- pill-does-not-fit
- shared-e2e-locators