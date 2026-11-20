/**
 * The Sale in progress as a hook: the reducer in `saleDraft.ts` plus bound dispatchers. The
 * initializer runs once per opening, so a later change of `today` changes nothing.
 */

import { useMemo, useReducer } from 'react'
import type { PaymentMethod } from '../api/payments'
import { initialDraft, saleDraftReducer, type DraftChoice, type DraftState } from './saleDraft'

export interface SaleDraftApi {
  state: DraftState
  addProduct: (productId: number) => void
  stepUp: (productId: number) => void
  stepDown: (productId: number) => void
  typeQuantity: (productId: number, text: string) => void
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
      chooseCustomer: (customerId: number) => dispatch({ type: 'customerChosen', customerId }),
      removeCustomer: () => dispatch({ type: 'customerRemoved' }),
      setChoice: (choice: DraftChoice) => dispatch({ type: 'choiceSet', choice }),
      proposeMethod: (methodId: PaymentMethod | null) => dispatch({ type: 'proposalArrived', methodId }),
      setDate: (date: string) => dispatch({ type: 'dateSet', date }),
      setShipping: (text: string) => dispatch({ type: 'shippingSet', text }),
      setNote: (text: string) => dispatch({ type: 'noteSet', text }),
    }),
    [],
  )
  return { state, ...actions }
}
