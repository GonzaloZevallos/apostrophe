---
status: accepted
date: 2026-10-28
---

# Configuration is stored per business in hexagons split by reason to change, with frozen shared values read through each reader's own Protocol

Amends docs/adr/0001-stack-and-shape.md.

Epic GH-318. Today the model is the flower seller's: the grams, the strain fields, the "Promotion"
withdrawal and the "$" are built in, and the one setting a business owns is the pricing switches
(docs/adr/0034-pricing-switches-live-in-their-own-table-and-the-lowest-applicable-rule-prices-a-line.md). The business-configuration PRD (`docs/product/business-configuration.md` on the epic's
branch, read at commit c4286c2cab8e4a4160292d15921c552fcae3f3f3; it is not in `docs/product/`
at this commit) makes each business define its own model. This records
where that configuration lives and how code reads it. No code changes here.

## What the PRD says

- "Each business defines its own model through settings with neutral defaults. There are no
  business-type presets (Assume nothing)."
- "Constraint: existing businesses keep working exactly as today. Each is migrated to its own
  configuration, equal to today's flower setup."
- "Customer types replace the single VIP mark. Each type has its own price per product."
- "Payment methods, withdrawal reasons and expense categories are the business's own lists."
- "Each business has its own currency symbol and money decimals (0 to 2), and the catalog's money
  format follows them."
- Of an existing business: "Each is migrated to one category and one subcategory holding emoji,
  indica share and aroma as attributes. The hidden flag stays on each product." and "No stored row is
  rewritten by the migration."

## Decision

- **Configuration is split into hexagons by reason to change.** Five, each its own root under `app/`
  and each added to `HEXAGON_ROOTS` in the diff that creates it (docs/adr/0001-stack-and-shape.md, CODING_STANDARDS section 1):
  - `units`: a business's units (name, short label, 0 to 2 decimals). It changes when units change.
  - `categories`: categories and subcategories, the attributes of a subcategory and their values, and
    the product word (singular and plural). They change together, since the word and the grouping
    name what the seller sells.
  - `customer_types`: the business's customer types. Their prices are docs/adr/0059-customer-type-prices-are-effective-dated-rows-and-the-vip-mark-and-vip-price-columns-stay-frozen-in-place.md.
  - `payment_methods`: the business's payment methods.
  - `money_format`: the business's currency symbol, money decimals and storage scale (docs/adr/0058-money-crosses-the-wire-in-currency-units-as-decimal-and-is-stored-per-business-at-scale-0-or-2-behind-one-adapter-helper.md).

  The time zone and phone country are docs/adr/0057-the-business-time-zone-replaces-argentina-days-today-is-worked-out-per-business-and-upkeep-is-due-when-its-last-check-was-not-on-the-business-s-own-today.md's and are not a hexagon of their own. The business's
  withdrawal reasons and expense categories are lists too (the PRD's "business's own lists"); they stay
  with the hexagons that already own those records, and the part that makes them editable records how.
  A hexagon owns its tables; only it writes them, and it meets another capability through the port
  that capability declares (docs/adr/0006-capabilities-meet-through-ports.md).
- **Frozen shared values live in `app/shared` and each reader reads them through its own Protocol.**
  This is the shape docs/adr/0034-pricing-switches-live-in-their-own-table-and-the-lowest-applicable-rule-prices-a-line.md gave `PricingSettings`: the value is a frozen dataclass in `app/shared`
  (a unit, the product word, the money format); a reader (sales, varieties, the catalog, the import)
  declares its own `current()`-style Protocol over it (ADR-0006) and `app/main.py` wires it to the
  owning hexagon's SQL class built for one business. No reader imports the owning hexagon.
- **Every new table carries a non-null `business_id`**, is read only through a repository built for one
  business, and a record of another business answers 404 (docs/adr/0004-businesses-never-mix.md). Removal, the export and the
  ownership test find the tables by reflection (docs/adr/0015-business-removal-reflects-the-schema-and-deletes-what-it-exported.md); the only hand-declared fact is an entry in
  `LABEL_AS_BUSINESS` where a table has no `business_id` of its own.
- **No default is read in code.** A repository whose business has no row raises a fixed error, as
  `PricingSettingsMissing` does. Every path that creates a business writes its rows in the same commit,
  through the business-opening composite (ADR-0034), with the PRD's neutral defaults: the product word
  "Product" / "Products", the unit "unit" with 0 decimals, "Products" and "General", "$" with 0
  decimals, "Cash" and "Transfer", and no customer types.
- **An existing business is given its configuration by adding rows, never by rewriting them.** The
  migration adds tables, columns and rows and fills new columns; it never changes the value of a column
  that existed before it. In the PRD's words: "No stored row is rewritten by the migration." So the
  flower setup of an existing business (the "grams" / "g" unit with 2 decimals, "Variety" /
  "Varieties", the one category and subcategory, VIP as a customer type, "$", "Cash" and "Transfer") is
  new rows, and the emoji, indica share and aroma of each variety are copied into attribute-value rows
  while the original columns stay as stored. The shared migration comparator that proves it does not exist yet: the time-zone part, the first
  to write a migration, creates it in `tests/migrations/`.

## Consequences

- docs/adr/0001-stack-and-shape.md's rule that a capability is a hexagon registered in `HEXAGON_ROOTS` is unchanged; it is
  applied five more times. Configuration is not one `settings` module that every capability imports.
- A reason to change (a unit, a category, a customer type, a payment method, the money format) edits one
  hexagon and the readers' Protocols it satisfies, not a shared table.
- Tables for these hexagons appear in later parts of the epic; until a part builds one, no table, route or
  hexagon described here exists.
- Columns that reference `variety.id` keep the name `variety_id` (docs/adr/0061-columns-keep-variety-id-until-75-while-code-and-the-api-say-product.md), also in these tables.

## Considered and rejected

- **One `settings` hexagon holding every configuration table**: it would change for five unrelated
  reasons, and every capability would depend on it.
- **A JSON document of configuration per business**: nothing in it could be queried, checked by a
  foreign key or tested for isolation, and an amount held there would break docs/adr/0058-money-crosses-the-wire-in-currency-units-as-decimal-and-is-stored-per-business-at-scale-0-or-2-behind-one-adapter-helper.md.
- **Reading configuration through the owning hexagon's own classes**: docs/adr/0006-capabilities-meet-through-ports.md forbids a capability
  from importing another's internals; the per-reader Protocol is what keeps the readers apart.
