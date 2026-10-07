/**
 * The step registry's bodies: one slot per step, each holding its owner's extracted form. A body reports "something typed and not
 * saved" through `onDirtyChange` (a stable setter, never an inline function) and hands the
 * frame the answer of any Onboarding write it made through `onProgress`.
 */

import type { ComponentType } from 'react'
import type { Me } from '../../api/me'
import type { OnboardingProgress, StepSlug } from '../../api/onboarding'
import BotStep from './BotStep'
import CatalogMessageStep from './CatalogMessageStep'
import CategoriesStep from './CategoriesStep'
import PartnerStep from './PartnerStep'
import StockStep from './StockStep'
import VarietyStep from './VarietyStep'

export interface StepBodyProps {
  me: Me
  progress: OnboardingProgress
  onDirtyChange: (dirty: boolean) => void
  /** `to` names where a not-over answer leads, instead of the resume step. */
  onProgress: (answer: OnboardingProgress, to?: string) => void
}

export const STEP_BODIES: Record<StepSlug, ComponentType<StepBodyProps>> = {
  variety: VarietyStep,
  stock: StockStep,
  header_footer: CatalogMessageStep,
  bot: BotStep,
  partner: PartnerStep,
  categories: CategoriesStep,
}
