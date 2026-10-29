import { useTranslation } from 'react-i18next'
import type { CopyKey } from './resources.generated'

/**
 * A word a holder hands to its component: a key to resolve on every render, or the text of a
 * record's own name (a customer, a variety, the business), which is data and never a key.
 * Defined here once; nothing else declares its own copy.
 */
export type Label = { kind: 'key'; key: CopyKey } | { kind: 'text'; text: string }

/** Resolves a label on this render: a key through `t`, a text verbatim. */
export function useLabel(): (label: Label) => string {
  const { t } = useTranslation()
  return (label) => (label.kind === 'key' ? t(label.key) : label.text)
}
