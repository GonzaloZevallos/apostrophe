---
status: accepted
date: 2026-10-28
---

# Customer-type prices are effective-dated rows, and the VIP mark and VIP price columns stay frozen in place

Amends ADR-0034.

GH-318 part 1. Today one customer mark, `customer.vip`, and one nullable price per price entry,
`price_entry.vip_price`, make up the VIP rule (ADR-0034). The business-configuration PRD
(docs/product/business-configuration.md, read at commit c4286c2cab8e4a4160292d15921c552fcae3f3f3)
replaces them with customer types. This records how their prices are stored and what happens to the
old columns. No code changes in this part.

## What the PRD says

- "Customer types replace the single VIP mark. Each type has its own price per product."
- "List, bulk and customer-type prices stay switchable per business, as Pricing settings are today."
- "A new business starts with no customer types."
- Of an existing business: "bulk, and VIP as a customer type" and "No stored row is rewritten by the
  migration."
- "A line keeps its pricing rule: list, bulk or the customer type's price."

## Decision

- **A customer type's price is a row, dated.** A table of customer-type prices holds `business_id`
  (not null), the customer type, the product, the price and the date from which it applies, the way
  a price entry already is dated. The price in force on a day is the latest row on or before it. A
  type has at most one price per product on a day. Editing a price adds a row; it never changes an
  earlier one, so past days keep the price they had. The price is an amount held in a column declared
  with `money_column()` (ADR-0057). The table belongs to the `customer_types` hexagon (ADR-0054),
  and the product is referenced by a `variety_id` column (ADR-0060).
- **A customer has at most one type.** The customer gains a reference to a customer type, which is a
  new nullable column; a customer with none pays no customer-type price.
- **`customer.vip` and `price_entry.vip_price` are frozen in place.** They stay in their tables with
  the values they hold. No migration changes or drops them, and the new code stops writing and reading
  them. They are history, not a second source of truth. The migration that builds this adds rows and
  fills new columns only (the PRD's "No stored row is rewritten by the migration"):
  - one customer type, "VIP", for each business that exists;
  - for each customer with `vip` set, the new type reference to it;
  - for each price entry with a `vip_price`, one customer-type price row for VIP, dated as the entry
    is and holding the same amount.

  A new business starts with no customer types, so none of this applies to it.
- **The pricing switches stay in their table.** `pricing_settings` keeps its row per business and its
  two columns. `is_vip_customers` is the switch for customer-type prices: its name and stored value
  stay, and only the screen word changes in the part that builds the Settings. This keeps ADR-0034's
  "off stores nothing new and deletes nothing": switching it off stops customer-type prices applying to
  new sales and keeps every type, every price and every customer's type.
- **The pricing rule keeps its shape.** The lowest applicable of list, bulk and the customer's type
  price prices a line (ADR-0034), with the type price looked up for the sale's day. Lines already
  recorded keep their price and rule (ADR-0003); a stored rule `vip` stays valid and reads as the
  customer type VIP of an existing business. How a new line names its type is decided where the rule
  is built.

## Consequences

- ADR-0034's "VIP price" and "Clientes VIP" become, from the part that builds this, a customer type's
  price and the customer-types switch. Until then they describe what runs.
- An existing business sees no change: its VIP customers pay the VIP prices they paid, now read from
  rows.
- Two sources of the same figure exist in the database (the frozen column and the row). Only the row
  is read after the migration, and a test over the migration finds the two equal at that moment.

## Considered and rejected

- **Rename `vip` and `vip_price`, or drop them**: it rewrites a stored column and breaks the migration
  rule that no existing value changes.
- **Keep reading `vip_price` for VIP and rows for other types**: two readers for one rule, and a VIP
  price edited after the migration would have two homes.
- **A price per type on the price entry itself**: it would need a column per type; a type is a row.
- **Make the switches rows of the customer type**: the PRD keeps them per business, and
  `pricing_settings` already owns that.
