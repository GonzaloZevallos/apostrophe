/**
 * The fixed help line of Gastos, registered for `copy/copyLimits.test.ts`. `Gastos.tsx`
 * renders this same binding.
 */

import type { LimitedCopy } from '../copy/limits'

export const FLOWER_NOTICE = 'Las compras de flores no van acá: se cargan en Stock.'

export const LIMITED_COPY: readonly LimitedCopy[] = [{ kind: 'help', text: FLOWER_NOTICE }]
export const LONG_REFUSALS: readonly string[] = []
