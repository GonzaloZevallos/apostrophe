/** The two route elements under `OnboardingLayout`: the entry and one step. */

import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Navigate, useNavigate } from 'react-router'
import { ApiError, NetworkError } from '../../api/client'
import { keepProgress, sendAdvance, type StepSlug } from '../../api/onboarding'
import { isGone } from '../../api/refusals'
import ContentArea from '../../components/ContentArea'
import ErrorGenerico from '../../components/ErrorGenerico'
import Loading from '../../components/Loading'
import SinConexion from '../../components/SinConexion'
import { openListo } from './afterProgress'
import { useOnboarding } from './onboardingContext'
import OnboardingStep from './OnboardingStep'
import { STEP_BODIES } from './stepBodies'
import { stepInfo } from './steps'
import { HOME } from '../../routes'

/** `/onboarding`: resolves to the resume step. With nothing to resume (`null`: not offered,
 * or over) it goes to Inicio. With every step done or passed and the Onboarding not over
 * (`finish`) it sends `advance` once per mount and follows the answer itself, whoever opened
 * it: "Listo" when the answer says `over: true`, the step or Inicio otherwise. Retrying is
 * opening `/onboarding` again, which mounts a fresh entry. */
export function OnboardingEntry() {
  const { progress } = useOnboarding()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const sent = useRef(false)
  const [failure, setFailure] = useState<'offline' | 'error' | null>(null)
  // The answer this mount opened with: the answer `advance` keeps (resume `null`) must not
  // send this entry to Inicio while it is still handing over to "Listo".
  const [resume] = useState(progress.resume)
  const finishing = resume === 'finish'

  useEffect(() => {
    if (!finishing || sent.current) return
    sent.current = true
    async function advance(): Promise<void> {
      try {
        const answer = await sendAdvance()
        if (answer.over) {
          await openListo(answer, navigate, queryClient, { replace: true })
          return
        }
        const to = answer.resume === null || answer.resume === 'finish' ? HOME : stepInfo(answer.resume).path
        await navigate(to, { replace: true })
        keepProgress(queryClient, answer)
      } catch (caught) {
        if (caught instanceof NetworkError) setFailure('offline')
        else if (caught instanceof ApiError && isGone(caught.code)) void navigate(HOME)
        else setFailure('error')
      }
    }
    void advance()
  }, [finishing, navigate, queryClient])

  if (resume === null) return <Navigate to={HOME} replace />
  if (resume !== 'finish') return <Navigate to={stepInfo(resume).path} replace />
  return (
    <ContentArea as="main" className="pantalla onboarding">
      {failure === null ? (
        <Loading />
      ) : (
        <div className="onboarding__columna">{failure === 'offline' ? <SinConexion /> : <ErrorGenerico />}</div>
      )}
    </ContentArea>
  )
}

export function OnboardingStepRoute({ slug }: { slug: StepSlug }) {
  const { me, progress } = useOnboarding()
  return <OnboardingStep key={slug} slug={slug} me={me} progress={progress} Body={STEP_BODIES[slug]} />
}
