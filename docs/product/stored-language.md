# Stored language

## Jobs

- When my business works in a language other than English, I want to set that language once for the whole business, so that every screen and the pinned catalog's fixed lines follow it. Then I run the business without translating in my head, and customers never see a catalog that mixes languages.

## What it is

Every business has exactly one stored language, a **Language** tag. The words in other languages arrive with #317. Until then English is the only **Selectable language**, the language control does not show, and nothing visible changes for anyone.

The language covers the app's own texts only (**Product language**). It never touches the seller's own data: variety names, aroma, notes, expense categories, and the catalog header and footer stay exactly as stored. Number and date formats stay Argentine.

## Stored and shown language

- A business that existed before this capability has English, stored explicitly.
- Only a user's choice changes the stored language. Nothing else does, including a change to the selectable list.
- **Shown language:** a screen is shown in the operator's forced language when one is set, and in the stored language otherwise. The front renders by the shown language.
- The language control reads and shows the stored language, never the forced one.
- A business whose stored language has dropped off the selectable list keeps it, and its screens still follow the rule above. The operator keeps the list consistent with the copy that exists, so there is no fallback rule.

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

## Pinned catalog

- A language change triggers **Upkeep**. Upkeep edits the pinned message in place only when the catalog text differs from the **Last published text** of the current bot and channel chat, and never posts or pins.
- At most one edit is sent per change.
- Nothing is sent when the chosen language is the one already stored, when the text comes out identical, or when the business has no pinned catalog.
- A failed edit shows **Out of date**, and the language change still stands.

## New business

- A business opened by a new-business invitation starts in the accepting phone's language (`Accept-Language`), among the selectable languages, or in English when none matches.
- This is the only time the phone's language is read. Afterwards only the stored language counts.
- A business joined through an invitation keeps its own language.

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
