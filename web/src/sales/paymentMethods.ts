/**
 * The Payment methods a Selector offers: the business's own offered list (`GET /api/payment-methods`,
 * ADR-20261111-payment-methods-by-id), in the order the server keeps it, read by New sale and Record payment alike. They are
 * never a fixed set (`fixedSets.ts` never declares them). The Selector's values are the ids as text;
 * `paymentMethodOf` turns one back into the id the API takes.
 *
 * A failed read never loses what the seller typed: offline the screen shows Estados' "Sin conexión"
 * notice, on a server error the field itself says it could not load, and tapping the field again
 * reads the list again.
 */

import { type QueryClient, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { PaymentMethod } from '../api/payments'
import { paymentMethodsQueryOptions } from '../api/paymentMethods'
import { keys } from '../api/keys'
import { NetworkError } from '../api/client'
import type { SelectorOption } from '../components/Selector'
import type { PaymentChoice } from './pricing'
import type { DraftChoice } from './saleDraft'

export interface PaymentMethodOption extends SelectorOption {
  value: string
}

export interface PaymentMethodOptions {
  /** What a `Selector` takes as props. */
  selector: {
    options: readonly PaymentMethodOption[]
    loading: boolean
    emptySetMessage: string
  }
  /** The ids of the list read, or `null` while there is no list. */
  offeredIds: readonly number[] | null
  /** The reading failed: `offline` shows the notice, `server` marks the field. */
  failure: 'offline' | 'server' | null
  /** Reads the list again (a tap on a field that failed). */
  reload: () => void
}

export function usePaymentMethodOptions(): PaymentMethodOptions {
  const { t } = useTranslation()
  const query = useQuery(paymentMethodsQueryOptions())
  // A tap on a failed field reads the list again, and the query goes back to pending while it does:
  // the failure is kept until the list arrives or fails again, so the open field never flips to
  // `loading` (which closes it) and the person keeps reading why it is empty.
  const [lastFailure, setLastFailure] = useState<'offline' | 'server' | null>(null)
  const errorKind = query.error instanceof NetworkError ? 'offline' : 'server'
  const observed = query.data !== undefined ? null : query.isError ? errorKind : undefined
  if (observed !== undefined && observed !== lastFailure) setLastFailure(observed)
  const failure = observed === undefined ? lastFailure : observed
  const failed = failure !== null
  return {
    selector: {
      options: (query.data ?? []).map((method) => ({ value: String(method.id), label: method.name })),
      loading: query.isPending && !failed,
      emptySetMessage: t(failed ? 'emptyStates:selectorPaymentMethodsFailed' : 'emptyStates:selectorNoPaymentMethods'),
    },
    offeredIds: query.data === undefined ? null : query.data.map((method) => method.id),
    failure,
    reload: () => {
      void query.refetch()
    },
  }
}

/** The id a Selector value stands for, or null for anything else (never a guess). */
export function paymentMethodOf(value: string | null): PaymentMethod | null {
  if (value === null || !/^\d+$/.test(value)) return null
  return Number(value)
}

/** The Selector value of a chosen method id. */
export function paymentMethodValue(method: PaymentMethod | null): string | null {
  return method === null ? null : String(method)
}

/** The Selector value of "Owes it": not a Payment method id, so `paymentMethodOf` never takes it for one. */
export const OWING_VALUE = 'owing'

/** The payment the Collect Sheet decides on: the choice as given (owing included), `null` for no choice. */
export function collectableChoice(choice: PaymentChoice | null): PaymentChoice | null {
  return choice
}

/** The draft choice a Selector value stands for: a method id is a paid choice, `OWING_VALUE` is owing,
 * anything else unset. */
export function choiceOfValue(value: string | null): DraftChoice {
  if (value === OWING_VALUE) return { kind: 'owing' }
  const method = paymentMethodOf(value)
  return method === null ? { kind: 'unset' } : { kind: 'paid', payment_method_id: method }
}

/** The Selector value of a draft choice: the id for paid, `OWING_VALUE` for owing, the proposal for
 * unset only when it is one of the offered ids. */
export function selectorValueOf(
  choice: DraftChoice,
  proposedMethodId: PaymentMethod | null,
  offeredIds: readonly number[] | null,
): string | null {
  if (choice.kind === 'paid') return paymentMethodValue(choice.payment_method_id)
  if (choice.kind === 'owing') return OWING_VALUE
  if (proposedMethodId === null || offeredIds === null || !offeredIds.includes(proposedMethodId)) return null
  return paymentMethodValue(proposedMethodId)
}

export interface HowTheyPayView {
  options: readonly PaymentMethodOption[]
  value: string | null
  /** The current choice when it is not in `options`: the Selector shows it with its "no longer available" mark. */
  selected: { value: string; label: string } | undefined
}

/**
 * What the Collect Sheet's "How they pay" Selector shows, in one place: the options (the methods
 * without the ones this Sheet was refused for, then "Owes it" last and only with a Customer), the
 * field's value and the entry the Selector marks as no longer available. Owing with no Customer
 * keeps "Owes it" as the value but never as a row, so the Selector marks it.
 */
export function howTheyPayView({
  choice,
  customerId,
  proposedMethodId,
  offeredIds,
  methodOptions,
  refusedIds,
  methodGone,
  owesItLabel,
}: {
  choice: DraftChoice
  customerId: number | null
  proposedMethodId: PaymentMethod | null
  offeredIds: readonly number[] | null
  methodOptions: readonly PaymentMethodOption[]
  refusedIds: readonly number[]
  methodGone: { id: number; name: string } | null
  owesItLabel: string
}): HowTheyPayView {
  const options: PaymentMethodOption[] = methodOptions.filter((option) => !refusedIds.includes(Number(option.value)))
  if (customerId !== null) options.push({ value: OWING_VALUE, label: owesItLabel })
  const shown = selectorValueOf(choice, proposedMethodId, offeredIds)
  const shownRefused = shown !== null && refusedIds.includes(Number(shown))
  if (methodGone !== null) {
    return { options, value: String(methodGone.id), selected: { value: String(methodGone.id), label: methodGone.name } }
  }
  if (choice.kind === 'owing' && customerId === null) {
    return { options, value: OWING_VALUE, selected: { value: OWING_VALUE, label: owesItLabel } }
  }
  return { options, value: shownRefused ? null : shown, selected: undefined }
}

export interface HowYouPaidView {
  options: readonly PaymentMethodOption[]
  value: string | null
  /** The entry the Selector marks as no longer available, or `undefined` when there is none to mark. */
  selected: { value: string; label: string } | undefined
  loading: boolean
}

/**
 * What the Add expense "How you paid" Selector shows, in one place: the one decision on whether the
 * expense's stored Payment method is offered as an extra option or marked no longer available. No other code
 * compares the offered ids to the stored id. The rules apply in this order:
 *
 * 1. Options are built first. Once the list is read (`offeredIds` is not `null`) they are the real
 *    `methodOptions`. While it is pending or failed they are the stored method followed by
 *    `methodOptions`, with the stored method only when there is one. Adding it depends on `storedMethod`
 *    and the list state alone, never on `value`.
 * 2. `methodGone` (a method the server refused) is filtered out of the options, always, whatever the list
 *    state and whatever the stored method is. Then `value` is its id and `selected` is the method.
 * 3. `loading`: with no stored method, the hook's `loading` passes through. With one, `loading` is `false`
 *    while the list is pending or failed and at least one option remains after the filter; with no option
 *    left, the hook's `loading` passes through (a pending list stays loading, a failed one shows its own
 *    "could not load" message).
 * 4. Once the list is read, the stored id is not offered and `value` is still the stored id: `selected` is
 *    the stored method (the "no longer available" mark).
 * 5. Anything else (offered, a cleared `value`, another id) has no `selected`.
 *
 * `value` is never derived: it comes back as given, except under `methodGone`. `failure` is part of the
 * input the form reads from the hook; a failed list and a pending one both have no `offeredIds`, so the
 * options and the mark come out the same and only the hook's own `loading` tells them apart.
 */
export function howYouPaidView({
  storedMethod,
  value,
  offeredIds,
  methodOptions,
  loading,
  methodGone,
}: {
  storedMethod: { id: number; name: string } | null
  value: string | null
  offeredIds: readonly number[] | null
  methodOptions: readonly PaymentMethodOption[]
  loading: boolean
  failure: 'offline' | 'server' | null
  methodGone: { id: number; name: string } | null
}): HowYouPaidView {
  const listRead = offeredIds !== null
  const withStored: readonly PaymentMethodOption[] =
    !listRead && storedMethod !== null
      ? [{ value: String(storedMethod.id), label: storedMethod.name }, ...methodOptions]
      : methodOptions
  const options = methodGone === null ? withStored : withStored.filter((option) => option.value !== String(methodGone.id))
  const storedShown = storedMethod !== null && !listRead && options.length > 0
  const shownLoading = storedShown ? false : loading
  if (methodGone !== null) {
    return {
      options,
      value: String(methodGone.id),
      selected: { value: String(methodGone.id), label: methodGone.name },
      loading: shownLoading,
    }
  }
  const notOffered = storedMethod !== null && offeredIds !== null && !offeredIds.includes(storedMethod.id)
  const selected =
    storedMethod !== null && notOffered && value === String(storedMethod.id)
      ? { value: String(storedMethod.id), label: storedMethod.name }
      : undefined
  return { options, value, selected, loading: shownLoading }
}

/** The name the list showed for a method id, read before the list is read again (never a guess). */
export function paymentMethodName(queryClient: QueryClient, method: PaymentMethod): string | null {
  const list = queryClient.getQueryData<readonly { id: number; name: string }[]>(keys.paymentMethods())
  return list?.find((item) => item.id === method)?.name ?? null
}
