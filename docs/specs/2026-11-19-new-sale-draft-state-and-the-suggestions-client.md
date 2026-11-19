---
status: draft
---
## Goal

Give the future New sale screen two front-only pieces: the state of a sale while it is being built (`useSaleDraft`) and the client for `GET /api/sales/suggestions`. They let a seller build a sale from the customers, products and payment method they usually pick, adjusting only quantities, with every total worked out by the pricing module. The goal is a sale saved from the phone in under a minute. No screen uses them until the flip part.

## Acceptance criteria

- `useSaleDraft` in `web/src/sales/useSaleDraft.ts` holds customer, lines, date, shipping and note. A line is a product and a quantity only.
- Adding a product already in the sale adds one whole unit to its line and never creates a second line.
- + and − step by one whole unit. − from a current quantity of 1 or less removes the line, and 1.5 − 1 leaves a line at 0.5.
- A typed quantity is accepted only when it is above 0 with at most two decimals. 0, empty, non-numeric or more decimals are refused without rounding, and the line keeps its last valid quantity.
- `isDirty` is true exactly when `lines.length > 0`.
- The draft holds a read-only `proposedMethodId` and a `choice` of unset, paid(id) or owing. The effective method is the paid id, nothing for owing, and `proposedMethodId` for unset.
- A suggestion that arrives late fills only `proposedMethodId` and never overwrites paid(id) or owing.
- Removing the customer while `choice` is owing resets it to unset. Switching customer keeps owing, and removing the customer keeps paid(id).
- An opening starts with no lines, unset `choice`, empty shipping and note, and today's date in the Business's day. The customer is empty unless the opening passes one.
- The suggestions client in `web/src/api/` calls `GET /api/sales/suggestions` with a required `on` and returns `recent_customer_ids`, `most_sold_product_ids` and a nullable `last_payment_method_id`.
- A client test at fetch shows:
  - exactly one request per New sale open, with `on` set to the opening date;
  - no new request after a date edit or a re-render;
  - a new request for an opening on another day;
  - a failed fetch resolves to no suggestion, with no error thrown.
- Neither the draft nor the client does money arithmetic. No method is keyed to a name or a cash flag.
- No route, build constant, query parameter, window flag or data-* hook is added, and no copy key is added.

## Out of scope

- Any screen, Sheet or component that uses the draft, and the flip that mounts it.
- Rewriting sales.md criterion 34 ("the method never comes preset").
- Gift, Special price and the line detail Sheet.
- Keeping a draft across reloads.
- Any server change, including the API still accepting the same product on several lines.

## Decisions

- Typing 0 or clearing the quantity field is refused and never removes the line. Only − removes a line.
  - Reason: typing "0.5" or retyping a quantity passes through "0" or an empty field, and removing the line then would lose work under the seller's thumb.
- The − rule looks at the current quantity, not at the result of the step.
  - Reason: this applies the request literally and keeps a fractional line (0.5) until the seller presses − again.
- A typed quantity with more than two decimals is refused, never rounded.
  - Reason: a stored quantity is a whole number of hundredths (ADR-0056), and silent rounding would change what the seller typed.
- A draft line is only a product and a quantity.
  - Reason: Gift and Special price belong to the line detail part, and adding them later extends the line without changing these rules.
- A late suggestion never overwrites the seller's paid(id) or owing. With unset, it becomes the effective method.
  - Reason: suggestions only shorten choices, and the seller's pick always wins.
- With no suggestion or a failed fetch, there is no effective method for unset and no error is shown.
  - Reason: suggestions are optional shortcuts, so their absence must not block or alarm the seller.
- Owing to unset when the customer is removed is the only automatic reset. Switching customer keeps owing, removing the customer keeps paid(id), and owing with no customer is held.
  - Reason: a sale without a customer may be paid in full, and refusing a save belongs to the server and the screen.
- The draft lives in memory for one opening. It starts with no lines on the Business's today, with a customer only when the opening passes one.
  - Reason: keeping a draft across reloads is a capability nobody asked for, and New sale can already be opened from a customer's page.
- The one-line-per-product rule lives in the draft only. The API keeps accepting repeated products.
  - Reason: the request is front only, and changing the server is out of scope.

## Risks

- Nothing mounts the draft before the flip, so a mismatch with how the screen needs to drive it shows up only then.
- A typed-quantity setter that refuses input needs the screen to keep the half-typed text on its own. The flip part must handle this, or typing will feel stuck.
- Until the flip, sales.md criterion 34 still says the method never comes preset, while the draft already holds a proposal.

## Screens

none

## Slices

### sale-draft-and-suggestions-client

#### Acceptance criteria

- Every draft rule in the Acceptance criteria above has a plain unit test that passes.
- The suggestions client test at fetch shows one request per open keyed on the opening date, none after a date edit or re-render, and silent handling of a failed fetch.
- No test-only route, constant, parameter, flag or data-* hook exists, no copy key is added, and the Gate passes.

#### Risks

- none