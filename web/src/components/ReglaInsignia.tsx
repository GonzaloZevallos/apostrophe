/**
 * `ReglaInsignia` (plan, invariants: "the pricing rule's word and tone only from
 * `ReglaInsignia`/`RULE_BADGE`"): the one place a `PricingRule` becomes a word and
 * a tone. `lista` is the neutral pill (`sales/pricing.ts`'s `'list'`); every other
 * rule — `bulk`, `vip`, `gift`, `special` — gets the accent, same as
 * `Componentes.dc.html`'s `LineaVenta` demo. The word always shows (accessibility
 * rule 2): the rule is never told by color alone.
 */

import type { PricingRule } from '../sales/pricing'
import Insignia from './Insignia'
import { COMMON_TEXT } from '../copy/common'
import { SALES_TEXT } from '../copy/sales'

const RULE_BADGE: Record<PricingRule, { text: string; tone: 'neutro' | 'acento' }> = {
  list: { text: SALES_TEXT.ruleList, tone: 'neutro' },
  bulk: { text: SALES_TEXT.ruleBulk, tone: 'acento' },
  vip: { text: COMMON_TEXT.vip, tone: 'acento' },
  gift: { text: SALES_TEXT.ruleGift, tone: 'acento' },
  special: { text: SALES_TEXT.ruleSpecial, tone: 'acento' },
}

export default function ReglaInsignia({ rule }: { rule: PricingRule }) {
  const badge = RULE_BADGE[rule]
  return <Insignia tono={badge.tone}>{badge.text}</Insignia>
}
