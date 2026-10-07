/**
 * The step registry's bodies: one slot per step. The shell leaves them empty; the wiring
 * puts each owner's extracted form in its slot. A body reports "something typed and not
 * saved" through `onDirtyChange` (a stable setter, never an inline function) and hands the
 * frame the answer of any Onboarding write it made through `onProgress`.
 */

import type { ComponentType } from 'react'
import type { Me } from '../../api/me'
import type { OnboardingProgress, StepSlug } from '../../api/onboarding'

export interface StepBodyProps {
  me: Me
  progress: OnboardingProgress
  onDirtyChange: (dirty: boolean) => void
  onProgress: (answer: OnboardingProgress) => void
}

const emptySlot = (): null => null

export const STEP_BODIES: Record<StepSlug, ComponentType<StepBodyProps>> = {
  variety: emptySlot,
  stock: emptySlot,
  header_footer: emptySlot,
  bot: emptySlot,
  partner: emptySlot,
  categories: emptySlot,
}
