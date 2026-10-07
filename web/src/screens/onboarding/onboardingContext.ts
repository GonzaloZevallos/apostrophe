/** What `OnboardingLayout` hands to the step routes below it through the outlet. */

import { useOutletContext } from 'react-router'
import type { Me } from '../../api/me'
import type { OnboardingProgress } from '../../api/onboarding'

export interface OnboardingContext {
  me: Me
  progress: OnboardingProgress
}

export function useOnboarding(): OnboardingContext {
  return useOutletContext<OnboardingContext>()
}
