---
status: accepted
date: 2026-11-02
---

# Payment methods are keyed by id, and the old `payment.method` column is frozen

Amends docs/adr/0055 (the `payment_methods` hexagon). Epic GH-318.

A payment's method was one of two words stored in `payment.method`, a `PaymentMethod` enum
copied into sales and payments. A business now owns its list, so a method is an id plus what
the seller reads (`PaymentMethodLabel`: id, name, icon).

- **Id keys.** `payment.payment_method_id` points at `payment_method`; no code compares a
  method's name or branches on Cash/Transfer. Both enums are gone.
- **`method` is frozen and nullable.** Migration 0026 fills the new column from the old value
  and keeps every stored value; a new payment writes NULL there and nothing reads it. The
  downgrade refuses once any payment has a NULL `method`. `tests/migrations/comparator.py`
  proves that no pre-existing column changes.
- **NOT NULL plus a composite foreign key.** `(business_id, payment_method_id)` references
  `payment_method(business_id, id)` ON DELETE RESTRICT: a payment can never point at another
  business's method, and a method in use cannot be deleted even by a racing statement.
- **The owing choice is a kind tag.** A sale's `payment` is
  `{"kind":"method",...} | {"kind":"owing"} | null` on the way in and
  `{"kind":"method",...} | {"kind":"owing"} | {"kind":"none"}` on the way out, never a string a
  method's name could equal.
- **One 404 for an unavailable method.** Unknown, archived or another business's method answers
  `payment_method.unavailable`, resolved inside the write statement against the business and
  `archived_at IS NULL`; nothing is committed. Display reads join the method whether or not it
  is archived.
- **`OnTheSpotPayments`.** Sales declares the port; `app/payments/adapters/on_the_spot.py`
  implements it and is the only code that writes a sale's `payment` row. Sales reaches it
  through `app.state`, wired in `app/main.py`.
- **Import by name.** The spreadsheet import's sales adapter turns the sheet's cash and
  transfer into "Cash" and "Transfer" and asks payment_methods to find or create the method;
  it is the only lookup by name.

ADR-0055 says the time-zone part creates the migration comparator; this part creates it.
