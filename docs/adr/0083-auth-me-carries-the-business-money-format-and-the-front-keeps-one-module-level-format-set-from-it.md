---
status: accepted
date: 2026-11-10
---

# `/auth/me` carries the Business's money format, and the front keeps one module-level format set from it

Epic GH-318, part 20 (GH-403). Every front screen wrote money as `$` with 0 decimals. The
Business's symbol and decimals are now editable (ADR-0080), so the front needs one source for them.

## Note after the merge with master

Master landed GH-404 in parallel with the same purpose, and its front design is the one that shipped:
`/auth/me` carries `money`, and the front reads it through a provider and a hook, not through a
module-level format. Read the decision below for the reasons the front needed one source for the
format; where it names a module-level setter, the provider replaced it.

## Decision

- **`GET /auth/me` answers `money_format: {symbol, decimals}`.** It never carries the scale
  (ADR-0058). `me` is already the front's one clock and the only query the signed-in shell waits for.
- **The front keeps one module-level format** in `web/src/format/money.ts`, default `{symbol: "$",
  decimals: 0}`, read with `currentMoneyFormat()` and written with `setMoneyFormat()`. `formatMoney`,
  `formatMoneyMagnitude`, `formatSignedMoney`, `keepMoneyTogether`, `parseMoney`, `readMoneyInput` and the
  too-many-decimals message all read it; none keeps a copy of the symbol or the decimals.
- **The signed-in shell sets it before it mounts the outlet.** `GatedLayout` renders nothing until `me`
  has loaded, so no screen formats money in another Business's format. It sets the format in the render
  that mounts the outlet, which is idempotent.
- **A successful save of Currency and decimals** sets the `me` cache entry and invalidates every query, so
  every screen is written again with the new format. The shell sets the module format from the new `me`.
- **Another device** picks the change up on its next `me` load. Nothing is pushed.
- **Messages are read when shown.** A refusal map entry that holds the too-many-decimals text reads it
  through a getter or a function, never at import, because the decimals are known only after `me`.

## Alternatives considered

- **A React context.** Formatters are plain functions called from copy builders, sale bill rendering and
  parsers, outside any component. A context would reach none of them.
- **Passing the format to every formatter.** 34 files call `formatMoney`; the signature stays.

## Consequences

- Module state is shared by a whole page. Tests reset it with `resetMoneyFormat()`.
- A screen opened before a save keeps the old text until the query invalidation re-renders it.
