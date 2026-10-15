/**
 * The named exemptions of the back guards (`backCards.test.tsx`, `backGuards.ts`), in the
 * manner of `pressedExempt.ts`: a visible list with a reason for each entry, never a silent skip.
 */

import type { ScreenId } from '../routes'

/** Cards `backCards.test.tsx` does not render yet. Every entry here is temporary: a2 removes the
 * screen's own back and empties the list; the guard then fails if one stays. */
export const CARDS_EXEMPT: { id: ScreenId; reason: string }[] = [
  { id: 'variety', reason: 'removed by a2' },
  { id: 'variety-prices', reason: 'removed by a2' },
  { id: 'variety-entries', reason: 'removed by a2' },
  { id: 'stock', reason: 'removed by a2' },
  { id: 'catalog', reason: 'removed by a2' },
  { id: 'varieties-archived', reason: 'removed by a2' },
  { id: 'withdrawal', reason: 'removed by a2' },
]

/** Files allowed to carry a literal '‹' for something that is not a back. */
export const CHEVRON_EXEMPT: { path: string; reason: string }[] = [
  {
    path: '/src/screens/Analisis.tsx',
    reason: "the month stepper's 'Mes anterior' draws a '‹' glyph; it is a stepper, not a back (Gastos draws its own with an icon)",
  },
]

/** Files allowed to draw `variant="back"` outside the shell. Temporary, as the cards list. */
export const BACK_VARIANT_EXEMPT: { path: string; reason: string }[] = [
  { path: '/src/screens/varieties/VarietyPage.tsx', reason: 'removed by a2' },
  { path: '/src/screens/Catalogo.tsx', reason: 'removed by a2' },
  { path: '/src/screens/varieties/ArchivedVarieties.tsx', reason: 'removed by a2' },
  { path: '/src/screens/varieties/PriceHistory.tsx', reason: 'removed by a2' },
  { path: '/src/screens/EntriesList.tsx', reason: 'removed by a2' },
  { path: '/src/screens/withdrawals/WithdrawalDetail.tsx', reason: 'removed by a2' },
  { path: '/src/screens/Analisis.tsx', reason: 'removed by a2' },
]

/** A chevron outside the shell that a2 removes along with the back above; same files. */
export const CHEVRON_TEMPORARY: string[] = BACK_VARIANT_EXEMPT.map((entry) => entry.path)
