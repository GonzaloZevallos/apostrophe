/**
 * Step 1, "Add your first variety": one form with one primary action (`VarietyForm`) that
 * saves the variety and then its price effective today, or, on a return to a done step 1,
 * the saved variety marked "Hecho" (`VarietyDone`). Which body opens is decided once, on
 * arrival, from the API's answer and the `anotherVariety` flag, the first that fits:
 *
 *   1. a variety saved with no price (`price_target`): the price form for it;
 *   2. the flag (from "Agregar otra variedad"): the empty form;
 *   3. a variety priced today (`priced_target`): "Hecho";
 *   4. otherwise: the empty form.
 *
 * The front never picks the variety: it shows the one the API names. A refused price keeps
 * the variety and the retry sends only the price. After a price is saved the answer is read
 * again: while it names another unpriced variety the step stays and starts its form, else it
 * goes where the API says (the stock of a variety waiting for it, or the resume step).
 */

import { useCallback, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation } from 'react-router'
import { NetworkError } from '../../api/client'
import {
  getOnboardingProgress,
  keepProgress,
  type OnboardingProgress,
  type OnboardingTarget,
} from '../../api/onboarding'
import { pricingSettingsQueryOptions } from '../../api/pricingSettings'
import ErrorGenerico from '../../components/ErrorGenerico'
import Loading from '../../components/Loading'
import SinConexion from '../../components/SinConexion'
import { ONBOARDING_STOCK } from '../../routes'
import { hasAnotherVariety } from './anotherVariety'
import type { StepBodyProps } from './stepBodies'
import { useOnboardingWrite } from './useOnboardingWrite'
import VarietyDone from './VarietyDone'
import VarietyForm from './VarietyForm'

type Body =
  | { kind: 'form'; seed: OnboardingTarget | null; key: number }
  | { kind: 'done'; target: OnboardingTarget }

function choose(progress: OnboardingProgress, anotherVariety: boolean, key: number): Body {
  if (progress.price_target !== null) return { kind: 'form', seed: progress.price_target, key }
  if (!anotherVariety && progress.priced_target !== null) return { kind: 'done', target: progress.priced_target }
  return { kind: 'form', seed: null, key }
}

export default function VarietyStep({ me, progress, onDirtyChange, onProgress }: StepBodyProps) {
  const queryClient = useQueryClient()
  const location = useLocation()
  const [body, setBody] = useState<Body>(() => choose(progress, hasAnotherVariety(location.state), 0))
  const [unresolved, setUnresolved] = useState(false)
  const settingsQuery = useQuery(pricingSettingsQueryOptions())
  // While the answer names another unpriced variety the step stays, so the answer does not
  // go to the frame (which would disarm the leave guard for good).
  const { run, notice } = useOnboardingWrite((answer, to) => {
    if (!answer.over && answer.price_target !== null) {
      keepProgress(queryClient, answer)
      setBody((current) => choose(answer, false, (current.kind === 'form' ? current.key : 0) + 1))
    } else onProgress(answer, to)
  })

  async function priceSaved(): Promise<void> {
    await run(getOnboardingProgress, (answer) => (answer.stock_target !== null ? ONBOARDING_STOCK : undefined))
  }

  const onStale = useCallback((staleId: number) => {
    void (async () => {
      try {
        const answer = await getOnboardingProgress()
        keepProgress(queryClient, answer)
        const next = choose(answer, false, 0)
        // The same variety named again would be asked about again for ever.
        if (next.kind === 'done' && next.target.id === staleId) setUnresolved(true)
        else setBody(next)
      } catch {
        setUnresolved(true)
      }
    })()
  }, [queryClient])

  if (unresolved) return <ErrorGenerico />
  if (body.kind === 'done') return <VarietyDone target={body.target} onStale={onStale} />
  if (settingsQuery.isError) {
    return settingsQuery.error instanceof NetworkError ? <SinConexion /> : <ErrorGenerico />
  }
  if (settingsQuery.data === undefined) return <Loading />
  return (
    <>
      <VarietyForm
        key={body.key}
        seed={body.seed}
        today={me.today}
        settings={settingsQuery.data}
        onDirtyChange={onDirtyChange}
        onPriced={() => void priceSaved()}
      />
      {notice}
    </>
  )
}
