/**
 * Step 1, "Cargá tu primera variedad": the owner's price form for the variety the API names
 * as `price_target` (a variety with no price today), or, when there is none, the owner's
 * name form and then the price form for the variety it just created. The price is effective
 * today. A refused price keeps what was typed, and a retry sends only the price: the variety
 * is already saved. Once the price is saved the answer is read again and the step goes to
 * where the API says (the resume step, or the stock of the variety just added). The price
 * form follows the business's pricing switches (pricing-settings.md), as on a variety's page.
 */

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { NetworkError } from '../../api/client'
import { getOnboardingProgress, refreshProgress, type OnboardingTarget } from '../../api/onboarding'
import { pricingSettingsQueryOptions } from '../../api/pricingSettings'
import ErrorGenerico from '../../components/ErrorGenerico'
import Loading from '../../components/Loading'
import SinConexion from '../../components/SinConexion'
import { ONBOARDING_STOCK } from '../../routes'
import PriceForm from '../varieties/PriceForm'
import VarietyNameForm from '../varieties/VarietyNameForm'
import { useOnboardingWrite } from './useOnboardingWrite'
import type { StepBodyProps } from './stepBodies'

export default function VarietyStep({ me, progress, onDirtyChange, onProgress }: StepBodyProps) {
  const queryClient = useQueryClient()
  const [created, setCreated] = useState<OnboardingTarget | null>(null)
  const { run, notice } = useOnboardingWrite(onProgress)
  const target = created ?? progress.price_target
  const settingsQuery = useQuery(pricingSettingsQueryOptions())

  async function priceSaved(): Promise<void> {
    // A variety added after the first has its stock to load: the API names it.
    await run(getOnboardingProgress, (answer) =>
      answer.stock_target !== null ? ONBOARDING_STOCK : undefined,
    )
  }

  if (target === null) {
    return <VarietyNameForm onSaved={(saved) => setCreated(saved)} onDirtyChange={onDirtyChange} />
  }
  if (settingsQuery.isError) {
    return settingsQuery.error instanceof NetworkError ? <SinConexion /> : <ErrorGenerico />
  }
  if (settingsQuery.data === undefined) return <Loading />
  return (
    <>
      <p className="pie">{`Variedad: ${target.name}`}</p>
      <PriceForm
        bare
        varietyId={target.id}
        today={me.today}
        settings={settingsQuery.data}
        onDone={() => void priceSaved()}
        onCancel={() => undefined}
        onDirtyChange={onDirtyChange}
        onGone={() => {
          setCreated(null)
          void refreshProgress(queryClient)
        }}
      />
      {notice}
    </>
  )
}
