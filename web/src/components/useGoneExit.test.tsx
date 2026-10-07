import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { CUSTOMERS, HOME, MORE, SETTINGS, STOCK, STOCK_ENTRY, VARIETIES, pathTo } from '../routes'
import { stubViewport } from '../test-viewport'
import { inAppState } from './inAppState'
import { normalisePath, useGoneExit } from './useGoneExit'
import { useGoneNotice } from './goneNotice'
import { SheetRouterProvider } from './useSheetStack'

afterEach(() => vi.unstubAllGlobals())

function Page({ name }: { name: string }) {
  return (
    <main>
      <h1>{name}</h1>
      {useGoneNotice() && <p role="status">Eso ya no está. La lista ya está al día.</p>}
    </main>
  )
}

function Form() {
  const exit = useGoneExit('stock-entry', { id: 7 })
  return (
    <button type="button" onClick={exit}>
      Salir
    </button>
  )
}

function SettingsForm() {
  const exit = useGoneExit('settings')
  return (
    <button type="button" onClick={exit}>
      Salir
    </button>
  )
}

function setup(entries: (string | { pathname: string; state: unknown })[], index: number) {
  const router = createMemoryRouter(
    [
      { path: VARIETIES, element: <Page name="Variedades" /> },
      { path: STOCK, element: <Page name="Todas" /> },
      { path: STOCK_ENTRY, element: <Form /> },
      { path: CUSTOMERS, element: <Page name="Clientes" /> },
      { path: SETTINGS, element: <SettingsForm /> },
      { path: MORE, element: <Page name="Más" /> },
      { path: HOME, element: <Page name="Inicio" /> },
    ],
    { initialEntries: entries, initialIndex: index },
  )
  render(
    <StrictMode>
      <SheetRouterProvider router={router}>
        <RouterProvider router={router} />
      </SheetRouterProvider>
    </StrictMode>,
  )
  return router
}

const ENTRY = pathTo(STOCK_ENTRY, { id: 7 })

test('opened from its parent, it pops: the parent is once in history and one Back leaves', async () => {
  const router = setup([VARIETIES, STOCK, { pathname: ENTRY, state: inAppState({ pathname: STOCK }) }], 2)

  await userEvent.click(screen.getByRole('button', { name: 'Salir' }))

  expect(router.state.location.pathname).toBe(STOCK)
  expect(router.state.historyAction).toBe('POP')
  expect(screen.getAllByRole('status')).toHaveLength(1)
  await act(async () => router.navigate(-1))
  expect(router.state.location.pathname).toBe(VARIETIES)
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

test('opened from another screen, it replaces the entry with the parent and leaves the one behind alone', async () => {
  const router = setup([VARIETIES, { pathname: ENTRY, state: inAppState({ pathname: VARIETIES }) }], 1)

  await userEvent.click(screen.getByRole('button', { name: 'Salir' }))

  expect(router.state.location.pathname).toBe(STOCK)
  expect(router.state.historyAction).toBe('REPLACE')
  expect(screen.getAllByRole('status')).toHaveLength(1)
  await act(async () => router.navigate(-1))
  expect(router.state.location.pathname).toBe(VARIETIES)
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

test('a direct link, with no state, replaces with the parent and shows the notice', async () => {
  const router = setup([ENTRY], 0)

  await userEvent.click(screen.getByRole('button', { name: 'Salir' }))

  expect(router.state.location.pathname).toBe(STOCK)
  expect(router.state.historyAction).toBe('REPLACE')
  expect(screen.getAllByRole('status')).toHaveLength(1)
})

test('a reload that dropped the state still replaces to the parent, never pops out of the app', async () => {
  const router = setup([ENTRY], 0)
  await act(async () => router.navigate(ENTRY, { replace: true, state: null }))

  await userEvent.click(screen.getByRole('button', { name: 'Salir' }))

  expect(router.state.location.pathname).toBe(STOCK)
})

test('a from with a query string or a trailing slash still counts as the parent', async () => {
  for (const from of [`${STOCK}?page=2`, `${STOCK}/`, `${STOCK}#fin`]) {
    const router = setup([VARIETIES, STOCK, { pathname: ENTRY, state: inAppState({ pathname: from }) }], 2)
    await userEvent.click(screen.getByRole('button', { name: 'Salir' }))
    expect(router.state.historyAction).toBe('POP')
    expect(router.state.location.pathname).toBe(STOCK)
    document.body.innerHTML = ''
  }
})

test('the parent is the one of the viewport the user leaves in, not the one it opened in', async () => {
  stubViewport('phone')
  const router = setup([MORE, { pathname: SETTINGS, state: inAppState({ pathname: MORE }) }], 1)
  // On a computer Configuración's parent is Inicio, so the entry behind (Más) is not it.
  stubViewport('computer')

  await userEvent.click(screen.getByRole('button', { name: 'Salir' }))

  expect(router.state.historyAction).toBe('REPLACE')
  expect(router.state.location.pathname).toBe(HOME)
})

test('normalisePath drops the query, the hash and one trailing slash, and keeps the root', () => {
  expect(normalisePath('/a/b/?x=1#y')).toBe('/a/b')
  expect(normalisePath('/')).toBe('/')
  expect(normalisePath('/a//')).toBe('/a/')
})
