/**
 * The Products search store: the nonce helpers and `clearsSearch` as pure functions, the source
 * scan that keeps the history-state key in this module, and `ProductsSearchProvider` in a memory
 * router. This file is the only test that spells the key, in the seeded scan cases.
 */

import { act, render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createElement, StrictMode } from 'react'
import { createMemoryRouter, Outlet, RouterProvider, NavigationType } from 'react-router'
import { expect, test } from 'vitest'
import { HOME, parentOf, pathTo, SCREENS, VARIETIES, VARIETY, ARCHIVED_VARIETIES, relative, type ScreenId } from '../../routes'
import {
  clearsSearch,
  findProductsTabLiterals,
  isInsideProducts,
  newProductsTabNonce,
  ProductsSearchProvider,
  productsTabState,
  readNonce,
  useProductsSearch,
} from './productsSearch'
import { withSegment } from './productsSegment'
import { withProductsSearch } from './renderVarieties'

interface Arrival {
  insideProducts: boolean
  navigationType: NavigationType
  nonce: string | null
  lastNonce: string | null
}

const INSIDE: Arrival = { insideProducts: true, navigationType: NavigationType.Push, nonce: null, lastNonce: 'n1' }

test.each<[string, Partial<Arrival>, boolean]>([
  ['leaving Products clears', { insideProducts: false }, true],
  ['leaving Products clears on POP too', { insideProducts: false, navigationType: NavigationType.Pop }, true],
  ['a fresh nonce on PUSH clears', { nonce: 'n2' }, true],
  ['a fresh nonce on REPLACE clears', { navigationType: NavigationType.Replace, nonce: 'n2' }, true],
  ['a stale nonce on REPLACE clears', { navigationType: NavigationType.Replace, nonce: 'n0', lastNonce: 'n2' }, true],
  ['the same nonce (a segment switch through withSegment) keeps', { navigationType: NavigationType.Replace, nonce: 'n1' }, false],
  ['POP back to an entry with another nonce keeps', { navigationType: NavigationType.Pop, nonce: 'n0' }, false],
  ['a forward POP to a fresh nonce keeps', { navigationType: NavigationType.Pop, nonce: 'n3' }, false],
  ['no nonce inside Products keeps (the back arrow)', { nonce: null }, false],
  ['the VarietyNew direct-address replace keeps', { navigationType: NavigationType.Replace, nonce: null }, false],
  ['the ArchivedVarieties FOLLOWED_REDIRECT redirect keeps', { navigationType: NavigationType.Replace, nonce: null, lastNonce: null }, false],
])('clearsSearch: %s', (_name, change, expected) => {
  expect(clearsSearch({ ...INSIDE, ...change })).toBe(expected)
})

test('a tab tap writes a state with the nonce and nothing else, and every nonce is new', () => {
  const first = productsTabState()
  const second = productsTabState()
  expect(Object.keys(first)).toHaveLength(1)
  expect(readNonce(first)).not.toBeNull()
  expect(readNonce(first)).not.toBe(readNonce(second))
  expect(newProductsTabNonce()).toMatch(/^[0-9a-z]+-\d+$/)
})

test.each<[string, unknown]>([
  ['undefined', undefined],
  ['null', null],
  ['a string', 'n1'],
  ['an array', [productsTabState()]],
  ['a Date', new Date(0)],
  ['an empty state', {}],
  ['an empty string', JSON.parse('{"productsTab":""}')],
  ['a number', JSON.parse('{"productsTab":3}')],
  ['a boolean', JSON.parse('{"productsTab":true}')],
  ['an object', JSON.parse('{"productsTab":{"nonce":"n1"}}')],
  ['an inherited property', Object.create(productsTabState())],
])('readNonce rejects %s', (_name, state) => {
  expect(readNonce(state)).toBeNull()
})

test('readNonce accepts an own non-empty string, with other keys beside it', () => {
  const state = withSegment(productsTabState(), 'stock')
  expect(readNonce(state)).toMatch(/^[0-9a-z]+-\d+$/)
})

test('isInsideProducts agrees with the phone parent chain for every registry id', () => {
  const chainHasProducts = (id: ScreenId): boolean => {
    const seen = new Set<ScreenId>()
    for (let at: ScreenId | undefined = id; at !== undefined && !seen.has(at); at = parentOf(at, 'phone')?.id) {
      if (at === 'varieties') return true
      seen.add(at)
    }
    return false
  }
  const inside = SCREENS.filter((entry) => isInsideProducts(entry.id)).map((entry) => entry.id)
  expect(inside).toContain('varieties')
  expect(inside).toContain('variety')
  expect(inside).not.toContain('home')
  for (const { id } of SCREENS) expect(isInsideProducts(id), id).toBe(chainHasProducts(id))
})

test('the scan flags the key written by hand and leaves the module, its test and look-alike words alone', () => {
  const flagged = [
    ['object', 'const s = { productsTab: x }'],
    ['quoted', "navigate(to, { state: { 'productsTab': x } })"],
    ['computed', 'const s = { ["productsTab"]: x }'],
    ['read', 'const n = state.productsTab'],
    ['comment', '// the productsTab key'],
  ] as const
  for (const [name, content] of flagged) {
    expect(findProductsTabLiterals([{ path: `src/screens/${name}.tsx`, content }]), name).toEqual([`src/screens/${name}.tsx`])
  }
  expect(
    findProductsTabLiterals([
      { path: 'src/shell/A.tsx', content: 'productsTabState()' },
      { path: 'src/shell/B.tsx', content: "import { x } from './productsTabClick'" },
      { path: 'src/shell/C.tsx', content: 'const productsTabs = []' },
      { path: 'src/screens/varieties/productsSearch.ts', content: "const P = 'productsTab'" },
      { path: 'src/screens/varieties/productsSearch.test.ts', content: "const P = 'productsTab'" },
    ]),
  ).toEqual([])
})

