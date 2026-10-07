/** The two route elements under `OnboardingLayout`: the entry and one step. */

import { Navigate } from 'react-router'
import type { StepSlug } from '../../api/onboarding'
import { useOnboarding } from './onboardingContext'
import OnboardingStep from './OnboardingStep'
import { STEP_BODIES } from './stepBodies'
import { stepInfo } from './steps'

/** `/onboarding`: resolves to the resume step. With nothing left to resume (every step
 * done or passed, not yet ended) it goes to Inicio, whose notice ends it on a tap: a
 * mount never sends `advance`. */
export function OnboardingEntry() {
  const { progress } = useOnboarding()
  if (progress.resume === null || progress.resume === 'finish') return <Navigate to="/" replace />
  return <Navigate to={stepInfo(progress.resume).path} replace />
}

export function OnboardingStepRoute({ slug }: { slug: StepSlug }) {
  const { me, progress } = useOnboarding()
  return <OnboardingStep key={slug} slug={slug} me={me} progress={progress} Body={STEP_BODIES[slug]} />
}
