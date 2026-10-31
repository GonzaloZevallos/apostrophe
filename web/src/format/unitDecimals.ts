/**
 * The unit's decimals on a typed quantity (`docs/product/units.md`): whether what a person
 * typed has more decimals than the product's unit allows, and the key of the sentence that
 * says what the unit allows. The check reads the typed value, so "1,50" is as fine as "1,5"
 * for a unit of one decimal; nothing is ever rounded. The server's `Unit.admits` is the rule;
 * this only turns the seller back before the request.
 */

import { useTranslation } from 'react-i18next'

const TYPED_NUMBER = /^-?\d+(?:[.,](\d*))?$/

/** How many decimals the typed value really has, trailing zeros not counted; `null` when the
 * text is not a plain number (the field's own validation says that). */
export function typedDecimals(text: string): number | null {
  const found = TYPED_NUMBER.exec(text.trim())
  if (found === null) return null
  return (found[1] ?? '').replace(/0+$/, '').length
}

export function exceedsDecimals(text: string, decimals: number): boolean {
  const typed = typedDecimals(text)
  return typed !== null && typed > decimals
}

/** The sentence under a quantity field that has too many decimals for its unit. */
export function useDecimalsSentence(): (decimals: number) => string {
  const { t } = useTranslation()
  return (decimals) => {
    if (decimals <= 0) return t('units:wholeUnitsOnly')
    if (decimals === 1) return t('units:upToOneDecimal')
    return t('units:upToDecimals', { count: decimals })
  }
}
