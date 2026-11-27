---
status: draft
---
## Goal

On the customer card, the icon-only pencil beside the name is replaced by a text-only link 'Edit'. The link sits right-aligned in a card-owned 44 px row directly under the shell's single '‹ Customers'. A seller on the phone can then fix a wrong or missing name or phone in one tap. The customer form's Name field gets the help text 'How you have them in your contacts'. It guides the seller to type a name they will find again and helps avoid duplicate Customers. This is part 2 of 2 of GH-1071.

## Acceptance criteria

- New `web/src/screens/clientes/CustomerCardTopRow.tsx` renders `div.ficha-cliente__superior`: right-aligned, `min-height: var(--alto-tocable)`, with an optional `editTo`. When `editTo` is given, it renders `BotonLink variant='link'` with `COMMON_TEXT.edit`, pointing to `CUSTOMER_EDIT`.
- In `ClienteFicha`, the name row holds only the name. The pencil is gone.
- `ClienteFicha` draws the empty row in the loading branch and in both failure branches. It draws the row with 'Edit' in the loaded branch. `GoneScreen` does not draw it.
- `CustomerCardBehind` draws the row without `editTo`.
- `app.css` gives `.ficha-cliente__superior .boton--enlace` these rules: `inline-flex`, `align-items: center`, `min-height: var(--alto-tocable)`, padding-inline, `touch-action: manipulation`, `user-select: none` and `box-shadow: none`. The global `.boton--enlace` is unchanged.
- No shell file changes and no negative margins are used. The card shows exactly one back.
- `CUSTOMERS_TEXT.namePlaceholder` = 'How you have them in your contacts' is registered in `LIMITED_COPY` as kind 'help' (34 of 80), and `en.baseline.json` is regenerated.
- `CustomerFields` puts that placeholder on the Name input. The label 'Name', `autocomplete='off'` and the font size are unchanged. It shows in New customer, Edit customer and New sale's new-customer block.
- `ClienteFicha` tests:
  - the row is present while loading, after each failure and when loaded;
  - the link 'Edit' exists only when loaded;
  - the name row has no control;
  - there is exactly one back.
- `CustomerFields` test: `getByLabelText('Name')` has the placeholder.
- The customers, flow and phoneCountry e2e specs and the Mobile check pass in the phone and computer projects. No spec moves, and any e2e use of the removed pencil's class is migrated in the same change.
- Guards:
  - no `.first()` and no `data-testid` is added;
  - no offender list, tolerance or `ACTION_LINKS_LEFT` grows;
  - the closing guard passes with no new exemption.
- `docs/product/icon-and-text-rule.md` names the card's 'Edit' as a text-only link in the row under '‹ Customers'. `docs/product/customers.md` matches this task's definition.
- The PR carries light and dark Design captures of `ClienteFicha`, `ClienteNuevo`, `ClienteNuevoCompu` and `ClienteEditar`, at phone 320 and 375 and on the computer. CI is ci-ok.

## Out of scope

- The same-line version of the 'Edit' link, or any change to the shell or the shared frame.
- Any change to the Phone country selector.
- Name uniqueness, matching, duplicate detection or a duplicate warning.
- Dedicated polish for the computer.
- Changing the global `.boton--enlace` style.

## Decisions

- The 'Edit' link sits in its own card-owned row under '‹ Customers', not on the back's line.
  - Reason: the owner accepted this placement; the same-line version would change the shared frame.
- The link stays text, not an icon-only button.
  - Reason: D-8ecb8c1d applies only when a labelled action does not fit a phone title row, and this link has its own row.
- The row is drawn empty while loading and on failure, but not in the gone state.
  - Reason: content must move 0 px when the customer arrives, and the gone screen is not a card and has nothing to edit.
- The Name placeholder is guidance only.
  - Reason: it serves finding the same person again without adding rules; the Phone number stays optional.
- No e2e landmark is moved.
  - Reason: the link keeps role and name 'Edit'; any use of the removed pencil's class is migrated in the same task (D-69509906).

## Risks

An e2e helper or spec may target the pencil's class or locator. It must be migrated in the same change and the pencil never restored (D-69509906).
The loading and failure rows must match the loaded row's height exactly, or the card will still shift on arrival.

## Screens

The screens come from the design stage.

## Slices

### customer-card-edit-row-and-name-hint

#### Acceptance criteria

- The customer card shows a text-only 'Edit' link, right-aligned in its own row of at least 44 px under the single '‹ Customers', only when the customer is loaded. The name row holds only the name.
- The row is drawn while loading and after a failure, so content moves 0 px on arrival. The gone state does not draw it, and `CustomerCardBehind` draws it without the link.
- The Name field shows 'How you have them in your contacts' in New customer, Edit customer and New sale's new-customer block. Its label, autocomplete and font size are unchanged.
- No shell file, global link style, offender list, tolerance or `ACTION_LINKS_LEFT` changes. The customers, flow and phoneCountry specs and the Mobile check pass in the phone and computer projects.

#### Risks

- e2e-landmark-pencil
- row-height-shift