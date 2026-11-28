/**
 * The Sale in progress (`docs/product/sale-in-progress.md`): every rule of the sale being built in
 * New sale, as a pure reducer so a unit test drives each one with no rendering. A quantity is
 * integer hundredths and only ever moves by integer steps; typed text becomes one only through
 * `typedQuantity`. No money is computed here: every figure comes from `pricing.ts`.
 */

import type { PaymentMethod } from '../api/payments'
import { isIsoDate, maxSaleDate } from '../format/dates'
import { formatQuantity, type MoneyFormat } from '../format/money'
import { formatMoneyInput, parseGrams, parseMoneyInput } from '../format/parse'
import { LINE_STEP_HUNDREDTHS, toHundredths, type PaymentChoice, type SaleLineInput } from './pricing'

export type DraftChoice = { kind: 'unset' } | PaymentChoice

export interface DraftLine {
  productId: number
  quantityHundredths: number
  gift: boolean
  /** The line's typed total, already parsed; never together with `gift`. */
  specialPrice: number | null
}

/** The only place a default line is built: not a Gift, no Special price. */
export function draftLineOf(productId: number, quantityHundredths: number): DraftLine {
  return { productId, quantityHundredths, gift: false, specialPrice: null }
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

/** The one rule for a quantity in hundredths: a safe integer above 0 and at most
 * `MAX_QUANTITY_HUNDREDTHS`. Every path that lets a quantity into a line goes through it. */
export function isQuantityHundredths(n: number): boolean {
  return Number.isSafeInteger(n) && n > 0 && n <= MAX_QUANTITY_HUNDREDTHS
}

/** The one rule for a Special price: finite, above 0, and still a safe integer when rounded. */
export function isSpecialPrice(n: number): boolean {
  return Number.isFinite(n) && n > 0 && Number.isSafeInteger(Math.round(n))
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
  const hundredths = toHundredths(normalized)
  return hundredths !== null && isQuantityHundredths(hundredths) ? hundredths : null
}

declare const lineEditBrand: unique symbol

/** What the line detail confirmed: only `lineEditOf` builds one, so a screen cannot hand the
 * reducer values nobody checked. */
export interface LineEdit {
  readonly [lineEditBrand]: true
  readonly quantityHundredths: number
  readonly gift: boolean
  readonly specialPrice: number | null
}

export type LineEditRefusal = 'quantity' | 'giftWithSpecial' | 'specialZero'

/** What the line detail holds as typed, turned into an edit or the first refusal, in this order:
 * quantity; Gift with any Special price text (judged on the text, before its value is read);
 * a Special price that is not money or not above 0. A blank Special price text is no Special
 * price. */
export function lineEditOf(
  buffer: { quantityText: string; gift: boolean; specialText: string },
  format: MoneyFormat,
): { ok: true; edit: LineEdit } | { ok: false; refusal: LineEditRefusal } {
  const quantityHundredths = typedQuantity(buffer.quantityText)
  if (quantityHundredths === null) return { ok: false, refusal: 'quantity' }
  const blank = buffer.specialText.trim() === ''
  if (buffer.gift && !blank) return { ok: false, refusal: 'giftWithSpecial' }
  let specialPrice: number | null = null
  if (!blank) {
    const parsed = parseMoneyInput(buffer.specialText, format)
    if (!parsed.ok || !isSpecialPrice(parsed.value)) return { ok: false, refusal: 'specialZero' }
    specialPrice = parsed.value
  }
  const edit = { quantityHundredths, gift: buffer.gift, specialPrice } as LineEdit
  return { ok: true, edit }
}

/** What the line detail holds as typed. Only `lineBufferOf` seeds it and only `lineBufferWith`
 * changes it, so Gift and a Special price text never hold together. */
export interface LineBuffer {
  quantityText: string
  gift: boolean
  specialText: string
}

/** One change to the buffer: a typed quantity, a typed Special price, or the Gift control. */
export type LineBufferChange = { quantityText: string } | { specialText: string } | { gift: boolean }

/** The buffer a line starts from: the quantity as the row shows it, the Special price as the amount
 * field prefills it (blank when there is none). */
export function lineBufferOf(line: DraftLine, format: MoneyFormat): LineBuffer {
  return {
    quantityText: formatQuantity(line.quantityHundredths),
    gift: line.gift,
    specialText: line.specialPrice === null ? '' : formatMoneyInput(line.specialPrice, format),
  }
}

/** The one way the buffer changes: Gift on empties the Special price text, a non-blank Special
 * price text turns Gift off, and a quantity edit leaves both as they are. */
export function lineBufferWith(buffer: LineBuffer, change: LineBufferChange): LineBuffer {
  if ('quantityText' in change) return { ...buffer, quantityText: change.quantityText }
  if ('gift' in change) return { ...buffer, gift: change.gift, specialText: change.gift ? '' : buffer.specialText }
  const gift = change.specialText.trim() === '' ? buffer.gift : false
  return { ...buffer, gift, specialText: change.specialText }
}

/** Whether the buffer differs from the line: a refusal counts as changed, otherwise the parsed
 * quantity, Gift and Special price are compared with the line's own. */
export function lineEditChanged(line: DraftLine, buffer: LineBuffer, format: MoneyFormat): boolean {
  const result = lineEditOf(buffer, format)
  if (!result.ok) return true
  const { edit } = result
  return (
    edit.quantityHundredths !== line.quantityHundredths ||
    edit.gift !== line.gift ||
    edit.specialPrice !== line.specialPrice
  )
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
    gift: line.gift,
    specialPrice: line.specialPrice,
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
  | { type: 'lineEdited'; productId: number; quantityHundredths: number; gift: boolean; specialPrice: number | null }
  | { type: 'lineRemoved'; productId: number }
  | { type: 'dateSet'; date: string; today: string }
  | { type: 'shippingSet'; text: string }
  | { type: 'noteSet'; text: string }

function raised(state: DraftState, productId: number): DraftState {
  const line = state.lines.find((candidate) => candidate.productId === productId)
  if (line === undefined) {
    return { ...state, lines: [...state.lines, draftLineOf(productId, LINE_STEP_HUNDREDTHS)] }
  }
  const next = line.quantityHundredths + LINE_STEP_HUNDREDTHS
  if (!isQuantityHundredths(next)) return state
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
      // Owing stays: resetting it would turn the proposal into a Payment nobody chose.
      return { ...state, customerId: null }
    case 'choiceSet':
      return { ...state, choice: action.choice }
    case 'proposalArrived':
      return { ...state, proposedMethodId: action.methodId }
    case 'lineEdited': {
      if (!state.lines.some((line) => line.productId === action.productId)) return state
      if (action.gift && action.specialPrice !== null) return state
      if (action.specialPrice !== null && !isSpecialPrice(action.specialPrice)) return state
      if (!isQuantityHundredths(action.quantityHundredths)) return state
      return {
        ...state,
        lines: state.lines.map((line) =>
          line.productId === action.productId
            ? {
                ...line,
                quantityHundredths: action.quantityHundredths,
                gift: action.gift,
                specialPrice: action.specialPrice,
              }
            : line,
        ),
      }
    }
    case 'lineRemoved':
      return state.lines.some((line) => line.productId === action.productId)
        ? { ...state, lines: state.lines.filter((line) => line.productId !== action.productId) }
        : state
    case 'dateSet':
      // Both sides are zero-padded YYYY-MM-DD, so comparing the strings compares the days.
      return isIsoDate(action.date) && action.date <= maxSaleDate(action.today)
        ? { ...state, date: action.date }
        : state
    case 'shippingSet':
      return { ...state, shipping: action.text }
    case 'noteSet':
      return { ...state, note: action.text }
  }
}
