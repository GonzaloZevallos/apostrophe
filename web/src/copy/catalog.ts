/**
 * The words of the catalog screen (`Catalogo`) and of the pin's status card (`PinPublish`).
 * The always-on-screen lines are listed in `LIMITED_COPY` so `copy/copyLimits.test.ts`
 * measures the very bindings the screens render: its empty state, each "Out of date" reason
 * (`refusals.ts` owns the sentences, the server's reasons worded once) and the two lines that
 * say why Publish is blocked, with the link word the screen draws at their end.
 */

import { INTEGRATIONS, STATUS_NO_ENTRIES, STATUS_SOLD_OUT, WORD_COPY, WORD_SHARE } from './common.ts'
import {
  PINNED_CATALOG_NOT_READY_REASON,
  PINNED_CATALOG_REASON_LABEL,
  type PinReason,
} from './refusals.ts'
import type { LimitedCopy } from './limits.ts'

export const EMPTY_STATE_TITLE = 'Nothing in the catalog today'
export const EMPTY_STATE_DETAIL = 'Nothing to copy yet'

/** The catalog screen: its title, its two labels, its three actions and the link out. */
export const CATALOG_TITLE = 'Catalog'
export const PREVIEW_LABEL = 'How it looks in Telegram'
export const LEFT_OUT_LABEL = "What's left out and why"
export const SHARE = WORD_SHARE
export const COPY = WORD_COPY
export const PUBLISH = 'Publish'
export const EDIT_HEADER_AND_FOOTER = 'Edit header and footer'

/** The toast of a copied catalog and the two fixed failures of Copy and Share. */
export const CATALOG_COPIED = 'Catalog copied'
export const COPY_FAILED_MESSAGE = "Couldn't copy."
export const SHARE_FAILED_MESSAGE = "Couldn't share."
export const CATALOG_PUBLISHED = 'Catalog published'

/** The one word that says why a variety does not go out, by the server's `state`. */
export const LEFT_OUT_HIDDEN = 'hidden'
export const LEFT_OUT_NO_PRICE = 'no price'
export const LEFT_OUT_SOLD_OUT = STATUS_SOLD_OUT
export const LEFT_OUT_NO_ENTRIES = STATUS_NO_ENTRIES

/** The word of the link to Settings → Integrations that ends both blocked lines. */
export const INTEGRATIONS_LINK_WORD = INTEGRATIONS
export const CHANNEL_MISSING_LEAD = 'The channel is missing: add it in '

export const NOT_READY_LINE = `${PINNED_CATALOG_NOT_READY_REASON} · ${INTEGRATIONS_LINK_WORD}`
export const CHANNEL_MISSING_LINE = `${CHANNEL_MISSING_LEAD}${INTEGRATIONS_LINK_WORD}`

/** The title of the status line when the pin is up to date or behind; the reason follows the
 * second, and the last publish date ends either. */
export const UP_TO_DATE_TITLE = 'Up to date'
export const OUT_OF_DATE_TITLE = 'Out of date'
export const OUT_OF_DATE_SEPARATOR = ' · '

/** The separator is punctuation, the same in both languages. */
export const SAME_IN_BOTH = [{ value: ' · ', reason: 'a separator, not a word' }] as const
export const lastPublishedOn = (date: string) => `Last published on ${date}`

/** The notice as the seller reads it, "Out of date · <reason>", one per reason: the length is
 * measured on this, never on the bare reason. */
export const OUT_OF_DATE_TOO_LONG_LINE = `${OUT_OF_DATE_TITLE}${OUT_OF_DATE_SEPARATOR}${PINNED_CATALOG_REASON_LABEL.too_long}`
export const OUT_OF_DATE_LINES = {
  telegram_unreachable: `${OUT_OF_DATE_TITLE}${OUT_OF_DATE_SEPARATOR}${PINNED_CATALOG_REASON_LABEL.telegram_unreachable}`,
  bot_cannot_post: `${OUT_OF_DATE_TITLE}${OUT_OF_DATE_SEPARATOR}${PINNED_CATALOG_REASON_LABEL.bot_cannot_post}`,
  message_gone: `${OUT_OF_DATE_TITLE}${OUT_OF_DATE_SEPARATOR}${PINNED_CATALOG_REASON_LABEL.message_gone}`,
  missing_publish: `${OUT_OF_DATE_TITLE}${OUT_OF_DATE_SEPARATOR}${PINNED_CATALOG_REASON_LABEL.missing_publish}`,
  too_long: OUT_OF_DATE_TOO_LONG_LINE,
} as const satisfies Record<PinReason, string>

export const LIMITED_COPY: readonly LimitedCopy[] = [
  { kind: 'emptyTitle', text: EMPTY_STATE_TITLE },
  { kind: 'emptyLine', text: EMPTY_STATE_DETAIL },
  ...Object.values(OUT_OF_DATE_LINES).map((text): LimitedCopy => ({ kind: 'notice', text })),
  { kind: 'help', text: NOT_READY_LINE },
  { kind: 'help', text: CHANNEL_MISSING_LINE },
]
export const LONG_REFUSALS: readonly string[] = []
