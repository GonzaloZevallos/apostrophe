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

const RULE_BADGE: Record<PricingRule, { text: string; tone: 'neutro' | 'acento' }> = {
  list: { text: 'lista', tone: 'neutro' },
  bulk: { text: 'por cantidad', tone: 'acento' },
  vip: { text: 'VIP', tone: 'acento' },
  gift: { text: 'regalo', tone: 'acento' },
  special: { text: 'especial', tone: 'acento' },
}

export default function ReglaInsignia({ rule }: { rule: PricingRule }) {
  const badge = RULE_BADGE[rule]
  return <Insignia tono={badge.tone}>{badge.text}</Insignia>
}
