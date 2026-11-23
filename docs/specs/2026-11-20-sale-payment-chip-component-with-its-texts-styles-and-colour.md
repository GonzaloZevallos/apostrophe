---
status: draft
---
## Goal

Build the sale payment chip, SalePaymentChip, with its texts, styles and colour census entries. No screen uses it yet; #928 wires it. Once wired, it serves the seller going through their sales: each Sale says at once whether it is paid, part-paid with how much is still owed, or unpaid. The seller then knows which sales still need collecting without opening each one. The chip only shows the Sale's payment_state and still_owed and never computes them itself.

## Acceptance criteria

- SalePaymentChip.tsx exists in web/src/screens/ventas/. Its props are the Sale's payment_state and still_owed (as state and stillOwed), plus the money formatter.
- paid renders "Paid" with the class payment-chip--paid.
- unpaid renders "Unpaid" with the class payment-chip--unpaid.
- part_paid with a positive still_owed renders a half-filled circle and the part-paid line with the class payment-chip--part-paid. The amount is still_owed in the Business's Money format, with the figure class, even when it disagrees with the Sale's total.
- null renders the Attention icon and "Payment can't be shown" with the class payment-chip--unknown.
- part_paid with still_owed null, 0 or negative renders the same "Payment can't be shown" line, never $0.
- An unknown state value renders the same line through the assertNever default branch.
- The circle and the Attention icon are aria-hidden, and the chip's text is its accessible name.
- The chip reads only payment_state and still_owed, never still_owing, Payments or the Customer's Balance.
- The four sales:card.payment keys (paid, unpaid, partPaid, unknown) exist only in copy/sales.ts and en.baseline.json, worded exactly as in the Tech Writer's table: "Paid", "Unpaid", "Part-paid · (amount) owed" with the amount placeholder, and "Payment can't be shown".
- The payment-chip rules in app.css use tokens only.
- Part-paid is --deuda2 on --deuda-fondo, with the circle in --deuda.
- Every colour pair used is in the README contrast table.
- Neither the chip nor its amount has white-space nowrap, text-overflow ellipsis or overflow hidden.
- colorCensus.ts has entries for the paid, unpaid, part-paid and unknown classes. Each names its word or shape carrier and cites SalePaymentChip.test.tsx.
- web/src/screens/ventas/saleWith.ts exports a test-only saleWith(state, overrides?). It returns a typed Sale with payment_state and still_owed set as a pair.
- SalePaymentChip.test.tsx covers paid, unpaid, part_paid, null, part_paid with a stillOwed different from the total, and part_paid with still_owed null, 0 and negative.
- If test_front.py requires it, web/scripts/docs/front-exclude.json lists the new module; otherwise nothing is added there.
- Vitest passes.

## Out of scope

- Putting the chip on any screen (that is #928).
- Any change to the API or to how payment_state and still_owed are computed.
- Balance, Total owed, Sales still owing, "Owed to you" and Owing since.
- The "Paid · method" text of the On-the-spot payment.
- Choosing a colour that is neither in the approved drawing nor in the README contrast table.

## Decisions

- A part_paid state whose still_owed is null, 0 or negative shows "Payment can't be shown" instead of an amount.
  - Reason: part-paid means something is still owed, so $0 or a negative amount would be a guessed state, which success criterion 3 rules out.
- Paid, Unpaid and the unknown line take the colours of the approved GH-855 drawing, using only pairs already in the README contrast table. Otherwise the build stops and reports.
  - Reason: anything visible that departs from the approved drawing is the owner's call, so no role picks a colour.
- The half-filled circle and the Attention icon are aria-hidden, and the chip's text is its accessible name.
  - Reason: the Icon and text rule makes the sentence carry the meaning, and the shapes only reinforce it.
- The chip wraps onto a second line and never cuts the amount.
  - Reason: the amount is the information the seller needs, and Phone first puts the phone ahead.
- The module may be listed in web/scripts/docs/front-exclude.json until #928 wires it.
  - Reason: owner's rule D-62e6dc23 allows it without asking.

## Risks

The approved drawing may give no colour, or a pair outside the contrast table, for Paid, Unpaid or unknown. That stops the build until the owner decides.
The colours, circle, accessible name and wrapping are not compared with the drawing in this part. A mismatch would only show up when #928 wires the chip.

## Screens

The screens come from the design stage. This part puts the chip on no screen; #928 does.

## Slices

### sale-payment-chip

#### Acceptance criteria

- The chip renders paid, unpaid, part_paid with a positive amount, and the "Payment can't be shown" line for null, an unknown value or part_paid without a positive still_owed, with the texts and classes above.
- The four copy keys, the token-only payment-chip rules, the four colour census entries and the saleWith helper exist as specified.
- SalePaymentChip.test.tsx covers every case above, and vitest passes.

#### Risks

- colour-pair-missing