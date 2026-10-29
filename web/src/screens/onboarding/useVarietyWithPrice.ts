/**
 * Step 1's two writes behind one action, each through its owner: `POST /api/products` (only
 * while no variety is saved) and then `POST /api/products/{id}/prices`, effective today. The
 * variety stays saved when the price is refused: everything typed stays, the refusal shows
 * on its field, and the retry sends only the price. What was typed is read before anything
 * is written, so a bad amount writes nothing. A name refusal stops before the price.
 *
 * After the variety write the Onboarding progress is read again (the variety is now a
 * `price_target`), and an entry carrying the `anotherVariety` flag is replaced with no state.
 * The leave guard would block that replace while something is typed, so the guard is
 * released for the instant of it.
 */

import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router'
import { ApiError, NetworkError, UNKNOWN_CODE, post } from '../../api/client'
import { invalidateResource } from '../../api/keys'
import { refreshProgress, type OnboardingTarget } from '../../api/onboarding'
import type { PricingSettings } from '../../api/pricingSettings'
import { isGone, kindOf, resolveOverride } from '../../api/refusals'
import { ERROR_GENERICO_MENSAJE } from '../../components/ErrorGenerico'
import { GENERIC_REFUSAL_MESSAGE, type Variety } from '../Variedades'
import {
  fieldOfCode,
  readPriceValues,
  type PriceAmounts,
  type PriceErrors,
  type PriceValues,
} from '../varieties/priceFieldRules'
import { SAVE_OVERRIDES } from '../varieties/varietyForms'
import { hasAnotherVariety } from './anotherVariety'
import { useTranslation } from 'react-i18next'
import { messageText, type Translate } from '../../i18n/refusalKeys'

export interface VarietyWithPriceOptions {
  /** The variety already saved without a price (the progress' `price_target`), if any. */
  seed: OnboardingTarget | null
  today: string
  settings: PricingSettings
  onDirtyChange: (dirty: boolean, partlySaved?: boolean) => void
  /** The price is saved. */
  onPriced: () => void
}

export interface VarietyWithPrice {
  saved: OnboardingTarget | null
  sending: boolean
  nameError: string | null
  priceErrors: PriceErrors
  offline: boolean
  submit: (name: string, values: PriceValues) => Promise<void>
}

/** The line for a refusal no field owns: the generic refusal, or the generic retry. */
function genericLine(caught: unknown): string {
  return caught instanceof ApiError && caught.code !== UNKNOWN_CODE && kindOf(caught.code) === 'refusal'
    ? GENERIC_REFUSAL_MESSAGE
    : ERROR_GENERICO_MENSAJE
}

function nameLine(t: Translate, caught: unknown): string {
  const message = caught instanceof ApiError ? resolveOverride(SAVE_OVERRIDES, caught.code) : undefined
  return message === undefined ? genericLine(caught) : messageText(t, message)
}

export function useVarietyWithPrice({
  seed,
  today,
  settings,
  onDirtyChange,
  onPriced,
}: VarietyWithPriceOptions): VarietyWithPrice {
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [saved, setSaved] = useState<OnboardingTarget | null>(seed)
  const [nameError, setNameError] = useState<string | null>(null)
  const [priceErrors, setPriceErrors] = useState<PriceErrors>({})
  const [offline, setOffline] = useState(false)
  const [sending, setSending] = useState(false)
  // A second tap lands before the disabled button has rendered: a ref answers at once.
  const inFlight = useRef(false)

  async function saveVariety(name: string): Promise<OnboardingTarget | null> {
    let created: OnboardingTarget
    try {
      const answer = await post<Variety>('/api/products', { name })
      created = { id: answer.id, name: answer.name }
    } catch (caught) {
      if (caught instanceof NetworkError) setOffline(true)
      else setNameError(nameLine(t, caught))
      return null
    }
    invalidateResource(queryClient, 'varieties')
    if (hasAnotherVariety(location.state)) {
      flushSync(() => onDirtyChange(false, true))
      await navigate(location.pathname, { replace: true })
    }
    setSaved(created)
    try {
      await refreshProgress(queryClient)
    } catch {
      // The variety is saved; the price write goes on, and the next read answers afresh.
    }
    return created
  }

  async function savePrice(variety: OnboardingTarget, amounts: PriceAmounts): Promise<boolean> {
    try {
      await post(`/api/products/${variety.id}/prices`, { effective_from: today, ...amounts })
      invalidateResource(queryClient, 'varieties')
      return true
    } catch (caught) {
      if (caught instanceof ApiError && isGone(caught.code)) {
        // The variety went away: the name field comes back, and the answer says what is left.
        invalidateResource(queryClient, 'varieties')
        setSaved(null)
        void refreshProgress(queryClient)
      } else if (caught instanceof ApiError) {
        const mapped = fieldOfCode(caught.code)
        if (mapped !== undefined) setPriceErrors({ [mapped.field]: messageText(t, mapped.message) })
        else setPriceErrors({ form: genericLine(caught) })
      } else if (caught instanceof NetworkError) {
        setOffline(true)
      } else {
        setPriceErrors({ form: ERROR_GENERICO_MENSAJE })
      }
      return false
    }
  }

  async function submit(name: string, values: PriceValues): Promise<void> {
    if (inFlight.current) return
    setNameError(null)
    setOffline(false)
    const read = readPriceValues(values, settings)
    setPriceErrors(read.ok ? {} : read.errors)
    if (!read.ok) return
    inFlight.current = true
    setSending(true)
    try {
      const variety = saved ?? (await saveVariety(name))
      if (variety !== null && (await savePrice(variety, read.amounts))) onPriced()
    } finally {
      inFlight.current = false
      setSending(false)
    }
  }

  return { saved, sending, nameError, priceErrors, offline, submit }
}
