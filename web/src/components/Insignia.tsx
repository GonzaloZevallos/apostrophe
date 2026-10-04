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
}

const CLASS: Record<InsigniaTono, string> = {
  neutro: 'insignia',
  acento: 'insignia insignia--acento',
  deuda: 'insignia insignia--deuda',
  critico: 'insignia insignia--critico',
}

export default function Insignia({ children, tono = 'neutro' }: InsigniaProps) {
  return <span className={CLASS[tono]}>{children}</span>
}
