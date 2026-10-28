---
status: accepted
date: 2026-10-25
---

# Columns keep variety_id until #75 while code and the API say Product

GH-318 part 1. Epic GH-318 lets a business call what it sells anything it likes (the PRD's "Product word" section
in `docs/product/business-configuration.md`; the glossary's **Product** entry names the code word). This records which names change in code and which stay, so the epic's parts agree
before any of them builds. It changes no behaviour and amends no earlier ADR.

## What the PRD says

From `docs/product/business-configuration.md` at commit c4286c2cab8e4a4160292d15921c552fcae3f3f3:

> Code, tests and docs say Product.

> The seller chooses the word for what is sold, singular and plural. The default is "Product" / "Products".

> "Variety" / "Varieties" as its word

The last line is what an existing business keeps (section "Existing businesses"). So Variety is one
business's screen word; Product is the name of the thing.

## Decision

- **A column that references `variety.id` stays `variety_id`** (or ends in `_variety_id` when it
  needs a role prefix) until #75, the rename of the database's names. The table class's attribute
  has the column's own name (CODING_STANDARDS §11, "A new column's mapped attribute has the
  column's own name"). A new table added by the epic that references `variety.id` is named the same
  way, so `test_naming.py`'s rule on foreign keys holds without a new allowlist entry. The `variety`
  table itself is not renamed here.
- **Domain, ports and API say Product.** A domain attribute, a port parameter and an API field are
  `product_id` / `product`, never `variety_id`. The only place the two names meet is the repository
  adapter, which maps `product_id` to the `variety_id` column and back. No use case and no router
  imports a table class.
- **The API path becomes `/api/products`.** A later part of the epic moves the router that is mounted
  at `/varieties` today. That changes the URLs the front's `fetch` calls and nothing else: no screen,
  no stored value, no front route.
- **Front paths stay `/varieties/*`.** They are screen routes, shown to people in the address bar
  and listed in `scripts/design/screens.json`. ADR-0024 (the allowlist of front paths that share a
  first segment with the API) and ADR-0033 are untouched, and so is `scripts/design/screens.json`. No
  front path starts with `/products`, so ADR-0024's allowlist is not affected by the new API path.
- **Docs.** CONTEXT.md gets a Product entry, true today, and Variety points to it. Until the epic's
  parts ship, a doc that describes what is true today still says Variety where it means the screen
  word.

## Why

- Renaming a column is a migration that rewrites a table in SQLite, and a name change is the work
  #75 already owns. Doing it here would break the rule that no task other than #75 touches the
  naming allowlist's names, and would put a data risk inside an epic about configuration.
- Keeping the mapping in the adapter is the hexagon's own rule (CODING_STANDARDS §1): the domain
  speaks the product's language and the adapter speaks the database's.
- Leaving the front paths alone keeps every bookmark and the design-capture list working.

## Rejected

- **Rename `variety_id` to `product_id` in the database inside GH-318.** It is #75's work, and it
  would touch every table that references a variety.
- **Keep `variety` in domain and API too.** The epic's whole point is that Variety is one business's
  word; a code base that says Variety everywhere would teach the next reader the wrong thing.
- **Move the front paths to `/products/*`.** The screens are shown with the business's own word, so
  no one word fits the address bar, and ADR-0024 and the design list would change for no gain.
