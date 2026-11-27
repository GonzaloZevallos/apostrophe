/**
 * The Products tab tap and the search store through `Shell`, under a memory data router: every
 * screen of the registry is a stub holding a test consumer of `useProductsSearch`, so what the
 * text does is what the provider decides. The nonce is read from the router's location state
 * through `readNonce` only; `useViewport` is mocked per case.
 */

import { StrictMode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Outlet, RouterProvider, useNavigate, type RouteObject } from 'react-router'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { Me } from '../api/me'
import LeaveConfirm from '../components/LeaveConfirm'
import { useLeaveGuard } from '../components/useLeaveGuard'
import { MoneyFormatProvider } from '../format/MoneyFormatProvider'
import {
  ARCHIVED_VARIETIES,
  HOME,
  SCREENS,
  STOCK,
  STOCK_ENTRY_NEW,
  VARIETIES,
  VARIETY,
  VARIETY_NEW,
  pathTo,
  type Screen,
} from '../routes'
import { readNonce, useProductsSearch } from '../screens/varieties/productsSearch'
import { SHOWN_EN } from '../test/shownLanguage'
import Shell from './Shell'

const ME: Me = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-03', shown_language: SHOWN_EN, money: { symbol: '$', decimals: 0 } }

const viewport = vi.hoisted(() => ({ current: 'phone' as 'phone' | 'computer' }))

vi.mock('./useViewport', () => ({ useViewport: () => viewport.current }))

const PRODUCT = pathTo(VARIETY, { id: 1 })

/** The test consumer: a box bound to the store's text. */
function Consumer() {
  const { text, setText } = useProductsSearch()
  return <input aria-label="Search" value={text} onChange={(event) => setText(event.target.value)} />
}

/** A Product page whose form is dirty: it leaves through the real leave guard. */
function DirtyProduct() {
  const { blocker, disarm } = useLeaveGuard(true)
  const navigate = useNavigate()
  return (
    <>
      <Consumer />
      <button
        type="button"
        onClick={() => {
          disarm()
          void navigate(VARIETIES)
        }}
      >
        Save
      </button>
      {blocker.state === 'blocked' && (
        <>
          <p>{`drawn ${readNonce(blocker.location.state) ?? 'none'}`}</p>
          <LeaveConfirm blocker={blocker} question="Discard?" detail="Lost." keepLabel="Stay" discardLabel="Leave" />
        </>
      )}
    </>
  )
}

function leaf(entry: Screen, dirtyProduct: boolean): RouteObject {
  const element = dirtyProduct && entry.id === 'variety' ? <DirtyProduct /> : <Consumer />
  return { path: entry.path, element, handle: { screen: entry.id } }
}

function tree(dirtyProduct: boolean): RouteObject[] {
  return [
    {
      element: (
        <MoneyFormatProvider format={ME.money}>
          <Outlet context={ME} />
        </MoneyFormatProvider>
      ),
      children: [{ element: <Shell />, children: SCREENS.map((entry) => leaf(entry, dirtyProduct)) }],
    },
  ]
}

type Router = ReturnType<typeof createMemoryRouter>

