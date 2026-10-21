/**
 * The frame every Onboarding step shares (`OnboardingVariedad.dc.html`): "Atrás" and
 * "Cerrar" on top, "Paso N de 6" with its shape, the title and the one-line why, then the
 * step's own body, and, on an optional step, "Saltar" and "Saltar el resto" with where it
 * can be done later.
 *
 * The frame only sends the writes that are its own: a `skipped` pass ("Saltar") and
 * "Saltar el resto" (shown only when the API says `can_skip_rest`). Every answer, its own
 * or the body's, goes through `afterProgress`: "Listo" only after `over: true`. A render
 * never writes. One leave guard, fed by the body's `onDirtyChange`, asks before "Cerrar",
 * "Atrás" or "Saltar" discards something typed and not saved; an untouched step leaves at
 * once. Closing keeps everything saved and the resume point: it sends nothing.
 */

import { type ComponentType, useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { ApiError, NetworkError } from '../../api/client'
import type { Me } from '../../api/me'
import {
  sendPass,
  sendSkipRest,
  type OnboardingProgress,
  type StepSlug,
} from '../../api/onboarding'
import { isGone } from '../../api/refusals'
import Boton from '../../components/Boton'
import ConfirmDialog from '../../components/ConfirmDialog'
import ErrorGenerico from '../../components/ErrorGenerico'
import LeaveConfirm from '../../components/LeaveConfirm'
import SinConexion from '../../components/SinConexion'
import { useLeaveGuard } from '../../components/useLeaveGuard'
import { afterProgress } from './afterProgress'
import StepIndicator from './StepIndicator'
import type { StepBodyProps } from './stepBodies'
import { DISCARD_DETAIL, PARTLY_SAVED_DETAIL, ONBOARDING_TEXT } from '../../copy/onboarding'
import {
  isFirst,
  isLast,
  isOptional,
  laterHint,
  previousPath,
  STEP_COUNT,
  stepInfo,
  stepNumber,
} from './steps'
import { HOME } from '../../routes'
import { COMMON_TEXT } from '../../copy/common'
import { CHECKLIST_REQUIRED, CHECKLIST_OPTIONAL } from '../../copy/inicio'

export { DISCARD_DETAIL, PARTLY_SAVED_DETAIL }
export const DISCARD_QUESTION = ONBOARDING_TEXT.descartasLoQueEscribiste
export const KEEP_TYPING = COMMON_TEXT.noKeepTyping
export const DISCARD = COMMON_TEXT.yesDiscard

type Skip = 'one' | 'rest'
type Failure = 'offline' | 'error'

export default function OnboardingStep({
  slug,
  me,
  progress,
  Body,
}: {
  slug: StepSlug
  me: Me
  progress: OnboardingProgress
  Body: ComponentType<StepBodyProps>
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const info = stepInfo(slug)
  const [dirty, setDirty] = useState(false)
  const [partlySaved, setPartlySaved] = useState(false)
  const { blocker, disarm } = useLeaveGuard(dirty)
  const [askingSkip, setAskingSkip] = useState<Skip | null>(null)
  const [failure, setFailure] = useState<Failure | null>(null)
  const [sending, setSending] = useState(false)
  const previous = isFirst(slug) ? undefined : previousPath(slug)
  const leaveDetail = partlySaved ? PARTLY_SAVED_DETAIL : DISCARD_DETAIL
  // A stable setter: the bodies list it in their effects' dependencies.
  const onDirtyChange = useCallback((value: boolean, saved = false) => {
    setDirty(value)
    setPartlySaved(saved)
  }, [])

  function onAnswer(answer: OnboardingProgress, to?: string): void {
    disarm()
    void afterProgress(answer, navigate, queryClient, to)
  }

  async function skip(kind: Skip): Promise<void> {
    setAskingSkip(null)
    setFailure(null)
    setSending(true)
    try {
      // A required step never reaches here: the buttons are only drawn for the optional.
      if (kind === 'one' && isOptional(slug)) onAnswer(await sendPass(slug, 'skipped'))
      else if (kind === 'rest') onAnswer(await sendSkipRest())
    } catch (caught) {
      if (caught instanceof NetworkError) setFailure('offline')
      else if (caught instanceof ApiError && isGone(caught.code)) {
        disarm()
        void navigate(HOME)
      } else setFailure('error')
    } finally {
      setSending(false)
    }
  }

  function requestSkip(kind: Skip): void {
    if (dirty) setAskingSkip(kind)
    else void skip(kind)
  }

  return (
    <main className="pantalla onboarding">
      <div className="onboarding__columna">
        <div className={`onboarding__cabecera${previous === undefined ? ' onboarding__cabecera--derecha' : ''}`}>
          {previous !== undefined && (
            <Boton variant="secondary" icon="atras" onClick={() => void navigate(previous)}>
              {ONBOARDING_TEXT.atras}
            </Boton>
          )}
          <Boton variant="icon" action="close" ariaLabel={COMMON_TEXT.close} onClick={() => void navigate(HOME)} />
        </div>

        <div className="onboarding__progreso">
          <div className="onboarding__progreso-fila">
            <span className="onboarding__paso">{ONBOARDING_TEXT.paso0De1(stepNumber(slug), STEP_COUNT)}</span>
            <span className="onboarding__insignia">{info.required ? CHECKLIST_REQUIRED : CHECKLIST_OPTIONAL}</span>
          </div>
          <StepIndicator steps={progress.steps} current={slug} />
        </div>

        <div className="onboarding__titulos">
          <h1 className="onboarding__titulo">{info.title}</h1>
          <p className="onboarding__porque">{info.why}</p>
        </div>

        <div className="onboarding__cuerpo">
          <Body me={me} progress={progress} onDirtyChange={onDirtyChange} onProgress={onAnswer} />
        </div>

        {failure === 'offline' && <SinConexion />}
        {failure === 'error' && <ErrorGenerico />}

        {!info.required && (
          <div className="onboarding__saltar">
            <div className="onboarding__saltar-fila">
              <Boton variant="link" disabled={sending} onClick={() => requestSkip('one')}>
                {ONBOARDING_TEXT.saltar}
              </Boton>
              {progress.can_skip_rest && !isLast(slug) && (
                <Boton variant="link" disabled={sending} onClick={() => requestSkip('rest')}>
                  {ONBOARDING_TEXT.saltarElResto}
                </Boton>
              )}
            </div>
            <span className="pie onboarding__pista">{laterHint(info)}</span>
          </div>
        )}
      </div>

      {blocker.state === 'blocked' && (
        <LeaveConfirm
          blocker={blocker}
          question={DISCARD_QUESTION}
          detail={leaveDetail}
          keepLabel={KEEP_TYPING}
          discardLabel={DISCARD}
        />
      )}
      {askingSkip !== null && (
        <ConfirmDialog
          title={DISCARD_QUESTION}
          detail={leaveDetail}
          confirmText={DISCARD}
          cancelText={KEEP_TYPING}
          onConfirm={() => void skip(askingSkip)}
          onCancel={() => setAskingSkip(null)}
        />
      )}
    </main>
  )
}
