/**
 * `Insignia` (`componentes.ts`'s `InsigniaProps`, plan "Components"): the one pill
 * shape for a short, lowercase label — VIP, a pricing rule, a stock status word.
 * `neutro` is the superficie-toned default; every other tone is the single accent
 * (never a state color of its own — README, accessibility rule 1: blue ↔ amber,
 * never green ↔ red). The word is always the content, never implied by the tone
 * alone (rule 2).
 */

import type { ReactNode } from 'react'

export type InsigniaTono = 'neutro' | 'acento' | 'deuda' | 'critico'

export interface InsigniaProps {
  children: ReactNode
  tono?: InsigniaTono
  /** For a word the seller wrote: it shrinks with its row and ends in an ellipsis, while the
   * full word stays the element's text. */
  truncable?: boolean
}

const CLASS: Record<InsigniaTono, string> = {
  neutro: 'insignia',
  acento: 'insignia insignia--acento',
  deuda: 'insignia insignia--deuda',
  critico: 'insignia insignia--critico',
}

export default function Insignia({ children, tono = 'neutro', truncable = false }: InsigniaProps) {
  return <span className={truncable ? `${CLASS[tono]} insignia--truncable` : CLASS[tono]}>{children}</span>
}
