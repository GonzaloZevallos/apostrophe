---
status: accepted
date: 2026-10-28
---

# The applied-promotion snapshot is typed sale promotion rows, recorded as the sale stood when saved and never recomputed

Amends ADR-0007.

GH-318 part 1. A sale stores its line totals and its payment (ADR-0007) and nothing about an offer. The
promotions PRD (docs/product/promotions.md, read at commit c4286c2cab8e4a4160292d15921c552fcae3f3f3)
lets the seller define offers that apply on their own, and the sale must keep which ones applied. This
records the shape of that record. No code changes in this part.

## What the PRD says

- "The sale records which promotions applied and how much each one discounted, as they stood when it
  was saved."
- "Editing, pausing or archiving a promotion never touches past sales."
- "A line keeps its pricing rule: list, bulk or the customer type's price. The promotion's discount is
  recorded on top of it."
- "A promotion's free item is recorded as a gift line, so stock and profit stay right. The sale
  records which promotion gave it."
- "Constraint: existing businesses keep working exactly as today. Past sales are never rewritten."
- "The reports show sales and discount per promotion." and Metric M4: "the sales and discount per
  promotion, matching the sum of the discounts recorded on sale lines".
- "An edit to a promotion leaves every past sale's recorded promotion and discount unchanged. Covered
  by a test."

## Decision

- **The snapshot is typed rows, one per applied promotion per sale.** A table `sale_promotion` holds
  `business_id` (not null), the sale, the promotion's name and kind as they stood when the sale was
  saved, its position in the seller's list, the amount it discounted, and, for a free item, the gift
  line it gave. It belongs to the `sales` hexagon, which records it in the same transaction as the
  sale. A reference to the promotion itself may be kept for the reports but is never read to describe
  the sale. A sale with no promotion has no row.
- **The discount per line is recorded on the sale line.** Each discounted line carries its promotion
  discount in a typed column of its own, so a report's total discount per promotion matches the sum of
  the discounts recorded on lines (the PRD's M4). A line keeps its `pricing_rule`; the discount is on
  top of it. A line with a special price, or a gift line, gets no promotion.
- **Amounts are typed integer columns, never JSON.** An amount in `sale_promotion` or on a line is held
  in a column declared with `money_column()` (ADR-0057). A document of "the promotions that applied" in
  a JSON, Text or String column is not allowed.
- **Recorded as they stood, never recomputed.** The row is written once, from what the quote showed
  when the sale was saved, after the seller removed any applied promotion they chose to remove. A
  removed promotion has no row and does not count toward its usage limit. No read of a sale evaluates
  promotions again, and editing, pausing or archiving a promotion changes no row of a past sale.
- **A sale's total is still the sum of its stored line totals plus shipping** (ADR-0007). Whether a
  stored `line_total` is before or after the line's promotion discount is fixed once, when the sale
  rule is built, and the sale's total and the sum of its `sale_promotion` amounts must then agree in a
  test.
- **Deleting a sale gives the use back.** A promotion's usage limit counts saved sales that have a
  `sale_promotion` row for it; a deleted sale takes its rows with it, so the count falls.
- **"Applied promotion" is not the glossary's Promotion.** In CONTEXT.md **Promotion** is the
  stock-withdrawal reason and stays so until the rename to "Marketing" ships. This ADR, the Planned
  passages and the code of the promotions parts say "applied promotion", the table says
  `sale_promotion`, and neither borrows the glossary word for a sale-side offer.
- **Ordering rule.** The withdrawal rename ("Promotion" to "Marketing") merges before any
  `sale_promotion` code, so the word never means both things in the code or on a screen at once.

## Consequences

- Every figure about promotions reads typed rows and typed columns, so a report can group and sum them
  in SQL, in the business's scale, through the money adapter helper (ADR-0057).
- A sale saved before promotions exist, and every existing sale, has no `sale_promotion` row and
  reads exactly as today. Nothing is backfilled.
- A promotion's name and kind are stored twice (in the promotion and in the snapshot); that is the
  point, and the reason an edit changes nothing in the past.

## Considered and rejected

- **A JSON snapshot on the sale**: untyped, unsummable in SQL, and an amount in it would break ADR-0057.
- **Recompute the applied promotions from the current definitions on read**: an edit or an archive
  would rewrite history, which the PRD forbids.
- **Only a per-line discount, no per-sale row**: it cannot say which promotion gave a gift line, nor
  show the promotion on the sale detail, the shared sale, the catalog and the bot without recomputing.
