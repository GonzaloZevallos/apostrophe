---
status: accepted
date: 2026-10-02
---

# A sale stores whole-peso line totals and records its on-the-spot payment as a payment row

Sales (docs/product/sales.md) price each line from the day's prices and keep that price
(docs/adr/0003). Grams carry hundredths and prices are whole pesos (docs/adr/0001), so
grams × price is not always a whole peso, and a special price is a typed total whose
rate per gram is not either. Payments made later and balances come in #4, which must
count a sale paid on the spot as money received without migrating anything.

## Decision

- **A sale line stores `line_total` in whole pesos, and it is the authoritative figure.**
  It is computed once, when the sale is recorded, by `line_total(price_per_gram, grams)`
  in `app/sales/domain/pricing.py`: half up to the peso, in integer arithmetic on
  hundredths. A sale's total is the sum of its stored line totals plus shipping charged.
  Nothing recomputes a total from price × grams.
- **Every line stores `price_per_gram` as a whole peso** and its `pricing_rule`. A gift
  stores 0. A special line stores its typed total over its grams, rounded half up by
  `special_rate` in the same module. That rate is for display only and never feeds a
  total. These two functions are the only roundings in sales; `round()`, `float` and
  `Decimal.quantize` stay out of its money paths.
- **The on-the-spot payment is a row in a `payment` table**: `business_id`, `paid_on`,
  `amount`, `method`, a nullable `customer_id` and a nullable `sale_id`. It is part of the
  `Sale` aggregate in the domain. A $0 sale and a sale left owing have none.
- **A payment's customer equals its sale's customer.** Assigning a customer later sets
  both, through updates guarded by `customer_id IS NULL`, in one commit. This rules out
  a phantom debt in #4's balances and a customer swapped by two users at once.
- **The table's name and columns are #4's contract.** The Python class lives in
  `app/sales/adapters/tables.py` until #4's payments hexagon moves it, with no migration.

## Consequences

- #4 reads one payment shape for both on-the-spot and later payments, and finds a
  customer's payments by `customer_id` with no join through `sale`.
- The customer is a duplicated fact on sale and payment. The domain and the guarded
  repository write are the only places that keep the two in step.
- Deleting a sale deletes its lines and payment explicitly, in the repository, rather
  than by database cascade.

## Considered and rejected

- **Store only the price per gram and compute the total on read**: every reader would
  round on its own, and a special price has no whole rate to compute from.
- **A `null` price per gram on a special line**: PM's answer asks for the rate to be
  stored.
- **A payment derived through `sale_id`, with no `customer_id`**: #4 would need two
  payment shapes and a join on every balance read.
- **A field on the sale instead of a payment row**: #4 would have to migrate it into
  payments.
