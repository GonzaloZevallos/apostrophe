/**
 * The named exemptions of the back guards (`backCards.test.tsx`, `backGuards.ts`), in the
 * manner of `pressedExempt.ts`: a visible list with a reason for each entry, never a silent skip.
 */

import type { ScreenId } from '../routes'

/** Cards `backCards.test.tsx` does not render yet. Every entry here is temporary: a2 removes the
 * screen's own back and empties the list; the guard then fails if one stays. */
export const CARDS_EXEMPT: { id: ScreenId; reason: string }[] = []

/** Files allowed to carry a literal '‹' for something that is not a back. */
export const CHEVRON_EXEMPT: { path: string; reason: string }[] = [
  {
    path: '/src/copy/common.ts',
    reason: "the words of the shell's `‹ parent` arrow live in the copy module (ADR-0049); only BackArrow draws it",
  },
  {
    path: '/src/screens/Analisis.tsx',
    reason: "the month stepper's 'Mes anterior' draws a '‹' glyph; it is a stepper, not a back (Gastos draws its own with an icon)",
  },
]

/** Files allowed to draw `variant="back"` outside the shell. */
export const BACK_VARIANT_EXEMPT: { path: string; reason: string }[] = []
