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

## Amendment (2026-10-05): where the catalog is reached and edited, after GH-58

**Supersedes** nothing above; this records where the navigation redesign (GH-58)
places screens this ADR's text already assumed existed, without changing the one
function or the pairing rule.

- The catalog screen opens from Variedades → "Mandar catálogo" and from Inicio's
  out-of-date notice. There is no separate Catálogo entry in Más any more.
- Catalog attributes (what this ADR's "entries" are built from) are edited only on a
  variety's own page, in its "En el catálogo" section — never on the catalog screen
  itself.
- The header and footer are edited in Configuración → Mensaje del catálogo, not on
  the catalog screen.
- The preview this ADR describes ("Cómo se ve en Telegram") lives at
  `web/src/screens/telegramPreview.ts`; `web/src/catalog/` is not where it is — that
  path was this ADR's placeholder, not the file that shipped.

## Amendment (2026-10-25): what Copiar and Compartir hand out, after GH-364

**Supersedes** this ADR's "the copied text is always the raw text". Everything else
above stands.

- **Copiar and Compartir hand out `plainCopy(catalog.text)`**
  (`web/src/screens/catalogCopy.ts`): the API's text with every paired `**` removed and
  every line break kept. Telegram on iPhone reads Markdown in pasted plain text, so the
  `**` around each name became bold and a lone `\n` collapsed to a space (the owner's
  screenshot). Without a paired marker there is nothing for that parse to act on.
- **The pairing is still written once.** `plainCopy` joins the text of
  `telegramPreview`'s segments, so it pairs left to right exactly as the preview does,
  keeps a final unpaired `**` as typed, and no other module splits, strips or matches
  `**`.
- **`catalog.text`, the preview and the bot keep the markers.** The server's text and
  the pinned catalog Telegram's API receives are unchanged; the preview still shows bold.
- **A rich `text/html` clipboard entry was considered and held.** It would keep the
  names bold in a paste, but no paste before merge could show that it survives Telegram
  iOS, WhatsApp and a desktop target with every line break intact, and it must never
  outrank the plain version reading right everywhere. If bold names are wanted back, it
  is a later task backed by the owner's pastes.
- The preview's path is `web/src/screens/telegramPreview.ts`, as the amendment above
  already says; the Decision's `web/src/catalog/telegramPreview.ts` was a placeholder.

## Amendment (GH-384): the catalog's money and quantity formats follow the business

Planned in GH-318, not yet in the code. One sentence of this ADR is narrowed by docs/adr/0058-money-crosses-the-wire-in-currency-units-as-decimal-and-is-stored-per-business-at-scale-0-or-2-behind-one-adapter-helper.md, in the money
part, and by docs/adr/0056-a-stored-quantity-is-a-whole-number-of-hundredths-whatever-the-unit-and-decimals-only-validate-and-display.md, in the units part; until those parts ship the sentence describes what runs.

> It owns the catalog's own formats, `$11.000` and
> `10 g` / `2,5 g`

Narrowed: the amount follows the business's currency symbol and money decimals (ADR-0058), and the
quantity takes its places from its unit's decimals and its label from the unit itself (ADR-0056). The
text is still written by this one function.
