---
status: accepted
date: 2026-11-01
summary: "la palabra en pantalla es siempre Product y no existe ningún ajuste de palabra"
---

# The screen word is always Product, and no product-word setting exists

Amends docs/adr/0061-columns-keep-variety-id-until-75-while-code-and-the-api-say-product.md and
docs/adr/0055-configuration-is-stored-per-business-in-hexagons-split-by-reason-to-change-with-frozen-shared-values-read-through-each-reader-s-own-protocol.md.

Epic GH-318, part 13. On 2026-10-29 the owner rescoped the epic's "Product word": there is no
configurable word. A business may sell many kinds of things, so one word chosen by the seller would
not fit them all; it would also change no data and would make every text a variable in singular,
plural and every language. This records what that settles, so the parts that edit copy, the docs and
the sweeps agree before any of them builds.

## Decision

- **The screen word is always Product / Products, through the Copy module, for every Business.** This
  supersedes only the sentence of ADR-0061 that says Variety remains the on-screen word for existing
  businesses. An existing business, the owner's included, switches with nothing to do, and none of its
  data changes: product names, notes, the saved Catalog header and footer, Expense categories.
- **No product-word setting, column or API field exists.** No route, schema field or column stores or
  serves a word chosen by the Business. Settings and Onboarding do not ask "What you sell". The
  Unit is chosen per product when it is created (#390), never asked in Onboarding.
- **ADR-0055's planned "Product word" is withdrawn.** The `categories` hexagon of ADR-0055 does not
  hold a product word, the frozen shared value of that name is not built, and the "Variety" /
  "Varieties" row an existing business would have been given is not written.
- **A permanent word sweep guards it.** One test reads the resolved front copy texts and one reads the
  resolved back-end texts and the Operator's output; neither scans source files. The only exception is
  text quoted from the seller's spreadsheet (the column "Variedad" on an import problem line) and the
  seller's own data.

## Identifiers that stay until the `variety` table is renamed

These keep their names, and this is the one accepted exception to CODING_STANDARDS §2 (no renamed
identifier) for this epic. Only the text a person reads changes.

- Copy keys, and the Copy module's file names.
- Component, screen and file names, and spec file names.
- TS types.
- Wire fields and enum values, such as the step slug `variety`, `start_varieties` and
  `priced_variety`.
- Domain error codes `variety.*` and their English `detail`, which is a diagnostic that is never
  shown.
- Docstrings and comments.
- Design registry ids.
- `variety_id` columns, and the `variety` table.
- The front paths `/varieties/*` and the legacy redirects.

ADR-0061's rules on columns, front paths and hexagon names still hold.

## The one renamed identifier

The import problem kinds become `import.unknown_product` and `import.duplicate_product`, because the
Operator reads them on the terminal and they are text a person reads. They are the only renamed codes.

## Why

- The seller's word was a setting only to fit a flower seller's language to other businesses. One word,
  Product, fits all of them and removes the variable from every sentence.
- Renaming identifiers would touch every table and test for no change a person sees; the database names
  are left alone until the `variety` table is renamed, and ADR-0061 already keeps the front paths.
- A sweep over resolved text, not source, catches a copy value that reintroduces the word without
  forbidding the identifiers that stay.

## Rejected

- **Keep Variety for existing businesses.** It makes the word depend on the Business and its history,
  which the owner's rescope removes.
- **A per-Business product word.** One word chosen by the seller does not fit a business that sells
  many kinds of things.
- **Rename the identifiers now.** It is the database renaming's work and changes nothing on screen.
