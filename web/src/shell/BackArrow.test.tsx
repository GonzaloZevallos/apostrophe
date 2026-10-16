/**
 * The shell's "‹ <parent>" arrow on the cards that read a record (`cardRecord.tsx`), through
 * the real `Shell` and the varieties screens with `fetch` faked, some answers held back by
 * `deferredAnswer`: an archived variety's page goes back to Archivadas, a variety's two "Ver
 * todas" lists to the variety by name, and while the record loads, fails or is gone the arrow
 * is there all the same with the registry's static parent.
 *
 * The arrow is found where the shell draws it (`.flecha-atras`), so a card that still draws
 * its own does not change what these tests count.
 */

import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { useCardRecord } from './useCardRecord'
import Shell from './Shell'
import { ARCHIVED_VARIETIES, VARIETIES, VARIETY, VARIETY_ENTRIES, VARIETY_PRICES, pathTo, relative } from '../routes'
import {
  ME,
  deferredAnswer,
  jsonResponse,
  renderVarietiesInShell,
  type FetchImpl,
} from '../screens/varieties/renderVarieties'

const viewport = vi.hoisted(() => ({ current: 'phone' as 'phone' | 'computer' }))

vi.mock('./useViewport', () => ({ useViewport: () => viewport.current }))

beforeEach(() => {
  viewport.current = 'phone'
})

const LIVE = { id: 1, name: '24K Gold', archived: false, current_price: null }
const ARCHIVED = { id: 2, name: 'Vieja', archived: true, current_price: null }
const STOCK = { total: 0, varieties: [], entries: [] }
const CATALOG = { text: '', header: '', footer: '', varieties: [] }

type Answer = Response | Promise<Response>

/** The faked API for varieties 1 (live) and 2 (archived); `overrides` replaces any answer. */
function api(overrides: Record<string, () => Answer> = {}): FetchImpl {
  const answers: Record<string, () => Answer> = {
    'GET /varieties/1': () => jsonResponse(200, LIVE),
    'GET /varieties/2': () => jsonResponse(200, ARCHIVED),
    'GET /varieties/1/prices': () => jsonResponse(200, []),
    'GET /varieties/2/prices': () => jsonResponse(200, []),
    'GET /varieties': () => jsonResponse(200, [LIVE]),
    'GET /stock': () => jsonResponse(200, STOCK),
    'GET /stock?archived=true': () => jsonResponse(200, STOCK),
    'GET /stock/varieties/1/movements': () => jsonResponse(200, []),
    'GET /stock/varieties/2/movements': () => jsonResponse(200, []),
    'GET /catalog': () => jsonResponse(200, CATALOG),
    'GET /pricing-settings': () => jsonResponse(200, { is_bulk_pricing: true, is_vip_customers: true }),
    ...overrides,
  }
  return (url, init) => {
    const answer = answers[`${init?.method ?? 'GET'} ${url}`]
    if (answer === undefined) return Promise.reject(new Error(`unexpected request: ${url}`))
    return Promise.resolve(answer())
  }
}

/** The arrows the shell draws, as their labels. */
function shellArrows(): string[] {
  return [...document.querySelectorAll('.flecha-atras button')].map((button) => button.textContent ?? '')
}

async function tapShellArrow() {
  const button = document.querySelector('.flecha-atras button')
  if (button === null) throw new Error('the shell drew no arrow')
  await userEvent.setup().click(button)
}

const VARIETY_ONE = pathTo(VARIETY, { id: 1 })
const VARIETY_TWO = pathTo(VARIETY, { id: 2 })

