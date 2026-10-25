# Stored language

## Jobs

- When my business works in a language other than English, I want to set that language once for the whole business, so that every screen and the pinned catalog's fixed lines follow it. Then I run the business without translating in my head, and customers never see a catalog that mixes languages.
- When my business works in a language other than English, I want my customers' catalog to speak that language from start to end, including the fixed lines and not just the header and footer I typed. I also want a business opened in that language to start with its header, footer and expense categories already in it. That way what customers read is consistent and I have nothing to translate or retype. While my business is in English, nothing I or my customers see changes at all.

## What it is

Every business has exactly one stored language, a **Language** tag. The words in other languages arrive with #317. Until then English is the only **Selectable language**, the language control does not show, and nothing visible changes for anyone.

The language covers the app's own texts only (**Product language**): screens, and the catalog's fixed lines that customers read. It never touches the seller's own data: variety names, aroma, notes, expense categories, and the catalog header and footer stay exactly as stored. Number and date formats stay Argentine, and the catalog's money and grams formats (`$11.000`, `2,5 g`) are the same in every language.

## Stored and shown language

- A business that existed before this capability has English, stored explicitly.
- Only a user's choice changes the stored language. Nothing else does, including a change to the selectable list.
- **Shown language:** a screen is shown in the operator's forced language when one is set, and in the stored language otherwise. The front renders by the shown language.
- The language control reads and shows the stored language, never the forced one.
- A business whose stored language has dropped off the selectable list keeps it, and its screens still follow the rule above. The operator keeps the list consistent with the copy that exists, so no rule ever replaces or changes a stored language.
- **Missing copy shows English.** Any text missing in the shown language, up to that language's whole copy file, shows its English text (the gettext fallback, language.md). This never changes the stored language and never makes an output fail.

## Changing the language

- Any user of the business may change it; there are no roles.
- The control is in Settings → Business, and only when more than one language is selectable.
- Each language is named in its own language ("English", "Deutsch"), the same whatever the shown language.
- The control marks the stored language as current, even when it is off the selectable list, and offers only selectable languages to switch to.
- A choice saves at once, with no Save step. The next render follows the new language.
- After switching away from a language that is no longer selectable, the user cannot switch back until it is selectable again.

## Refusal

- A value that is not selectable is refused with `business.language_not_selectable`.
- The test locale `en-XA` is never selectable, and no request can select it. Only the operator's forced language shows it, and that overrides what is shown, never what is stored.
- The refusal can only come from a stale screen.
- The user sees a plain sentence from the copy module, chosen by the code and never taken from the response's detail: "That language isn't available for your business." It never names the test locale or gives a reason.
- The stored language stays as it was. The control marks it as current again and offers only the languages selectable now.

## Catalog and pinned catalog

- **Fixed lines follow the shown language.** The catalog's fixed lines are the share line, "Aroma/flavor", "Price per gram", the "From … each" bulk line and the empty line "Nothing to offer for now." (catalog.md). They come in the business's shown language, worked out at the moment each output runs: the catalog screen, Test it, Publish and upkeep (including the start-of-day run). In English they are byte-identical to the baseline `en.baseline.json`.
- **The catalog reads the language through its own port.** The catalog's own adapter over accounts is the only place it reads a business's language, and the only place the forced override is applied for it. Upkeep reads the language in its own session, after the triggering commit.
- **A language without copy never stops the catalog.** If the shown language has no copy at all (its copy file removed), the catalog screen, Test it, Publish and upkeep all build the full catalog with English fixed lines. The stored language stays as it is, no error reaches the seller and no new Out of date reason is added. Upkeep follows its usual rule and edits only when the text differs. Once the copy is back, the next upkeep, at the latest the start-of-day run, restores that language's lines. Customers are never left on stale prices because copy is missing.
- A language change triggers **Upkeep**. Upkeep edits the pinned message in place only when the catalog text differs from the **Last published text** of the current bot and channel chat, and never posts or pins.
- At most one edit is sent per change.
- Nothing is sent when the chosen language is the one already stored, when the text comes out identical, or when the business has no pinned catalog.
- A failed edit shows **Out of date** with the reason that fits from the existing fixed list (no new reason), and the language change still stands.
- A language change is not a change to the **Bot settings**, so it requires no new **Test send**. A test sent before a change and a publish after it may differ in language; each shows the catalog as it stands at its moment.
- **Forced language:** while the operator has it on, the catalog screen, Test it, Publish and upkeep all use `en-XA`. Switching it on or off adds no trigger of its own: the next upkeep picks it up, at the latest the start-of-day run.

## New business

- A business opened by a new-business invitation starts in the accepting phone's language (`Accept-Language`), among the selectable languages, or in English when none matches.
- This is the only time the phone's language is read. Afterwards only the stored language counts.
- A business joined through an invitation keeps its own language.
- **Defaults in the stored language:** the new business is opened with the default catalog header and footer and the four default expense categories in its stored language, taken through the `BusinessDefaults` port (catalog.md, expenses.md).
  - They are stored as the business's own data. A later language change never rewrites them, and the seller edits them in Settings as before.
  - They follow the stored language, never the shown one, so they are never written in `en-XA`, even while the forced language is on.
  - Any default missing in that language is written in English. The opening never fails for lack of copy.
  - In English they are byte-identical to the baseline.
  - Businesses that existed before the defaults followed the language keep what they stored, with no backfill.

## Isolation and export

- The business always comes from the session. No request names a business, and no answer reveals another business's language or that it exists.
- The route that changes the language is gated by the session and belongs to the cross-business isolation checks.
- The stored language is part of the **Business export**.

## Metrics

The installation runs locally with no telemetry. Each metric is a figure the tests assert.

- **English kept:** existing businesses with `en` stored explicitly after the migration: 100%. Rows with no stored language: 0.
- **One-action change:** user actions from choosing a language in Settings → Business to the change being stored: 1, with no Save step.
- **Catalog quiet:** new posts or pins caused by a language change: 0. In-place edits per language change: at most 1. Edits on an unchanged choice or an identical text: 0. Language changes undone by a failed edit: 0.
- **Phone read once:** new businesses whose stored language matches the accepting phone's best selectable match, or English with no match: 100%. Reads of the phone's language outside accepting a new-business invitation: 0.
- **Test locale unreachable:** requests accepted that store `en-XA`: 0.
- **Catalog follows the language:** with a fixture `de` (`selectable_languages=("en","de")`), a business stored as `de` gets `de`'s fixed lines from `GET /catalog`, Test it, Publish and the start-of-day run; an `en` business in the same run is byte-identical to the baseline. A change from `en` to `de` on a business with a pin gives exactly 1 edit with `de` lines. 100% passing.
- **Missing copy falls back:** a business whose stored language has no copy file gets the full catalog with English fixed lines from `GET /catalog`, Test it, Publish and upkeep, and a new business opened in it gets the English defaults. Failed outputs, status changes to Out of date or changed stored languages caused by the missing copy: 0.
- **Defaults follow the stored language:** a business opened in `de` stores `de`'s header, footer and four categories; after a language change they are unchanged; businesses opened under the forced `en-XA` with defaults in `en-XA`: 0; rows changed in existing businesses: 0.
- **No leftover English:** under the forced `en-XA`, the catalog text, the pinned empty text and the defaults rendered from the defaults source leave 0 letters after removing `⟦…⟧` segments, stored data and money/grams tokens; a planted literal fails the check.
