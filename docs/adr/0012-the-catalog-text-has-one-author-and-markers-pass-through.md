---
status: accepted
date: 2026-10-03
---

# The catalog text has one author; a seller's `**` markers pass through, paired left to right

The catalog (docs/product/catalog.md) is a text copied by hand today and sent by the
Telegram bot in #10 tomorrow. The front shows it as Telegram will ("Cómo se ve en
Telegram"), the reference-set test pins it, and #10 will send it. If any of those
builds the text on its own, the preview, the clipboard and what customers read drift
apart on the first edge case: a blank header, `2,5 g`, `$10.000`, or a `**` typed by
the seller.

## Decision

- **One pure function writes the text**: `app/catalog/domain/text.py::catalog_text(header,
  footer, entries) -> str | None`. It owns the catalog's own formats, `$11.000` and
  `10 g` / `2,5 g`, as private helpers reading `Grams.hundredths`. Nothing is added to
  `app/shared/` for them. `None` means nothing qualifies, even with a non-blank header or
  footer. #10 calls this same function.
- **The front never assembles the text.** `GET /catalog` answers `text`, and the
  preview is derived only by `web/src/catalog/telegramPreview.ts`, which pairs `**`
  left to right over the whole text, bolds what each pair encloses and shows a final
  unpaired `**` as typed. No component splits on `**` itself.
- **Markers typed by the seller pass through** (PM, round 2). The header, footer,
  aroma and variety name may all contain `*`. The builder wraps the name in `**` and
  never escapes or strips anything; the copied text is always the raw text. #10 must
  turn markers into bold with the same left-to-right pairing.
- **In or out comes from stock's status**, through the catalog's own `CatalogStock`
  port (`low | ok` is in). The catalog never compares grams (ADR-0006, ADR-0010).
- **The screen never shows cached text.** The catalog query uses `gcTime: 0`,
  `staleTime: Infinity`, and no refetch on focus or reconnect. Copiar renders only after
  the current open's fetch has resolved.

## Consequences

- #10 inherits a requirement: the same pairing, or the preview lies about what
  customers see.
- A variety name or aroma with an odd number of `**` renders with a literal trailing
  `**`; that is accepted behaviour, not a bug.

## Considered and rejected

- **The front builds the preview from structured fields**: two authors of one text.
- **Refusing `*` in the aroma (PM's option a)**: a refusal nobody asked for, and the
  header and the name could still carry markers.
- **A grams format method on `Grams`**: a rioplatense presentation rule in the shared
  kernel, which other hexagons would reuse and then change.
