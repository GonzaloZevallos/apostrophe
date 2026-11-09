---
status: accepted
date: 2026-11-09
---

# More is retired and Expenses is a card on the phone and a root on the computer

GH-651, part 2 of GH-560.

## Context

On 2026-11-02 the owner retired the More screen (`docs/design/redesign/registro-unificado.md`). On the phone, More was the only way to reach five places: Settings, Analysis, Expenses, Add expense and Take from stock. The approved drawings place each of them in the screen where its context already lives. The computer side rail already reaches Settings, Expenses and Analysis directly and does not change.

## Decision

- **More is gone.** The phone bar is Home, Sales, Customers, Products. There is no More screen, no More tab and no `MORE` entry in the screen registry. `docs/product/navigation.md` is the product statement.
- **Each destination has one entry point, built on the screen that already exists:**
  - Settings: an avatar button in the header of Home, Sales, Customers, Products, Analysis and Expenses on the phone. Its accessible name is the fixed word "Settings". It replaces Home's Business avatar, so each screen has one entry to Settings. The computer keeps the Business row of the side rail and gets no header avatar.
  - Analysis: a Today | Analysis segment on Home, repeated on Analysis with "Analysis" selected. On the phone, Analysis is a Tab root that marks Home as the active tab.
  - Expenses and Add expense: an Expenses card on Analysis, with "Add expense" (the Expense form with today's date) and "See the expenses".
  - Take from stock: the secondary button that Products already shows next to "+ Stock entry". It gets a test at that entry point and no new code.
- **Expenses is the one screen whose kind depends on the width.** It is a card with "‹ Analysis" on the phone and a Tab root on the computer, because the side rail is unchanged. The front registry (`web/src/routes.ts`) expresses it as the kind `card-on-phone`, and `scripts/design/screens.json` as `kind: "card"` with `computer_kind: "root"`. The registry's field is `declaredKind` and is read only through `kindOf(screen, viewport)`, so no reader can pick the wrong width. The rule "one kind per screen" holds per viewport; Expenses is the only named exception.
- **A Tab root may mark another tab, or none.** `Place.bar` may be `null`: Settings marks no tab, and Analysis and Expenses on the phone mark Home.
- **`/mas` and `/more` land on Home on purpose.** `/mas` leaves the server's legacy redirects, and both addresses fall under the existing rule that an unknown address goes to Home. No redirect and no test names either path. This is the only exception to "every old Spanish path redirects".
- **`Mas.dc.html` stays in `docs/product/design-system/pantallas/`, unedited.** The drawings are byte copies of an approved source and are never edited. The `Mas` and `MasOscuro` rows leave `screens.json` with their offender entries, in the diff that removes the built screen. No test fails on a drawing that no row uses.
- **A scan keeps it retired.** One architecture test fails if `web/src`, `web/e2e` or `tests` name More or `/more` again. "More info" (`MasInfo`), a settled glossary term, is let through.

## Why

- The owner decided it, and the drawings place each entry. Placement follows the drawings even where another spot would save a tap; the tap budget in navigation.md is rewritten to match (Expense 2 taps from Home and 3 from the other roots, Settings 1, Stock withdrawal 2).
- Keeping the side rail unchanged forces the one width-dependent kind. Expressing it in a single registry field, read through one function, keeps it a visible exception instead of a conditional spread over the screens.
- Redirecting `/mas` to a specific screen would suggest the old menu still has a meaning; no destination of it is a single place.

## Consequences

- Nothing reachable on the phone is lost: all five destinations have an entry and a Testing Library test at it. A destination without a home in the drawings is listed in the PR, never dropped silently.
- An old bookmark to `/mas` opens Home with no message.
- The registry checks read the phone kind; `computer_kind` is compared by the route coverage test.

## Rejected

- **A new menu or screen that gathers the destinations.** It is what the owner retired.
- **A header avatar on the computer.** The side rail already has the Business row; the computer does not change.
- **Two screens for Expenses, one per width.** Same content, same route; only its frame differs.
- **A dedicated landing for `/mas`.** Home is enough, and each destination has its own entry.