test('no file of web/src spells the history-state key but the store and its test', () => {
  const modules = import.meta.glob<string>('/src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true })
  const files = Object.entries(modules).map(([path, content]) => ({ path: path.replace(/^\//, ''), content }))
  expect(files.length).toBeGreaterThan(50)
  expect(findProductsTabLiterals(files)).toEqual([])
})

function Search() {
  const { text, setText } = useProductsSearch()
  return createElement('input', { 'aria-label': 'Search', value: text, onChange: (event) => setText(event.target.value) })
}

const ROUTES = [
  {
    element: createElement(ProductsSearchProvider, null, createElement(Outlet)),
    children: [
      { path: relative(HOME), element: createElement(Search), handle: { screen: 'home' } },
      { path: relative(VARIETIES), element: createElement(Search), handle: { screen: 'varieties' } },
      { path: relative(ARCHIVED_VARIETIES), element: createElement(Search), handle: { screen: 'varieties-archived' } },
      { path: relative(VARIETY), element: createElement(Search), handle: { screen: 'variety' } },
    ],
  },
]

function renderRouted(entries: Parameters<typeof createMemoryRouter>[1], strict = false) {
  const router = createMemoryRouter(ROUTES, entries)
  const tree = createElement(RouterProvider, { router })
  render(strict ? createElement(StrictMode, null, tree) : tree)
  return router
}

const search = () => screen.getByRole<HTMLInputElement>('textbox', { name: 'Search' })

test('the sequence: list N1, Product, tab N2, POP to N1 keeps, a segment REPLACE keeps, a fresh PUSH clears', async () => {
  const first = productsTabState()
  const second = productsTabState()
  const router = renderRouted({ initialEntries: [{ pathname: VARIETIES, state: first }] })
  await userEvent.type(search(), 'oro')
  await act(() => router.navigate(pathTo(VARIETY, { id: 1 })))
  expect(search().value).toBe('oro')
  await act(() => router.navigate(VARIETIES, { state: second }))
  expect(search().value).toBe('')
  await userEvent.type(search(), 'plata')
  await act(() => router.navigate(-2))
  expect(readNonce(router.state.location.state)).toBe(readNonce(first))
  expect(search().value).toBe('plata')
  await act(() => router.navigate(VARIETIES, { replace: true, state: withSegment(router.state.location.state, 'stock') }))
  expect(search().value).toBe('plata')
  await act(() => router.navigate(VARIETIES, { state: productsTabState() }))
  expect(search().value).toBe('')
})

test('leaving Products clears the text and coming back does not restore it', async () => {
  const router = renderRouted({ initialEntries: [VARIETIES] })
  await userEvent.type(search(), 'oro')
  await act(() => router.navigate(HOME))
  expect(search().value).toBe('')
  await act(() => router.navigate(-1))
  expect(search().value).toBe('')
})

test('a text is kept across the Products screens that carry no nonce', async () => {
  const router = renderRouted({ initialEntries: [VARIETIES] })
  await userEvent.type(search(), ' oro ')
  await act(() => router.navigate(ARCHIVED_VARIETIES))
  expect(search().value).toBe(' oro ')
  await act(() => router.navigate(VARIETIES, { replace: true }))
  expect(search().value).toBe(' oro ')
})

test('a route without a handle never throws, keeps without a nonce and clears on a fresh one', async () => {
  const router = createMemoryRouter(
    [{ element: createElement(ProductsSearchProvider, null, createElement(Outlet)), children: [{ path: '*', element: createElement(Search) }] }],
    { initialEntries: [VARIETIES] },
  )
  render(createElement(RouterProvider, { router }))
  await userEvent.type(search(), 'oro')
  await act(() => router.navigate(HOME))
  expect(search().value).toBe('oro')
  await act(() => router.navigate(VARIETIES, { state: productsTabState() }))
  expect(search().value).toBe('')
})

test('under StrictMode the double render clears once and keeps what it should', async () => {
  const router = renderRouted({ initialEntries: [{ pathname: VARIETIES, state: productsTabState() }] }, true)
  await userEvent.type(search(), 'oro')
  await act(() => router.navigate(pathTo(VARIETY, { id: 1 })))
  expect(search().value).toBe('oro')
  await act(() => router.navigate(VARIETIES, { state: productsTabState() }))
  expect(search().value).toBe('')
  await userEvent.type(search(), 'plata')
  await act(() => router.navigate(HOME))
  expect(search().value).toBe('')
})

test('useProductsSearch throws outside the provider', () => {
  const quiet = (event: ErrorEvent) => event.preventDefault()
  window.addEventListener('error', quiet)
  try {
    expect(() => renderHook(() => useProductsSearch())).toThrow('useProductsSearch: no ProductsSearchProvider above')
  } finally {
    window.removeEventListener('error', quiet)
  }
})

test('useProductsSearch works inside withProductsSearch and returns the text raw', async () => {
  const router = createMemoryRouter([
    { element: withProductsSearch(createElement(Outlet)), children: [{ path: '*', element: createElement(Search) }] },
  ])
  render(createElement(RouterProvider, { router }))
  await userEvent.type(search(), '  Oro  ')
  expect(search().value).toBe('  Oro  ')
})
