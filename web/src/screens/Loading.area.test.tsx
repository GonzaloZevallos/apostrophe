/**
 * The screens that wait on their first answer, with `fetch` held: the content area itself carries
 * `aria-busy="true"` from the first render, and loses it once the answers have come
 * (CODING_STANDARDS §10 item 7). The area is found by role; the attribute is read on that element.
 */

import { CATALOG, CUSTOMERS, HOME, WITHDRAWAL_NEW } from '../routes'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { Me } from '../api/me'
import FlashProvider from '../flash/FlashProvider'
import { SHOWN_EN } from '../test/shownLanguage'
import { stubViewport } from '../test-viewport'
import Catalogo from './Catalogo'
import ClientesLayout from './clientes/ClientesLayout'
import Clientes from './clientes/Clientes'
import Inicio from './Inicio'
import { jsonResponse, renderWithdrawals, REASONS, VARIETIES } from './withdrawals/renderWithdrawals'

const ME: Me = { email: 'a@b.com', business_name: 'Business', today: '2026-10-03', shown_language: SHOWN_EN }

/** Releases every held answer; until then `fetch` never settles. */
let release: () => void
let gate: Promise<void>

beforeEach(() => {
  gate = new Promise<void>((resolve) => {
    release = resolve
  })
  stubViewport('phone')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/** Every read answers 503 once released: an answer that settles the query, whatever it holds. */
function holdFetch(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      await gate
      return jsonResponse(503, { detail: 'down' })
    }),
  )
}

function renderScreen(path: string, element: ReactElement, layout?: ReactElement): void {
  holdFetch()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            element={
              <FlashProvider>
                <Outlet context={ME} />
              </FlashProvider>
            }
          >
            <Route element={layout}>
              <Route path={path} element={element} />
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function releaseAnswers(): Promise<void> {
  release()
  await waitFor(() => expect(screen.getByRole('main')).not.toHaveAttribute('aria-busy'))
}

describe('a screen waiting on its first answer', () => {
  test('Inicio marks its own area busy from the first render, and clears it once answered', async () => {
    renderScreen(HOME, <Inicio />)
    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true')
    await releaseAnswers()
  })

  test('Catalogo marks its own area busy from the first render, and clears it once answered', async () => {
    renderScreen(CATALOG, <Catalogo />)
    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true')
    release()
    await waitFor(() => expect(screen.getByRole('main')).not.toHaveAttribute('aria-busy'))
  })

  test('Clientes marks its own area busy from the first render, and clears it once answered', async () => {
    renderScreen(CUSTOMERS, <Clientes />, <ClientesLayout />)
    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true')
    await releaseAnswers()
  })
})

describe('Sacar del stock on a phone', () => {
  test('the sheet body is busy until both lists answer', async () => {
    renderWithdrawals(
      [WITHDRAWAL_NEW],
      () => Promise.resolve(jsonResponse(200, {})),
      () => gate.then(() => jsonResponse(200, VARIETIES)),
      undefined,
      () => gate.then(() => jsonResponse(200, REASONS)),
    )
    const sheet = await screen.findByRole('dialog')
    expect(sheet).toHaveAttribute('aria-busy', 'true')
    release()
    await waitFor(() => expect(screen.getByRole('dialog')).not.toHaveAttribute('aria-busy'))
  })
})
