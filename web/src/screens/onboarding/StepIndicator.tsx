/**
 * The progress shape of the Onboarding (`OnboardingVariedad.dc.html`): six segments,
 * filled for a step done or passed, outlined for the one in view, empty for the rest.
 * It is only the shape: the words ("Paso 2 de 6", "2 de 6 pasos") always sit beside it,
 * so no state is told by fill alone.
 */

import type { OnboardingProgress, StepSlug } from '../../api/onboarding'
import { STEPS } from './steps'

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
        const state = steps.find((item) => item.step === info.slug)?.state ?? 'pending'
        const className =
          info.slug === current
            ? 'indicador-pasos__tramo indicador-pasos__tramo--actual'
            : state === 'pending'
              ? 'indicador-pasos__tramo'
              : 'indicador-pasos__tramo indicador-pasos__tramo--hecho'
        return <span key={info.slug} className={className} />
      })}
    </div>
  )
}
