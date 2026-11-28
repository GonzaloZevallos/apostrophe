/**
 * The Sale in progress as a hook: the reducer in `saleDraft.ts` plus bound dispatchers. The
 * initializer runs once per opening, so a later change of `today` changes neither the first date
 * nor `openedOn`; `setDate` reads `today` at call time, so the guard follows the Business's day.
 */

import { useCallback, useMemo, useReducer } from 'react'
import type { PaymentMethod } from '../api/payments'
import { initialDraft, saleDraftReducer, type DraftChoice, type DraftState, type LineEdit } from './saleDraft'

export interface SaleDraftApi {
  state: DraftState
  /** The Business's today the hook was built with: the one value `setDate` guards with and a date control's `max`. */
  today: string
  addProduct: (productId: number) => void
  stepUp: (productId: number) => void
  stepDown: (productId: number) => void
  typeQuantity: (productId: number, text: string) => void
  editLine: (productId: number, edit: LineEdit) => void
  removeLine: (productId: number) => void
  chooseCustomer: (customerId: number) => void
  removeCustomer: () => void
  setChoice: (choice: DraftChoice) => void
  proposeMethod: (methodId: PaymentMethod | null) => void
  setDate: (date: string) => void
  setShipping: (text: string) => void
  setNote: (text: string) => void
}

export function useSaleDraft(args: { today: string; customerId?: number | null }): SaleDraftApi {
  const [state, dispatch] = useReducer(saleDraftReducer, args, initialDraft)
  const actions = useMemo(
    () => ({
      addProduct: (productId: number) => dispatch({ type: 'productAdded', productId }),
      stepUp: (productId: number) => dispatch({ type: 'stepUp', productId }),
      stepDown: (productId: number) => dispatch({ type: 'stepDown', productId }),
      typeQuantity: (productId: number, text: string) =>
        dispatch({ type: 'quantityTyped', productId, text }),
      editLine: (productId: number, edit: LineEdit) =>
        dispatch({
          type: 'lineEdited',
          productId,
          quantityHundredths: edit.quantityHundredths,
          gift: edit.gift,
          specialPrice: edit.specialPrice,
        }),
      removeLine: (productId: number) => dispatch({ type: 'lineRemoved', productId }),
      chooseCustomer: (customerId: number) => dispatch({ type: 'customerChosen', customerId }),
      removeCustomer: () => dispatch({ type: 'customerRemoved' }),
      setChoice: (choice: DraftChoice) => dispatch({ type: 'choiceSet', choice }),
      proposeMethod: (methodId: PaymentMethod | null) => dispatch({ type: 'proposalArrived', methodId }),
      setShipping: (text: string) => dispatch({ type: 'shippingSet', text }),
      setNote: (text: string) => dispatch({ type: 'noteSet', text }),
    }),
    [],
  )
  const { today } = args
  const setDate = useCallback(
    (date: string) => dispatch({ type: 'dateSet', date, today }),
    [today],
  )
  return { state, today, ...actions, setDate }
}
