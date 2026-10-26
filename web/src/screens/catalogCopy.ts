/**
 * `plainCopy`: what Copiar writes to the clipboard and Compartir hands the share sheet.
 * It is the API's `text` with every paired `**` removed and every line break kept, so
 * Telegram's Markdown-on-paste has no marker to turn into bold. It is a fold over
 * `telegramPreview`'s segments, so the pairing is the preview's own and this module
 * never looks at `**` itself (plan, invariants).
 */

import { telegramPreview } from './telegramPreview'

export function plainCopy(text: string): string {
  return telegramPreview(text)
    .map((segment) => segment.text)
    .join('')
}
