---
status: draft
---
## Goal
On the phone, the Settings home is rebuilt from the settings registry. From top to bottom it shows the title, a read-only Business card with the business initial, name and user count, three shortcuts (Prices, Payment methods, Integrations) and the five headed groups of the registry. The owner of a small business, working from the phone, can see they are in the right business and reach any setting in one tap. The computer Settings stays exactly as it is.

## Acceptance criteria
- `Settings.tsx` switches on `useViewport()`. It renders `SettingsComputer` on a computer and `SettingsHome` on the phone. `SettingsComputer` holds today's Settings JSX byte for byte, and `Settings.test.tsx` passes against it with `matchMedia` stubbed to computer.
- While the `/business` read is pending, the Business card shows the name and the initial, no digit, and `aria-busy` on its content.
- The card shows "1 user" and "3 users", and an emoji as the initial.
- After a failed read, the card shows no count and no error.
- The card contains no link and no button.
- The card's count uses the same query key and function as `UsersGroup`.
- Five headings appear in `SETTINGS_GROUPS` order: Business, Catalog, Payments and stock, Channels, Team and app.
- With two selectable languages and Customer types off, there are 12 rows, the language row included.
- The three shortcuts are Prices, Payment methods and Integrations, in that order, each with its row's href.
- Opening Payment methods from its shortcut shows "‹ Settings", and that returns to Settings home.
- A vitest walk with the real route table reaches every shown row's page in one tap from /settings.
- At 320, 375 and 430 px, in light and dark, all three shortcuts are fully inside the viewport with scroll at 0.
- At 320 px:
  - a long business name and a long second line end in an ellipsis without wrapping or overlapping;
  - a shortcut label takes at most two lines and is never ellipsised;
  - the three tiles are the same height.
- Every row and every shortcut is at least 44 px tall and has an `:active` state.
- Every on-screen string added lives under `settings:*` in the Copy module, in English.
- Every phone use of the old Settings list in `web/e2e` and in vitest uses role-and-name locators: the `data-menu` nav, `ajustes__item` on /settings and the Settings-home link names. Computer uses keep the old locators, and no old element is put back.
- `tapBudget.spec.ts` replaces the 3-tap Payment methods path with a phone test that taps each shortcut and reaches its page.
- `scripts/design/screens.json` has the dark twin of the Configuracion row.
- The walked states in `web/src/mobile-standard/states*.ts` include the card with its count and the card without it.
- `docs/product/navigation.md`, in Spanish:
  - names the registry's groups;
  - gives the Payment methods path through the shortcut: avatar → Payment methods, 2 taps from a tab root;
  - matches `docs/product/settings.md`.
- e2e is green, the mobile project included. No offender list, tolerance or check is widened.
- Design capture covers:
  - Configuracion and ConfiguracionOscuro at 320, 375 and 430 px;
  - ConfiguracionCompu before and after, which must be unchanged.

## Out of scope
- Any front address, redirect or screen parent change.
- Any new or changed row, label, second line, icon, address or shortcut in the settings registry.
- A search field in Settings.
- A role shown on the Business card.
- Any change to the computer Settings design or markup.

## Decisions
- The Business card is read-only and shows no role.
  - Reason: The Business and Users rows already open those pages, so a second way in adds nothing. Roles are out of scope in the BRIEF. The owner accepted the departure (Drawing 2).
- Three shortcuts, Prices, Payment methods and Integrations, sit between the card and the groups.
  - Reason: They serve the job's most frequent changes and take Payment methods from 3 taps to 2 from a tab root. The owner accepted the departure (Drawing 1).
- There is no search field.
  - Reason: Every row is one tap away and the frequent ones are on the first screen, so search would add a keyboard and a results state for 13 rows. The owner accepted the departure (Drawing 3).
- The registry's five headed groups replace the drawing's nine rows without headings.
  - Reason: The registry is the only source of which rows exist, and several of the drawing's rows have no capability behind them. The owner accepted the departure (Drawing 4).
- A shortcut label wraps to at most two lines, is never ellipsised, and the three tiles stay the same height.
  - Reason: A shortcut's label is its only identity. "Payment met…" is ambiguous and an icon-only tile fails the glance test. D-8ecb8c1d covers title-row actions, not these tiles.
- `navigation.md` criterion 2 is rewritten: Payment methods is 2 taps from a tab root (avatar → shortcut).
  - Reason: The shortcut changes the path, and the docs must say one structure once.

## Risks
- Migrating the locators touches many e2e specs and helpers (`settings.spec.ts`, `tapBudget.spec.ts`, `pressed.spec.ts`, `helpers/chrome.ts`). Missing one fails e2e.
- At 320 px, "Payment methods" may push the three tiles past the first screen. That case goes to the owner and is never fixed by widening a tolerance.
- If parts 1–2 add `docs/product/settings.md` or change the registry, this change must merge into them, not overwrite them.

## Screens
The screens come from the design stage.

## Slices
### settings-phone-home
#### Acceptance criteria
- The phone Settings home shows the title, the read-only Business card, the three shortcuts and the five registry groups. The computer Settings is byte for byte unchanged.
- The card's count is empty and `aria-busy` while pending, empty with no error on failure, and "1 user" or "N users" when loaded.
- Every shown row and shortcut opens its page in one tap from /settings, and "‹ Settings" returns to Settings home.
- At 320, 375 and 430 px the three shortcuts are on the first screen. Nothing is clipped and every tap target is at least 44 px.
- Every phone locator of the old list is migrated to role and name, with no old element put back. `tapBudget.spec.ts` checks the shortcuts.
- `screens.json` has the dark twin, the walked states include both card states, and `navigation.md` is aligned in Spanish.
- e2e is green with no offender added. The Design capture of Configuracion, ConfiguracionOscuro and ConfiguracionCompu (before and after) is attached.
#### Risks
- e2e-locator-migration
- shortcuts-fit-at-320
- settings-doc-merge