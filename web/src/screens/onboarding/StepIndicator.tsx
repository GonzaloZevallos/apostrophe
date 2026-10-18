/**
 * The progress shape of the Onboarding (`OnboardingVariedad.dc.html`): six segments,
 * filled for a step done or passed, outlined for the one in view, empty for the rest.
 * It is only the shape: the words ("Paso 2 de 6", "2 de 6 pasos") always sit beside it,
 * so no state is told by fill alone.
 */

import type { OnboardingProgress, StepSlug } from '../../api/onboarding'
import { STATE, STEPS } from './steps'

const TRAMO_CLASS = 'indicador-pasos__tramo'
const TRAMO_ACTUAL_CLASS = 'indicador-pasos__tramo indicador-pasos__tramo--actual'
const TRAMO_HECHO_CLASS = 'indicador-pasos__tramo indicador-pasos__tramo--hecho'

export default function StepIndicator({
  steps,
  current,
}: {
  steps: OnboardingProgress['steps']
  current: StepSlug | null
}) {
  return (
    <div className="indicador-pasos" aria-hidden="true">
      {STEPS.map((info) => {
        const state = steps.find((item) => item.step === info.slug)?.state ?? STATE.pending
        const className =
          info.slug === current
            ? TRAMO_ACTUAL_CLASS
            : state === 'pending'
              ? TRAMO_CLASS
              : TRAMO_HECHO_CLASS
        return <span key={info.slug} className={className} />
      })}
    </div>
  )
}
