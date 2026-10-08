/**
 * What every step body does to send an Onboarding write after its owner's save: sends it,
 * hands the answer to the frame (`onProgress`), and shows the one failure line when it does
 * not land ("Sin conexión", or the generic retry). The owner's save is already done by then,
 * so a failed write loses nothing: the step keeps what it shows and the same tap sends it
 * again. An Onboarding that is gone (`Eso ya no está.`) goes to Inicio.
 */

import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { ApiError, NetworkError } from '../../api/client'
import type { OnboardingProgress } from '../../api/onboarding'
import { isGone } from '../../api/refusals'
import ErrorGenerico from '../../components/ErrorGenerico'
import SinConexion from '../../components/SinConexion'
import type { StepBodyProps } from './stepBodies'
import { HOME } from '../../routes'

type Failure = 'offline' | 'error'

export interface OnboardingWrite {
  /** `to` may pick where a not-over answer leads, instead of the resume step. */
  run: (
    send: () => Promise<OnboardingProgress>,
    to?: (answer: OnboardingProgress) => string | undefined,
  ) => Promise<void>
  sending: boolean
  /** The failure line, or nothing. */
  notice: ReactNode
}

export function useOnboardingWrite(onProgress: StepBodyProps['onProgress']): OnboardingWrite {
  const navigate = useNavigate()
  const [sending, setSending] = useState(false)
  const [failure, setFailure] = useState<Failure | null>(null)

  async function run(
    send: () => Promise<OnboardingProgress>,
    to?: (answer: OnboardingProgress) => string | undefined,
  ): Promise<void> {
    setFailure(null)
    setSending(true)
    try {
      const answer = await send()
      onProgress(answer, to?.(answer))
    } catch (caught) {
      if (caught instanceof NetworkError) setFailure('offline')
      else if (caught instanceof ApiError && isGone(caught.code)) void navigate(HOME)
      else setFailure('error')
    } finally {
      setSending(false)
    }
  }

  const notice =
    failure === 'offline' ? <SinConexion /> : failure === 'error' ? <ErrorGenerico /> : null
  return { run, sending, notice }
}
