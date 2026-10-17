/**
 * `ReglaInsignia` (plan, invariants: "the pricing rule's word and tone only from
 * `ReglaInsignia`/`RULE_BADGE`"): the one place a `PricingRule` becomes a word and
 * a tone. `lista` is the neutral pill (`sales/pricing.ts`'s `'list'`); every other
 * rule — `bulk`, `vip`, `gift`, `special` — gets the accent, same as
 * `Componentes.dc.html`'s `LineaVenta` demo. The word always shows (accessibility
 * rule 2): the rule is never told by color alone.
 */

import { RULE_BULK, RULE_GIFT, RULE_LIST, RULE_SPECIAL, RULE_VIP } from '../copy/common'
import type { PricingRule } from '../sales/pricing'
import Insignia from './Insignia'

const RULE_BADGE: Record<PricingRule, { text: string; tone: 'neutro' | 'acento' }> = {
  list: { text: RULE_LIST, tone: 'neutro' },
  bulk: { text: RULE_BULK, tone: 'acento' },
  vip: { text: RULE_VIP, tone: 'acento' },
  gift: { text: RULE_GIFT, tone: 'acento' },
  special: { text: RULE_SPECIAL, tone: 'acento' },
}

export default function ReglaInsignia({ rule }: { rule: PricingRule }) {
  const badge = RULE_BADGE[rule]
  return <Insignia tono={badge.tone}>{badge.text}</Insignia>
}
