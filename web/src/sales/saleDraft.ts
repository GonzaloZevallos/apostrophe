/**
 * The Sale in progress (`docs/product/sale-in-progress.md`): every rule of the sale being built in
 * New sale, as a pure reducer so a unit test drives each one with no rendering. A quantity is
 * integer hundredths and only ever moves by integer steps; typed text becomes one only through
 * `typedQuantity`. No money is computed here: every figure comes from `pricing.ts`.
 */

import type { PaymentMethod } from '../api/payments'
import { parseGrams } from '../format/parse'
import { LINE_STEP_HUNDREDTHS, toHundredths, type PaymentChoice, type SaleLineInput } from './pricing'

export type DraftChoice = { kind: 'unset' } | PaymentChoice

export interface DraftLine {
  productId: number
  quantityHundredths: number
}

export interface DraftState {
  customerId: number | null
  lines: DraftLine[]
  /** The sale's own date, editable. */
  date: string
  /** The day New sale was opened: set once, never changed by an action; the only date the
   * suggestions read is keyed on. */
  openedOn: string
  /** Shipping charged and Note, held as typed. */
  shipping: string
  note: string
  proposedMethodId: PaymentMethod | null
  choice: DraftChoice
}

/** No quantity exceeds this: 13 whole digits and two decimals, so it is checked on the digit
 * string before any number is built. */
export const MAX_QUANTITY_HUNDREDTHS = 999_999_999_999_999
const MAX_WHOLE_DIGITS = 13

export function initialDraft({
  today,
  customerId = null,
}: {
  today: string
  customerId?: number | null
}): DraftState {
  return {
    customerId,
    lines: [],
    date: today,
    openedOn: today,
    shipping: '',
    note: '',
    proposedMethodId: null,
    choice: { kind: 'unset' },
  }
}

/** Typed text to hundredths, or `null` for a refusal: not above 0, not at most two decimals, or
 * past `MAX_QUANTITY_HUNDREDTHS`. Never rounds. */
export function typedQuantity(text: string): number | null {
  const parsed = parseGrams(text)
  if (!parsed.ok) return null
  const [whole = '', fraction] = parsed.value.split('.')
  const stripped = whole.replace(/^0+/, '')
  if (stripped.length > MAX_WHOLE_DIGITS) return null
  const normalized = `${stripped === '' ? '0' : stripped}${fraction === undefined ? '' : `.${fraction}`}`
  return toHundredths(normalized)
}

/** What counts as the sale's payment: the seller's own pick as it is, and for unset the proposal
 * only when it is one of the offered Payment methods (`null` until that list has arrived). */
export function effectiveChoice(
  choice: DraftChoice,
  proposedMethodId: PaymentMethod | null,
  offeredMethodIds: readonly number[] | null,
): PaymentChoice | null {
  if (choice.kind !== 'unset') return choice
  if (proposedMethodId === null || offeredMethodIds === null) return null
  return offeredMethodIds.includes(proposedMethodId)
    ? { kind: 'paid', payment_method_id: proposedMethodId }
    : null
}

/** The draft's own lines as `priceSale` takes them: the only lines it is called with. A line is
 * unique by product, so the product id is the line's id. */
export function saleLineInputsOf(lines: readonly DraftLine[]): SaleLineInput[] {
  return lines.map((line) => ({
    id: String(line.productId),
    productId: line.productId,
    gramsHundredths: line.quantityHundredths,
    gift: false,
    specialPrice: null,
  }))
}

export function isDirty(state: DraftState): boolean {
  return state.lines.length > 0
}

export type DraftAction =
  | { type: 'productAdded'; productId: number }
  | { type: 'stepUp'; productId: number }
  | { type: 'stepDown'; productId: number }
  | { type: 'quantityTyped'; productId: number; text: string }
  | { type: 'customerChosen'; customerId: number }
  | { type: 'customerRemoved' }
  | { type: 'choiceSet'; choice: DraftChoice }
  | { type: 'proposalArrived'; methodId: PaymentMethod | null }
  | { type: 'dateSet'; date: string }
  | { type: 'shippingSet'; text: string }
  | { type: 'noteSet'; text: string }

function raised(state: DraftState, productId: number): DraftState {
  const line = state.lines.find((candidate) => candidate.productId === productId)
  if (line === undefined) {
    return { ...state, lines: [...state.lines, { productId, quantityHundredths: LINE_STEP_HUNDREDTHS }] }
  }
  const next = line.quantityHundredths + LINE_STEP_HUNDREDTHS
  if (next > MAX_QUANTITY_HUNDREDTHS) return state
  return {
    ...state,
    lines: state.lines.map((candidate) =>
      candidate.productId === productId ? { ...candidate, quantityHundredths: next } : candidate,
    ),
  }
}

export function saleDraftReducer(state: DraftState, action: DraftAction): DraftState {
  switch (action.type) {
    case 'productAdded':
      return raised(state, action.productId)
    case 'stepUp':
      return state.lines.some((line) => line.productId === action.productId)
        ? raised(state, action.productId)
        : state
    case 'stepDown': {
      const line = state.lines.find((candidate) => candidate.productId === action.productId)
      if (line === undefined) return state
      if (line.quantityHundredths <= LINE_STEP_HUNDREDTHS) {
        return { ...state, lines: state.lines.filter((candidate) => candidate !== line) }
      }
      return {
        ...state,
        lines: state.lines.map((candidate) =>
          candidate === line ? { ...candidate, quantityHundredths: candidate.quantityHundredths - LINE_STEP_HUNDREDTHS } : candidate,
        ),
      }
    }
    case 'quantityTyped': {
      const quantity = typedQuantity(action.text)
      if (quantity === null) return state
      if (!state.lines.some((line) => line.productId === action.productId)) return state
      return {
        ...state,
        lines: state.lines.map((line) =>
          line.productId === action.productId ? { ...line, quantityHundredths: quantity } : line,
        ),
      }
    }
    case 'customerChosen':
      return { ...state, customerId: action.customerId }
    case 'customerRemoved':
      return {
        ...state,
        customerId: null,
        choice: state.choice.kind === 'owing' ? { kind: 'unset' } : state.choice,
      }
    case 'choiceSet':
      return { ...state, choice: action.choice }
    case 'proposalArrived':
      return { ...state, proposedMethodId: action.methodId }
    case 'dateSet':
      return { ...state, date: action.date }
    case 'shippingSet':
      return { ...state, shipping: action.text }
    case 'noteSet':
      return { ...state, note: action.text }
  }
}
