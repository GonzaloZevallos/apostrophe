/**
 * `PriceNew` as designed (`PrecioNuevo`, `PrecioNuevoCompu`), at the same seam as
 * `PriceNew.test.tsx`: the route through the real data router with `fetch` faked. On a
 * computer the form is the design's modal over the variety's page; on both, "Rige desde" is
 * the chip and the amounts carry a "$". `useViewport` is mocked per case, as in
 * `Settings.test.tsx`; the variety's page under the modal is the real one.
 */

import { act, fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { VARIETY, VARIETY_PRICE_NEW, pathTo } from '../../routes'
import { api, jsonResponse, renderVarieties, writes, type FetchImpl } from './renderVarieties'

const viewport = vi.hoisted(() => {
  const listeners = new Set<() => void>()
  return {
    current: 'phone' as 'phone' | 'computer',
    listeners,
    set(value: 'phone' | 'computer') {
      this.current = value
      listeners.forEach((listener) => listener())
    },
  }
})

vi.mock('../../shell/useViewport', async () => {
  const { useSyncExternalStore } = await import('react')
  return {
    useViewport: () =>
      useSyncExternalStore(
        (listener) => {
          viewport.listeners.add(listener)
          return () => viewport.listeners.delete(listener)
        },
        () => viewport.current,
      ),
  }
})

const VARIETY_PATH = pathTo(VARIETY, { id: 1 })
const NEW_PATH = pathTo(VARIETY_PRICE_NEW, { id: 1 })

const CREATED = jsonResponse(201, {
  id: 4,
  effective_from: '2026-10-02',
  list_price: 12000,
  bulk_price: null,
  bulk_minimum: null,
})

/** What the variety's page under the modal asks beside the variety and its prices. */
const PAGE_UNDER: Record<string, () => Response> = {
  'GET /stock': () =>
    jsonResponse(200, {
      total: 18,
      varieties: [{ variety_id: 1, grams: 18, status: 'low', sold_out_since: null, threshold: 20, days_left: 24 }],
      entries: [],
    }),
  'GET /catalog': () =>
    jsonResponse(200, {
      text: 'texto',
      header: '',
      footer: '',
      varieties: [{ id: 1, name: '24K Gold', emoji: null, indica_share: null, aroma: null, shown: true, state: 'in' }],
    }),
  'GET /stock/varieties/1/movements': () => jsonResponse(200, []),
}

function answers(overrides: Record<string, () => Response> = {}): FetchImpl {
  return api({ ...PAGE_UNDER, ...overrides })
}

async function openFromVariety(fetchImpl: FetchImpl) {
  const rendered = renderVarieties([VARIETY_PATH], fetchImpl)
  await userEvent.click(await screen.findByRole('link', { name: 'Nuevo precio' }))
  return rendered
}

beforeEach(() => {
  viewport.set('phone')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function dateInput(): HTMLInputElement {
  return screen.getByLabelText('Rige desde') as HTMLInputElement
}

test('"Rige desde" is a real date input whose label text is exactly that, with the chip beside it', async () => {
  await openFromVariety(answers())

  const input = await screen.findByLabelText('Rige desde')
  expect(input).toHaveAttribute('type', 'date')
  expect(input.closest('label')).toHaveTextContent(/^Rige desde$/)
  const chip = screen.getByText('Hoy 02/10')
  expect(chip).toHaveAttribute('aria-hidden', 'true')
  expect(chip.closest('label')).toBeNull()
  expect(input).toHaveAttribute('aria-describedby', chip.id)
})

test('the chip shows the chosen date as dd/mm and the POST carries the ISO date and whole pesos', async () => {
  const user = userEvent.setup()
  const { fetchMock } = await openFromVariety(answers({ 'POST /varieties/1/prices': () => CREATED.clone() }))

  await screen.findByLabelText('Rige desde')
  fireEvent.change(dateInput(), { target: { value: '2026-10-12' } })
  expect(screen.getByText('12/10')).toBeInTheDocument()
  expect(screen.queryByText('Hoy 02/10')).not.toBeInTheDocument()
  await user.type(screen.getByLabelText(/^Precio de lista/), '12000')
  await user.click(screen.getByRole('button', { name: 'Guardá el precio' }))

  await screen.findByText('Precio guardado')
  expect(writes(fetchMock)).toEqual([
    { call: 'POST /varieties/1/prices', body: { effective_from: '2026-10-12', list_price: 12000 } },
  ])
})

test('a click on the date input opens the browser\'s picker when it has one', async () => {
  const user = userEvent.setup()
  await openFromVariety(answers())
  const showPicker = vi.fn()
  const input = await screen.findByLabelText('Rige desde')
  Object.defineProperty(input, 'showPicker', { value: showPicker })

  await user.click(input)

  expect(showPicker).toHaveBeenCalledTimes(1)
})

test('a picker that refuses to open leaves the form working', async () => {
  const user = userEvent.setup()
  await openFromVariety(answers())
  const input = await screen.findByLabelText('Rige desde')
  Object.defineProperty(input, 'showPicker', {
    value: () => {
      throw new DOMException('not allowed', 'NotAllowedError')
    },
  })

  await user.click(input)

  expect(screen.getByLabelText(/^Precio de lista/)).toBeInTheDocument()
})

test('the list, bulk and VIP prices carry a "$" outside their labels; the minimum has none', async () => {
  await openFromVariety(answers())

  await screen.findByLabelText(/^Precio de lista/)
  for (const name of [/^Precio de lista/, /^Precio por cantidad/, /^Precio VIP/]) {
    const field = screen.getByLabelText(name).closest('.campo--monto')
    const prefix = within(field as HTMLElement).getByText('$')
    expect(prefix).toHaveAttribute('aria-hidden', 'true')
    expect(prefix.closest('label')).toBeNull()
  }
  expect(within(screen.getByLabelText(/^Mínimo en gramos/).closest('.campo') as HTMLElement).queryByText('$')).toBeNull()
  expect(screen.getByLabelText(/^Precio de lista/).closest('label')).not.toHaveTextContent('$')
})

test('on a phone: one main, no dialog and no variety page under the form', async () => {
  await openFromVariety(answers())

  await screen.findByLabelText('Rige desde')
  expect(screen.getAllByRole('main', { hidden: true })).toHaveLength(1)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.queryByText('24K Gold')).not.toBeInTheDocument()
})

async function openOnComputer(overrides: Record<string, () => Response> = {}) {
  viewport.set('computer')
  const rendered = await openFromVariety(answers(overrides))
  await screen.findByLabelText('Rige desde')
  return rendered
}

test('on a computer: one accessible main with the dialog "Nuevo precio", the variety page hidden beneath', async () => {
  await openOnComputer()

  const main = screen.getByRole('main')
  const dialog = within(main).getByRole('dialog', { name: 'Nuevo precio' })
  expect(dialog).toHaveAttribute('aria-modal', 'true')
  expect(within(dialog).getByLabelText('Rige desde')).toBeInTheDocument()
  expect(screen.getAllByRole('main', { hidden: true })).toHaveLength(2)
  const under = (await screen.findAllByText(/18 g/))[0]?.closest('.precio-nuevo__pagina')
  expect(under).not.toBeNull()
  expect(under).toHaveAttribute('aria-hidden', 'true')
  expect(under).toHaveAttribute('inert')
})

test('on a computer, "Cerrar" with something typed asks first; an untouched form closes at once', async () => {
  const user = userEvent.setup()
  const { router } = await openOnComputer()

  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cerrar' }))
  expect(router.state.location.pathname).toBe(VARIETY_PATH)

  await user.click(await screen.findByRole('link', { name: 'Nuevo precio' }))
  await user.type(await screen.findByLabelText(/^Precio de lista/), '12000')
  await user.click(screen.getByRole('button', { name: 'Cerrar' }))
  expect(await screen.findByText('¿Descartás el precio?')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(NEW_PATH)
})

test('on a computer, a save toasts "Precio guardado" once and returns to the variety page', async () => {
  const user = userEvent.setup()
  const { router } = await openOnComputer({ 'POST /varieties/1/prices': () => CREATED.clone() })

  await user.type(screen.getByLabelText(/^Precio de lista/), '12000')
  await user.click(screen.getByRole('button', { name: 'Guardá el precio' }))

  expect(await screen.findByText('Página de la variedad')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(VARIETY_PATH)
  expect(await screen.findAllByText('Precio guardado')).toHaveLength(1)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('on a computer, a click on the dimmed area keeps the form and what was typed, with no confirm', async () => {
  const user = userEvent.setup()
  const { router } = await openOnComputer()

  await user.type(screen.getByLabelText(/^Precio de lista/), '12000')
  await user.click(screen.getByRole('main'))
  await user.keyboard('{Escape}')

  expect(screen.getByLabelText(/^Precio de lista/)).toHaveValue('12000')
  expect(screen.queryByText('¿Descartás el precio?')).not.toBeInTheDocument()
  expect(router.state.location.pathname).toBe(NEW_PATH)
})

test('flipping the viewport keeps what was typed, and "Cerrar" still asks', async () => {
  const user = userEvent.setup()
  await openFromVariety(answers())

  await user.type(await screen.findByLabelText(/^Precio de lista/), '12000')
  act(() => viewport.set('computer'))
  expect(screen.getByLabelText(/^Precio de lista/)).toHaveValue('12000')
  expect(screen.getByRole('dialog', { name: 'Nuevo precio' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Cerrar' }))
  expect(await screen.findByText('¿Descartás el precio?')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'No, seguí cargando' }))

  act(() => viewport.set('phone'))
  expect(screen.getByLabelText(/^Precio de lista/)).toHaveValue('12000')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('on a computer, loading shows the loading state, with no dialog', async () => {
  viewport.set('computer')
  const never = new Promise<Response>(() => undefined)
  renderVarieties([NEW_PATH], (url, init) => (url === '/pricing-settings' ? never : answers()(url, init)))
  expect(await screen.findByRole('progressbar', { name: 'Cargando' })).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('on a computer, a vanished variety says "Eso ya no está." with no dialog', async () => {
  viewport.set('computer')
  renderVarieties([NEW_PATH], answers({ 'GET /varieties/1': () => jsonResponse(404, { code: 'variety.not_found' }) }))

  expect(await screen.findByText('Eso ya no está.')).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('on a computer, a network error says it has no connection, with no dialog', async () => {
  viewport.set('computer')
  renderVarieties([NEW_PATH], (url, init) =>
    url === '/pricing-settings' ? Promise.reject(new TypeError('Failed to fetch')) : answers()(url, init),
  )

  expect(await screen.findByText(/conexión/i)).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
