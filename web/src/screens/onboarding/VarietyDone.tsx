/**
 * Step 1 once it is done and no variety waits for its price: the saved variety the API names
 * (`priced_target`), its name, today's list price as Variedades shows it and "Hecho". Its one
 * primary action moves on to step 2 and writes nothing; there is no name field here and no
 * way to a second variety (that is "Agregar otra variedad", after step 2). The price is the
 * owner's own read (`GET /varieties/{id}`): when it answers no price today, or the variety is
 * gone, the host reads the progress again and draws what that names.
 */

import { type FormEvent, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { ApiError, NetworkError, get } from '../../api/client'
import { keys } from '../../api/keys'
import type { OnboardingTarget } from '../../api/onboarding'
import { isGone } from '../../api/refusals'
import Boton from '../../components/Boton'
import ErrorGenerico from '../../components/ErrorGenerico'
import Loading from '../../components/Loading'
import SinConexion from '../../components/SinConexion'
import { formatMoney } from '../../format/money'
import { ONBOARDING_STOCK } from '../../routes'
import type { Variety } from '../Variedades'
import { COMMON_TEXT } from '../../copy/common'
import { CHECKLIST_DONE } from '../../copy/inicio'
import { ONBOARDING_TEXT } from '../../copy/onboarding'

export interface VarietyDoneProps {
  target: OnboardingTarget
  /** The variety has no price today any more, or is gone: the progress is stale. */
  onStale: (varietyId: number) => void
}

export default function VarietyDone({ target, onStale }: VarietyDoneProps) {
  const navigate = useNavigate()
  const query = useQuery({
    queryKey: [...keys.variety(String(target.id)), 'step-one'],
    queryFn: () => get<Variety>(`/varieties/${target.id}`),
    gcTime: 0,
  })
  const gone = query.error instanceof ApiError && isGone(query.error.code)
  const unpriced = query.data !== undefined && query.data.current_price === null
  const stale = gone || unpriced
  useEffect(() => {
    if (stale) onStale(target.id)
  }, [stale, onStale, target.id])

  if (query.isError && !gone) return query.error instanceof NetworkError ? <SinConexion /> : <ErrorGenerico />
  if (query.data === undefined || stale) return <Loading />
  const price = query.data.current_price

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    void navigate(ONBOARDING_STOCK)
  }

  return (
    <form className="formulario" onSubmit={onSubmit}>
      <div className="onboarding__tarjeta">
        <span className="onboarding__tarjeta-nombre">{target.name}</span>
        <span className="onboarding__tarjeta-detalle">
          {price === null ? '' : COMMON_TEXT.pricePerGram(formatMoney(price.list_price))}
        </span>
        <span className="onboarding__tarjeta-detalle">{CHECKLIST_DONE}</span>
      </div>
      <Boton textOnly="submit" type="submit">
        {ONBOARDING_TEXT.seguir}
      </Boton>
    </form>
  )
}
