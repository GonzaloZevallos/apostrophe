---
status: draft
---
## Goal

Deliver `GET /api/search?q=` for a signed-in User. It answers three groups: `sales`, `customers` and `products`. It is for a seller who remembers only part of a name or one phone digit.

- **Customers:** each hit carries its signed Balance.
- **Products:** each hit carries its Stock for today.
- **Sales:** the group is in the response and is always empty in this part.

The route only reads, adds no matching rule, and never shows another business's data. It adds no screen.

## Acceptance criteria

- `GET /api/search` without a session answers 401.
- The response always has three lists: `sales`, `customers` and `products`. `sales` is always empty.
- A Customer is found by part of its name, in any case and with or without accents, or by a phone digit through `Customer.matches`. `#5` and `1x` find a Customer by that one digit.
- A Product is found by part of its name.
- Each group returns at most 5 hits. The order is: names that start with the query, then the folded name, then the id.
- Archived products are left out. Hidden, unpriced, zero-Stock and negative-Stock Products are returned with their real Stock.
- A Customer hit has `id`, `name` and a signed `balance`. A Credit stays below 0, at scale 0 and at scale 2 (with 2 decimals).
- A Product hit has `id`, `name` and `quantity` as a decimal, with no unit field. The quantity equals `/api/stock` just before and just after Argentina midnight.
- A missing, empty, 1-character, `#` or 201-character `q` answers 200 with three empty lists. A 200-character `q` is searched.
- `?q=ab&q=cd` answers the same as `?q=cd`.
- Another business's lookalike Customer (same name and phone digits) and lookalike Product are never returned. The route is in the business-isolation test list.
- Full pytest, mypy --strict and ruff are green.
- `docs/api/**`, `docs/architecture/generated/**`, `decisiones.md` and `web/src/api/contract.json` are unchanged.

## Out of scope

- Any screen, visible element or text.
- Sales search results: the Sales group stays empty.
- The front client `search(q)`.
- New phone-matching rules.
- A unit label on a Product's quantity.

## Decisions

- The empty Sales group defers the Sales behaviour in `docs/product/search.md`. It does not replace it.
  - Reason: GH-1103 split the search, and the Sales rule is already defined for a later part.
- The order uses the id as the last tie-break, after the folded name.
  - Reason: identical folded names still need a stable order.
- Money crosses the wire in currency units as a decimal, per ADR-0058. It is not formatted with the Money format.
  - Reason: ADR-0058 already decides how money travels on the wire.
- A 201-character `q` answers empty, and a 200-character one is searched.
  - Reason: it caps the cost of each request and gives a long query an empty result, not an error.

## Risks

Matching and ordering run in Python for each request, so the cost grows with the business's Customers and Products. This is accepted for the sizes in the brief.
If Stock is read with a different clock than `/api/stock` uses, the two figures would differ around midnight.

## Screens

none

## Slices

### search-route-customers-products

#### Acceptance criteria

- `GET /api/search` answers 401 without a session.
- With a session, it answers `sales` (always empty), `customers` and `products`, each with at most 5 hits, in starts-with, folded-name, id order.
- Customers match by name or by phone digit through `Customer.matches`, and each carries its signed Balance. A Credit stays below 0 at scales 0 and 2.
- Products leave out Archived products and include hidden, unpriced, zero-Stock and negative-Stock ones. Each quantity equals `/api/stock` across Argentina midnight.
- Query edge cases (missing, empty, 1 character, `#`, 201 characters, repeated `q`) behave as specified. A 200-character `q` is searched.
- Another business's lookalike Customers and Products are never returned.
- Full pytest, mypy --strict and ruff are green.

#### Risks

- python-side-search-cost
- stock-clock-mismatch