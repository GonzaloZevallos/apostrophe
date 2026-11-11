/**
 * `ReglaInsignia` (plan, invariants: "the pricing rule's word and tone only from
 * `ReglaInsignia`/`RULE_BADGE`"): the one place a `PricingRule` becomes a word and
 * a tone. `lista` is the neutral pill (`sales/pricing.ts`'s `'list'`); every other
 * rule — `bulk`, `vip`, `gift`, `special` — gets the accent, same as
 * `Componentes.dc.html`'s `LineaVenta` demo. The word always shows (accessibility
 * rule 2): the rule is never told by color alone.
 */

import { useTranslation } from 'react-i18next'
import type { PricingRule } from '../sales/pricing'
import Insignia from './Insignia'
import { SALES_TEXT } from '../copy/sales'

type Tone = 'neutro' | 'acento'

/** The word is plain copy of the sales area or a `common:` key resolved in render. */
const RULE_BADGE: Record<PricingRule, { word: string | { common: 'common:vip' }; tone: Tone }> = {
  list: { word: SALES_TEXT.ruleList, tone: 'neutro' },
  bulk: { word: SALES_TEXT.ruleBulk, tone: 'acento' },
  vip: { word: { common: 'common:vip' }, tone: 'acento' },
  // The word of a type line is the line's own copy of the type's name, not copy of ours.
  type: { word: '', tone: 'acento' },
  gift: { word: SALES_TEXT.ruleGift, tone: 'acento' },
  special: { word: SALES_TEXT.ruleSpecial, tone: 'acento' },
}

interface ReglaInsigniaProps {
  rule: PricingRule
  /** The type's name as it was when the line was priced; the word of a `'type'` line. */
  typeName?: string | null
}

export default function ReglaInsignia({ rule, typeName = null }: ReglaInsigniaProps) {
  const { t } = useTranslation()
  const badge = RULE_BADGE[rule]
  if (rule === 'type') {
    // The full name is the DOM text, so it is also the accessible name; CSS ends it in an ellipsis.
    return typeName === null ? null : (
      <Insignia tono={badge.tone} truncable>
        {typeName}
      </Insignia>
    )
  }
  return <Insignia tono={badge.tone}>{typeof badge.word === 'string' ? badge.word : t(badge.word.common)}</Insignia>
}
