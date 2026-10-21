/**
 * Step 2, "Cargá lo que tenés hoy": the owner's stock form, locked to the variety the API
 * names as `stock_target` and to the origin Stock inicial, dated today. With no cost the lot
 * costs $0, and the form says so next to the cost field. Once saved (or when the step is already done and no variety
 * is waiting for stock) the step offers "Seguir" (which sends `advance`) and "Agregar otra
 * variedad" (back to step 1); the progress stays on steps 1 and 2 while varieties are added.
 */

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router'
import { getOnboardingProgress, keepProgress, sendAdvance } from '../../api/onboarding'
import Boton from '../../components/Boton'
import { inAppState } from '../../components/inAppState'
import { ONBOARDING_VARIETY } from '../../routes'
import StockEntryForm from '../StockEntryForm'
import { anotherVarietyState } from './anotherVariety'
import StepSubmit from './StepSubmit'
import { useOnboardingWrite } from './useOnboardingWrite'
import type { StepBodyProps } from './stepBodies'
import { ONBOARDING_TEXT } from '../../copy/onboarding'
import { COMMON_TEXT } from '../../copy/common'

export default function StockStep({ me, progress, onDirtyChange, onProgress }: StepBodyProps) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const [saved, setSaved] = useState(false)
  const [savedName, setSavedName] = useState<string | null>(null)
  const { run, sending, notice } = useOnboardingWrite(onProgress)
  const target = progress.stock_target
  const state = progress.steps.find((item) => item.step === 'stock')?.state

  async function stockSaved(): Promise<void> {
    onDirtyChange(false)
    setSaved(true)
    setSavedName(target?.name ?? null)
    // The counts and targets moved: keep the fresh answer for what the step shows next.
    try {
      keepProgress(queryClient, await getOnboardingProgress())
    } catch {
      // The saved stock stays saved; "Seguir" sends `advance` and answers afresh.
    }
  }

  if (saved || (target === null && state === 'done')) {
    return (
      <>
        <p className="onboarding__porque">
          {ONBOARDING_TEXT.tenesOtraParaCargar}
        </p>
        {savedName !== null && (
          <div className="onboarding__tarjeta">
            <span className="onboarding__tarjeta-nombre">{savedName}</span>
            <span className="onboarding__tarjeta-detalle">{ONBOARDING_TEXT.conPrecioDeHoy}</span>
          </div>
        )}
        <div className="onboarding__acciones">
          <StepSubmit disabled={sending} onSubmit={() => void run(sendAdvance)}>
            {ONBOARDING_TEXT.seguir}
          </StepSubmit>
          <Boton
            variant="secondary"
            icon="agregar"
            disabled={sending}
            onClick={() => void navigate(ONBOARDING_VARIETY, { state: inAppState(location, anotherVarietyState()) })}
          >
            {COMMON_TEXT.addAnotherVariety}
          </Boton>
        </div>
        {notice}
      </>
    )
  }
  if (target === null) {
    return (
      <>
        <p className="onboarding__porque">{ONBOARDING_TEXT.primeroCargaUnaVariedad}</p>
        <Boton icon="agregar" onClick={() => void navigate(ONBOARDING_VARIETY)}>
          {ONBOARDING_TEXT.cargarUnaVariedad}
        </Boton>
      </>
    )
  }
  return (
    <>
      <StockEntryForm
        mode="nuevo"
        today={me.today}
        fixedVarietyId={target.id}
        fixedOrigin="opening_stock"
        onSaved={() => void stockSaved()}
        onDirtyChange={onDirtyChange}
      />
    </>
  )
}
