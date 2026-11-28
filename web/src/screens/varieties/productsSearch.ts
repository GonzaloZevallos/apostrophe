/**
 * The phone Products search text, held in memory by `ProductsSearchProvider`, and the Products tab
 * nonce that says "the seller tapped the Products tab". This module is the only reader and writer
 * of the nonce in history state (`location.state`), under the one entry named by `NONCE_PROPERTY`;
 * every other module reads it through `readNonce`. The search text is never in history state, a
 * path, a query or device storage: it lives in the provider's `useState` and dies with it.
 *
 * A tab tap (`shell/productsTabClick.ts`) navigates with `productsTabState()`, a fresh nonce. The
 * provider clears the text when the seller leaves Products, or arrives by PUSH or REPLACE carrying
 * a nonce it has not honoured yet (a tab tap); the same nonce (a segment switch), no nonce (a back
 * arrow, a redirect) and POP keep it.
 */

import { createContext, createElement, useContext, useState, type ReactNode } from 'react'
import { useLocation, useNavigationType, type NavigationType } from 'react-router'
import { placeOf, type ScreenId } from '../../routes'
import { useLeafScreenOrNull } from '../../shell/useLeafScreen'

const NONCE_PROPERTY = 'productsTab'

let counter = 0

/**
 * A new nonce, never equal to an earlier one of this page load. No `crypto.randomUUID`: the app
 * runs over plain HTTP, where it does not exist.
 */
export function newProductsTabNonce(): string {
  counter += 1
  return `${Date.now().toString(36)}-${counter}`
}

/** The history state of a tab tap: a fresh nonce and nothing else. */
export function productsTabState(): Record<typeof NONCE_PROPERTY, string> {
  return { [NONCE_PROPERTY]: newProductsTabNonce() }
}

/** A plain object: the prototype is `Object.prototype` or none (an array or a Date is not). */
function isPlainObject(state: unknown): state is Record<string, unknown> {
  if (typeof state !== 'object' || state === null) return false
  const prototype: unknown = Object.getPrototypeOf(state)
  return prototype === Object.prototype || prototype === null
}

/** The nonce the entry's state carries; `null` unless it is an own, non-empty string. */
export function readNonce(state: unknown): string | null {
  if (!isPlainObject(state)) return null
  if (!Object.hasOwn(state, NONCE_PROPERTY)) return null
  const value = state[NONCE_PROPERTY]
  return typeof value === 'string' && value !== '' ? value : null
}

// `\b` ends the word at the key: `productsTabState` and `productsTabClick` (this module's and the
// hook's names) are one longer word and pass; the key bare, quoted, computed or in a comment flags.
const LITERAL = /\bproductsTab\b/

/** The paths of the sources that spell the key: all but this module and its test. */
export function findProductsTabLiterals(files: readonly { path: string; content: string }[]): string[] {
  return files
    .filter(({ path }) => !/(^|\/)productsSearch(\.test)?\.ts$/.test(path))
    .filter(({ content }) => LITERAL.test(content))
    .map(({ path }) => path)
}

/** Whether the screen is on the Products tab on the phone: the bar marks `varieties`. */
export function isInsideProducts(id: ScreenId): boolean {
  return placeOf(id, 'phone').bar === 'varieties'
}

/**
 * Whether arriving at an entry clears the search text: the leaf is outside Products, or the
 * navigation is not POP and carries a nonce other than the last one honoured.
 */
export function clearsSearch(arrival: {
  insideProducts: boolean
  navigationType: NavigationType
  nonce: string | null
  lastNonce: string | null
}): boolean {
  if (!arrival.insideProducts) return true
  return arrival.navigationType !== 'POP' && arrival.nonce !== null && arrival.nonce !== arrival.lastNonce
}

interface Held {
  entryKey: string
  leaf: ScreenId | null
  lastNonce: string | null
  text: string
}

interface ProductsSearch {
  text: string
  setText: (text: string) => void
}

const ProductsSearchContext = createContext<ProductsSearch | null>(null)

/**
 * Holds the search text above the routed screens. The entry it last saw (its key and leaf) is
 * state, compared during render (the previous-key pattern): no ref and no effect. A leaf with no
 * screen (a test router without `handle`s) counts as inside Products, so only a fresh nonce clears.
 */
export function ProductsSearchProvider({ children }: { children: ReactNode }) {
  const location = useLocation()
  const navigationType = useNavigationType()
  const leaf = useLeafScreenOrNull()
  const leafId = leaf === null ? null : leaf.id
  const nonce = readNonce(location.state)
  const [held, setHeld] = useState<Held>({ entryKey: location.key, leaf: leafId, lastNonce: nonce, text: '' })
  let current = held
  if (held.entryKey !== location.key || held.leaf !== leafId) {
    const clears = clearsSearch({
      insideProducts: leafId === null || isInsideProducts(leafId),
      navigationType,
      nonce,
      lastNonce: held.lastNonce,
    })
    current = { entryKey: location.key, leaf: leafId, lastNonce: nonce ?? held.lastNonce, text: clears ? '' : held.text }
    setHeld(current)
  }
  const value = { text: current.text, setText: (text: string) => setHeld((before) => ({ ...before, text })) }
  return createElement(ProductsSearchContext.Provider, { value }, children)
}

/** The search text, raw and untrimmed, and its setter; throws outside `ProductsSearchProvider`. */
export function useProductsSearch(): ProductsSearch {
  const value = useContext(ProductsSearchContext)
  if (value === null) throw new Error('useProductsSearch: no ProductsSearchProvider above')
  return value
}