describe("a variety's page", () => {
  test('an archived variety reads "‹ Archivadas" once loaded, and back with no history lands on Archivadas', async () => {
    const { router } = renderVarietiesInShell([VARIETY_TWO], api())

    await screen.findByRole('heading', { name: 'Vieja' })
    await waitFor(() => expect(shellArrows()).toEqual(['‹ Archivadas']))
    await tapShellArrow()

    expect(router.state.location.pathname).toBe(ARCHIVED_VARIETIES)
    expect(screen.getByText('Pantalla Archivadas')).toBeInTheDocument()
  })

  test('a live variety reads "‹ Variedades", and back with no history lands on Variedades', async () => {
    const { router } = renderVarietiesInShell([VARIETY_ONE], api())

    await screen.findByRole('heading', { name: '24K Gold' })
    expect(shellArrows()).toEqual(['‹ Variedades'])
    await tapShellArrow()

    expect(router.state.location.pathname).toBe(VARIETIES)
  })

  test('with the variety still loading the arrow is there with the static label', async () => {
    const held = deferredAnswer()
    renderVarietiesInShell([VARIETY_TWO], api({ 'GET /varieties/2': () => held.promise }))

    expect(shellArrows()).toEqual(['‹ Variedades'])
    await act(async () => {
      held.resolve(jsonResponse(200, ARCHIVED))
    })
    await waitFor(() => expect(shellArrows()).toEqual(['‹ Archivadas']))
  })

  test('with the variety failing the arrow is there beside the generic retry', async () => {
    const held = deferredAnswer()
    renderVarietiesInShell([VARIETY_TWO], api({ 'GET /varieties/2': () => held.promise }))

    await act(async () => {
      held.resolve(jsonResponse(500, { code: 'server_error' }))
    })

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(shellArrows()).toEqual(['‹ Variedades'])
  })

  test('a variety that is gone keeps the arrow beside "Volver a Variedades"', async () => {
    renderVarietiesInShell(
      [VARIETY_ONE],
      api({
        'GET /varieties/1': () => jsonResponse(404, { code: 'variety.not_found' }),
        'GET /varieties/1/prices': () => jsonResponse(404, { code: 'variety.not_found' }),
      }),
    )

    expect(await screen.findByRole('link', { name: /Volver a Variedades/ })).toBeInTheDocument()
    expect(shellArrows()).toEqual(['‹ Variedades'])
  })

  test('on a computer, archived A then live B in the same page never shows A\'s parent while B loads', async () => {
    viewport.current = 'computer'
    const held = deferredAnswer()
    const { router } = renderVarietiesInShell(
      [VARIETY_TWO],
      api({ 'GET /varieties/1': () => held.promise }),
    )
    await waitFor(() => expect(shellArrows()).toEqual(['‹ Archivadas']))

    // Every state the DOM passes through while B is held, not only the one it ends in.
    const seen: string[][] = []
    const observer = new MutationObserver(() => seen.push(shellArrows()))
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    await act(async () => {
      await router.navigate(VARIETY_ONE)
    })
    seen.push(shellArrows())
    observer.disconnect()

    for (const labels of seen) {
      expect(labels).toEqual(['‹ Variedades'])
    }
    await act(async () => {
      held.resolve(jsonResponse(200, LIVE))
    })
    await screen.findByRole('heading', { name: '24K Gold' })
    expect(shellArrows()).toEqual(['‹ Variedades'])
  })
})

describe("a variety's 'Ver todas' lists", () => {
  test.each([
    ['prices', pathTo(VARIETY_PRICES, { id: 1 })],
    ['entries', pathTo(VARIETY_ENTRIES, { id: 1 })],
  ])('%s: "‹ <variety>" once loaded, and back with no history lands on the variety\'s page', async (_name, path) => {
    const { router } = renderVarietiesInShell([path], api())

    await waitFor(() => expect(shellArrows()).toEqual(['‹ 24K Gold']))
    await tapShellArrow()

    expect(router.state.location.pathname).toBe(VARIETY_ONE)
  })

  test.each([
    ['prices', pathTo(VARIETY_PRICES, { id: 1 })],
    ['entries', pathTo(VARIETY_ENTRIES, { id: 1 })],
  ])('%s: with the variety pending the arrow is there with the static label, and back goes to the variety', async (_name, path) => {
    const held = deferredAnswer()
    const { router } = renderVarietiesInShell([path], api({ 'GET /varieties/1': () => held.promise }))

    expect(shellArrows()).toEqual(['‹ Variedad'])
    await tapShellArrow()

    expect(router.state.location.pathname).toBe(VARIETY_ONE)
  })
})

describe('a record published for another route', () => {
  /** A card that publishes variety 2 (archived) whatever the route's `:id` is. */
  function PublishesTwo() {
    useCardRecord({ id: 2, archived: true, name: 'Vieja' })
    return <main>Pantalla de otra variedad</main>
  }

  function renderAt(path: string) {
    const router = createMemoryRouter(
      [
        {
          element: <Outlet context={ME} />,
          children: [
            {
              element: <Shell />,
              children: [{ path: relative(VARIETY), element: <PublishesTwo />, handle: { screen: 'variety' } }],
            },
          ],
        },
      ],
      { initialEntries: [path] },
    )
    render(<RouterProvider router={router} />)
  }

  test("is not used: the arrow reads the registry's parent when the published id is not the route's", async () => {
    renderAt(VARIETY_ONE)

    await screen.findByText('Pantalla de otra variedad')
    expect(shellArrows()).toEqual(['‹ Variedades'])
  })

  test('is used when the published id is the route\'s', async () => {
    renderAt(VARIETY_TWO)

    await screen.findByText('Pantalla de otra variedad')
    await waitFor(() => expect(shellArrows()).toEqual(['‹ Archivadas']))
  })
})
