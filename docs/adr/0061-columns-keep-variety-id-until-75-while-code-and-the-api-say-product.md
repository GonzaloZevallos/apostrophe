---
status: accepted
date: 2026-10-25
---

# Columns keep variety_id until #75 while code and the API say Product

Epic GH-318 lets a business call what it sells anything it likes (the "Product word" section of the
PRD, `docs/product/business-configuration.md` on the epic's branch; it is not in `docs/product/` at
this commit). The glossary does not yet have a **Product** entry: it is planned in CONTEXT.md and
moves into the glossary proper with the Product rename on the wire. This records which names change in code and which stay, so the epic's parts agree
before any of them builds. It changes no behaviour and amends no earlier ADR.

## What the PRD says

From `docs/product/business-configuration.md` on the epic's branch, at commit c4286c2cab8e4a4160292d15921c552fcae3f3f3:

> Code, tests and docs say Product.

> The seller chooses the word for what is sold, singular and plural. The default is "Product" / "Products".

> "Variety" / "Varieties" as its word

The last line is what an existing business keeps (section "Existing businesses"). So Variety is one
business's screen word; Product is the name of the thing.

## Decision

- **A column that references `variety.id` stays `variety_id`** (or ends in `_variety_id` when it
  needs a role prefix) until #75, the rename of the database's names. The table class's attribute
  has the column's own name (CODING_STANDARDS §11, "A new column's mapped attribute has the
  column's own name"; its Scope section says "Old and new names coexist until #75", which this
  agrees with and neither amends nor adds an allowlist entry to). A new table added by the epic that references `variety.id` is named the same
  way, so `test_naming.py`'s rule on foreign keys holds without a new allowlist entry. The `variety`
  table itself is not renamed here.
- **Domain, ports and API say Product.** A domain attribute, a port parameter and an API field are
  `product_id` / `product`, never `variety_id`. The only place the two names meet is the repository
  adapter, which maps `product_id` to the `variety_id` column and back. No use case and no router
  imports a table class.
- **The API path becomes `/api/products`.** The Product rename on the wire moves the API routes that are
  mounted at `/varieties` today (the varieties router, the stock entries router and the catalog
  router's `/varieties/{variety_id}`), and puts them under `/api`, under which no route sits today.
  That changes the URLs the front's `fetch` calls and nothing else: no screen, no stored value,
  no front route.
- **Front paths stay `/varieties/*`.** They are screen routes, shown to people in the address bar
  and listed in `scripts/design/screens.json`. docs/adr/0024-a-front-path-may-share-its-first-segment-with-the-api-only-through-an-exact-allowlist-served-to-browser-navigations.md (the allowlist of front paths that share a
  first segment with the API) and docs/adr/0033-front-paths-are-id-templates-the-legacy-rows-live-once-in-app-and-screens-json-is-cross-checked.md are untouched, and so is `scripts/design/screens.json`. No
  front path starts with `/products` or `/api`. Once the API leaves `/varieties`, the `/varieties`
  rows of `SHARED_FRONT_PATHS` (today in app/static_spa.py) no longer share a first segment with
  an API route; whether the Product rename on the wire prunes them is that part's call, and this
  ADR changes none of them.
- **Docs.** CONTEXT.md keeps the **Variety** entry as it is and carries Product only in its closing
  "Planned in GH-318 (not yet in the code)" block; the Product rename on the wire moves it into the
  glossary proper. Until then, a doc that describes what is true today still says Variety where it
  means the screen word.

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
  no one word fits the address bar, and docs/adr/0024-a-front-path-may-share-its-first-segment-with-the-api-only-through-an-exact-allowlist-served-to-browser-navigations.md and the design list would change for no gain.
