/**
 * Inicio's "Seguí con la configuración" (`Inicio.dc.html`, results.md): the count in words
 * ("2 de 6 pasos"), its shape, and "Falta: <step>" naming the resume step. It cannot be
 * dismissed. A tap opens the resume step; with every step done or passed (`finish`) there
 * is no "Falta" line and a tap sends `advance`, then follows its answer ("Listo" only after
 * `over: true`). Rendering it never writes.
 */

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import InAppLink from '../../components/InAppLink'
import { ApiError, NetworkError } from '../../api/client'
import { sendAdvance, type OnboardingProgress } from '../../api/onboarding'
import { isGone } from '../../api/refusals'
import ErrorGenerico from '../../components/ErrorGenerico'
import Icono from '../../components/Icono'
import SinConexion from '../../components/SinConexion'
import { afterProgress } from './afterProgress'
import StepIndicator from './StepIndicator'
import { STEP_COUNT, stepInfo } from './steps'
import { HOME } from '../../routes'

export const NOTICE_TITLE = 'Seguí con la configuración'

export default function OnboardingNotice({ progress }: { progress: OnboardingProgress }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [failure, setFailure] = useState<'offline' | 'error' | null>(null)
  const resume = progress.resume
  const current = resume === 'finish' || resume === null ? null : resume

  const body = (
    <>
      <span className="aviso-onboarding__titulo">
        <span className="aviso-onboarding__texto">{NOTICE_TITLE}</span>
        <Icono nombre="chevron" />
      </span>
      <span className="aviso-onboarding__conteo">{`${progress.count} de ${STEP_COUNT} pasos`}</span>
      <StepIndicator steps={progress.steps} current={current} />
      {current !== null && (
        <span className="aviso-onboarding__falta">{`Falta: ${stepInfo(current).shortName}`}</span>
      )}
    </>
  )

  async function finish(): Promise<void> {
    setFailure(null)
    try {
      const answer = await sendAdvance()
      await afterProgress(answer, navigate, queryClient)
    } catch (caught) {
      if (caught instanceof NetworkError) setFailure('offline')
      else if (caught instanceof ApiError && isGone(caught.code)) void navigate(HOME)
      else setFailure('error')
    }
  }

  return (
    <>
      {current !== null ? (
        <InAppLink to={stepInfo(current).path} className="aviso-onboarding">
          {body}
        </InAppLink>
      ) : (
        <button type="button" className="aviso-onboarding" onClick={() => void finish()}>
          {body}
        </button>
      )}
      {failure === 'offline' && <SinConexion />}
      {failure === 'error' && <ErrorGenerico />}
    </>
  )
}