function renderShell(
  entries: string[],
  options: { computer?: boolean; dirtyProduct?: boolean; strict?: boolean } = {},
) {
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('network error'))))
  viewport.current = options.computer === true ? 'computer' : 'phone'
  const router = createMemoryRouter(tree(options.dirtyProduct === true), { initialEntries: entries })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const app = (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
  const view = render(options.strict === true ? <StrictMode>{app}</StrictMode> : app)
  return { router, view }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

/** The Products link of the bar (the second `navigation`, after the rail) or of the rail. */
function productsLink(surface: 'bar' | 'rail'): HTMLElement {
  const [rail, bar] = screen.getAllByRole('navigation')
  return within((surface === 'rail' ? rail : bar) as HTMLElement).getByRole('link', { name: 'Products' })
}

function box(): HTMLElement {
  return screen.getByRole('textbox', { name: 'Search' })
}

async function type(text: string) {
  await userEvent.setup().type(box(), text)
}

async function go(router: Router, to: string | number) {
  await act(async () => {
    await (typeof to === 'number' ? router.navigate(to) : router.navigate(to))
  })
}

/** The Products tab nonce of the entry the router is on. */
function nonceOf(router: Router): string | null {
  return readNonce(router.state.location.state)
}

describe('the search text across Products screens', () => {
  test.each([
    ['a Product page', PRODUCT],
    ['Archived', ARCHIVED_VARIETIES],
    ['All entries', STOCK],
    ['Take from stock', STOCK_ENTRY_NEW],
    ['New product', VARIETY_NEW],
  ])('is kept across %s and back', async (_name, path) => {
    const { router } = renderShell([VARIETIES])
    await type('abc')

    await go(router, path)
    expect(box()).toHaveValue('abc')

    await go(router, -1)
    expect(box()).toHaveValue('abc')
  })

  test('is cleared by going Home, and stays cleared on the way back', async () => {
    const { router } = renderShell([VARIETIES])
    await type('abc')

    await go(router, HOME)
    expect(box()).toHaveValue('')

    await go(router, -1)
    expect(box()).toHaveValue('')
  })

  test('is cleared by a tab tap on the list', async () => {
    const { router } = renderShell([VARIETIES])
    await type('abc')

    await userEvent.setup().click(productsLink('bar'))

    expect(box()).toHaveValue('')
    expect(router.state.location.pathname).toBe(VARIETIES)
  })

  test('is cleared by a tab tap from a Product page', async () => {
    const { router } = renderShell([VARIETIES, PRODUCT])
    await type('abc')

    await userEvent.setup().click(productsLink('bar'))

    expect(router.state.location.pathname).toBe(VARIETIES)
    expect(box()).toHaveValue('')
  })

  test('is cleared by a remount', async () => {
    const { view } = renderShell([VARIETIES])
    await type('abc')

    view.unmount()
    renderShell([VARIETIES])

    expect(box()).toHaveValue('')
  })
})

describe('the Products tab nonce', () => {
  test('is the only entry written to the history state, and a non-empty string', async () => {
    const { router } = renderShell([VARIETIES, PRODUCT])

    await userEvent.setup().click(productsLink('bar'))

    expect(nonceOf(router)).not.toBeNull()
    expect(Object.keys(router.state.location.state as object)).toHaveLength(1)
  })

  test('differs between two taps', async () => {
    const { router } = renderShell([VARIETIES, PRODUCT])
    const user = userEvent.setup()

    await user.click(productsLink('bar'))
    const first = nonceOf(router)
    await go(router, PRODUCT)
    await user.click(productsLink('bar'))

    expect(nonceOf(router)).not.toBeNull()
    expect(nonceOf(router)).not.toBe(first)
  })

  test('is written by Enter on the focused link', async () => {
    const { router } = renderShell([VARIETIES, PRODUCT])
    const user = userEvent.setup()

    productsLink('bar').focus()
    await user.keyboard('{Enter}')

    expect(router.state.location.pathname).toBe(VARIETIES)
    expect(nonceOf(router)).not.toBeNull()
  })

  test('is written by the rail link at computer width', async () => {
    const { router } = renderShell([VARIETIES, PRODUCT], { computer: true })

    await userEvent.setup().click(productsLink('rail'))

    expect(router.state.location.pathname).toBe(VARIETIES)
    expect(nonceOf(router)).not.toBeNull()
  })

  test('is not drawn by a plain visit', async () => {
    const { router } = renderShell([VARIETIES])

    await go(router, PRODUCT)

    expect(nonceOf(router)).toBeNull()
  })
})

/** Clicks, and says whether the tab prevented the browser's own handling. */
function clickAndSeeIfPrevented(link: HTMLElement, init: MouseEventInit): boolean {
  let prevented = false
  const seen = (event: Event) => {
    prevented = event.defaultPrevented
    event.preventDefault()
  }
  document.addEventListener('click', seen)
  fireEvent.click(link, init)
  document.removeEventListener('click', seen)
  return prevented
}

describe('a tap on the Products tab', () => {
  test('on the very path replaces the entry', async () => {
    const { router } = renderShell([HOME, VARIETIES])

    await userEvent.setup().click(productsLink('bar'))

    expect(router.state.historyAction).toBe('REPLACE')
    await go(router, -1)
    expect(router.state.location.pathname).toBe(HOME)
  })

  test.each(['/varieties/', '/varieties?x'])('on %s pushes an entry', async (entry) => {
    const { router } = renderShell([entry])

    await userEvent.setup().click(productsLink('bar'))

    expect(router.state.historyAction).toBe('PUSH')
    expect(nonceOf(router)).not.toBeNull()
  })

  test.each([
    ['a modifier click', { ctrlKey: true }],
    ['a meta click', { metaKey: true }],
    ['a middle click', { button: 1 }],
  ])('falls through on %s: not prevented, nothing navigated', (_name, init) => {
    const { router } = renderShell([HOME])

    expect(clickAndSeeIfPrevented(productsLink('bar'), init)).toBe(false)

    expect(router.state.location.pathname).toBe(HOME)
  })

  test('prevents the browser on a plain click', () => {
    renderShell([HOME])

    expect(clickAndSeeIfPrevented(productsLink('bar'), {})).toBe(true)
  })

  test('keeps its href, mark and class names on the bar and the rail', () => {
    renderShell([VARIETIES], { computer: true })

    const bar = productsLink('bar')
    expect(bar).toHaveAttribute('href', VARIETIES)
    expect(bar).toHaveAttribute('aria-current', 'page')
    expect(bar).toHaveAttribute('class', 'bar-inferior__item bar-inferior__item--activo')
    const rail = productsLink('rail')
    expect(rail).toHaveAttribute('href', VARIETIES)
    expect(rail).toHaveAttribute('aria-current', 'page')
    expect(rail).toHaveAttribute('class', 'riel-lateral__item riel-lateral__item--activo')
  })
})

describe('the provider sequence under StrictMode', () => {
  test('keeps on a Product page and back, clears on a tab tap', async () => {
    const { router } = renderShell([VARIETIES], { strict: true })
    await type('abc')

    await go(router, PRODUCT)
    expect(box()).toHaveValue('abc')
    await go(router, -1)
    expect(box()).toHaveValue('abc')

    await go(router, PRODUCT)
    await userEvent.setup().click(productsLink('bar'))
    expect(box()).toHaveValue('')
  })
})

describe('the real leave guard on a dirty Product page', () => {
  test('Stay keeps the text, and it is still kept after a later save', async () => {
    const { router } = renderShell([VARIETIES, PRODUCT], { dirtyProduct: true })
    const user = userEvent.setup()
    await type('abc')

    await user.click(productsLink('bar'))
    expect(screen.getByRole('alertdialog', { name: 'Discard?' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Stay' }))

    expect(router.state.location.pathname).toBe(PRODUCT)
    expect(box()).toHaveValue('abc')

    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(router.state.location.pathname).toBe(VARIETIES)
    expect(box()).toHaveValue('abc')
  })

  test('Leave clears the text and lands with the nonce that was drawn', async () => {
    const { router } = renderShell([VARIETIES, PRODUCT], { dirtyProduct: true })
    const user = userEvent.setup()
    await type('abc')

    await user.click(productsLink('bar'))
    const drawn = screen.getByText(/^drawn /).textContent?.replace('drawn ', '')
    await user.click(screen.getByRole('button', { name: 'Leave' }))

    expect(router.state.location.pathname).toBe(VARIETIES)
    expect(drawn).not.toBe('none')
    expect(nonceOf(router)).toBe(drawn)
    expect(box()).toHaveValue('')
  })
})
