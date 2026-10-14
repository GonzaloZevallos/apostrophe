/**
 * The withdrawal form and archived varieties through Testing Library, `fetch` faked at the
 * network (`stock.md`, "Sacar del stock"): a link to an archived variety chooses nothing, a
 * withdrawal keeps its line on a variety archived since, and a save refused with
 * `variety.archived` keeps the form open and everything typed.
 */

import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { VARIETIES as VARIETIES_PATH, WITHDRAWAL_EDIT, WITHDRAWAL_NEW, pathTo, withdrawalNewFor } from '../../routes'
import { jsonResponse, renderWithdrawals, VARIETIES, type FetchImpl } from './renderWithdrawals'

afterEach(() => {
  vi.unstubAllGlobals()
})

const EDIT_ONE = pathTo(WITHDRAWAL_EDIT, { id: 1 })
const GELATO = VARIETIES[1]
const ONLY_GELATO = [GELATO]
const NEW_LINES_VARIETIES = VARIETIES

/** A withdrawal with a line on Zkittlez (1), archived since, and one on Gelato (2), listed. */
function withdrawal(order: 'archived-first' | 'listed-first') {
  const archived = { variety_id: 1, variety_name: 'Zkittlez', grams: 5.5 }
  const listed = { variety_id: 2, variety_name: 'Gelato', grams: 3 }
  return {
    id: 1,
    reason: 'promotion',
    date: '2026-10-02',
    note: null,
    total_grams: 8.5,
    lines: order === 'archived-first' ? [archived, listed] : [listed, archived],
  }
}

function editing(body: unknown, puts: unknown[]): FetchImpl {
  return async (url, init) => {
    if (url === '/stock/withdrawals/1' && init?.method === 'PUT') {
      puts.push(JSON.parse(String(init.body)))
      return jsonResponse(200, body)
    }
    if (url === '/stock/withdrawals/1') return jsonResponse(200, body)
    return jsonResponse(404, {})
  }
}

async function saveEdit(): Promise<void> {
  await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
  await userEvent.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Sí, guardar' }),
  )
}

test('a link to an archived variety opens with no variety chosen and says nothing', async () => {
  renderWithdrawals([withdrawalNewFor(1)], async () => jsonResponse(404, {}), async () =>
    jsonResponse(200, ONLY_GELATO),
  )

  expect(await screen.findByLabelText('Variedad 1')).toHaveValue('')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.queryByText(/ya no está/)).not.toBeInTheDocument()
})

test('a link to an unknown variety opens with no variety chosen and says nothing', async () => {
  renderWithdrawals([withdrawalNewFor(99)], async () => jsonResponse(404, {}))

  expect(await screen.findByLabelText('Variedad 1')).toHaveValue('')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('a list that resolves after the first paint still chooses the listed variety and leaves the form clean', async () => {
  let release: () => void = () => undefined
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const { router } = renderWithdrawals(
    [VARIETIES_PATH, withdrawalNewFor(2)],
    async () => jsonResponse(404, {}),
    async () => {
      await gate
      return jsonResponse(200, VARIETIES)
    },
  )
  expect(screen.queryByLabelText('Variedad 1')).not.toBeInTheDocument()
  release()

  expect(await screen.findByLabelText('Variedad 1')).toHaveValue('2')
  await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))

  await waitFor(() => expect(router.state.location.pathname).toBe(VARIETIES_PATH))
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
})

test('editing a withdrawal whose line is on a variety archived since shows its name and saves it', async () => {
  const puts: unknown[] = []
  renderWithdrawals(
    [EDIT_ONE],
    editing(withdrawal('archived-first'), puts),
    async () => jsonResponse(200, ONLY_GELATO),
  )

  expect(await screen.findByText('Zkittlez')).toBeInTheDocument()
  // the archived line has no picker; the other line's picker offers listed varieties only
  expect(screen.queryByLabelText('Variedad 1')).not.toBeInTheDocument()
  const picker = screen.getByLabelText('Variedad 2')
  expect(within(picker).queryByRole('option', { name: 'Zkittlez' })).not.toBeInTheDocument()
  expect(within(picker).getByRole('option', { name: 'Gelato' })).toBeInTheDocument()
  expect(screen.getByLabelText('Gramos 1')).toHaveValue('5.5')

  await userEvent.clear(screen.getByLabelText('Gramos 1'))
  await userEvent.type(screen.getByLabelText('Gramos 1'), '4,5')
  await saveEdit()

  await waitFor(() => expect(puts).toHaveLength(1))
  expect(puts[0]).toMatchObject({
    lines: [
      { variety_id: 1, grams: '4.5' },
      { variety_id: 2, grams: '3' },
    ],
  })
})

test('removing the listed line first, the archived line keeps its variety and takes the new grams', async () => {
  const puts: unknown[] = []
  renderWithdrawals(
    [EDIT_ONE],
    editing(withdrawal('listed-first'), puts),
    async () => jsonResponse(200, ONLY_GELATO),
  )
  await screen.findByText('Zkittlez')

  await userEvent.click(screen.getByRole('button', { name: 'Quitar variedad 1' }))
  await userEvent.clear(screen.getByLabelText('Gramos 1'))
  await userEvent.type(screen.getByLabelText('Gramos 1'), '9')
  await saveEdit()

  await waitFor(() => expect(puts).toHaveLength(1))
  expect((puts[0] as { lines: unknown }).lines).toEqual([{ variety_id: 1, grams: '9' }])
})

test('with the archived line first, removing the line below keeps the archived line', async () => {
  const puts: unknown[] = []
  renderWithdrawals(
    [EDIT_ONE],
    editing(withdrawal('archived-first'), puts),
    async () => jsonResponse(200, ONLY_GELATO),
  )
  await screen.findByText('Zkittlez')

  await userEvent.click(screen.getByRole('button', { name: 'Quitar variedad 2' }))
  await userEvent.clear(screen.getByLabelText('Gramos 1'))
  await userEvent.type(screen.getByLabelText('Gramos 1'), '7')
  await saveEdit()

  await waitFor(() => expect(puts).toHaveLength(1))
  expect((puts[0] as { lines: unknown }).lines).toEqual([{ variety_id: 1, grams: '7' }])
})

/** A new withdrawal with Zkittlez on line 1, Gelato on line 2, grams and a note typed, whose
 * save is refused as `variety.archived`; the next `GET /varieties` answers `afterwards`. */
async function staleSave(afterwards: () => Promise<Response>, posts: unknown[] = []) {
  let reads = 0
  const view = renderWithdrawals(
    [VARIETIES_PATH, WITHDRAWAL_NEW],
    async (url, init) => {
      if (url === '/stock/withdrawals' && init?.method === 'POST') {
        posts.push(JSON.parse(String(init.body)))
        return jsonResponse(404, { code: 'variety.archived' })
      }
      return jsonResponse(404, {})
    },
    async () => {
      reads += 1
      return reads === 1 ? jsonResponse(200, NEW_LINES_VARIETIES) : afterwards()
    },
  )
  await userEvent.click(await screen.findByRole('button', { name: 'Promoción' }))
  await userEvent.selectOptions(screen.getByLabelText('Variedad 1'), 'Zkittlez')
  await userEvent.type(screen.getByLabelText('Gramos 1'), '2,5')
  await userEvent.click(screen.getByRole('button', { name: 'Agregar otra variedad' }))
  await userEvent.selectOptions(screen.getByLabelText('Variedad 2'), 'Gelato')
  await userEvent.type(screen.getByLabelText('Gramos 2'), '1')
  await userEvent.type(screen.getByLabelText('Nota'), 'secreta')
  await userEvent.click(screen.getByRole('button', { name: 'Guardá el retiro' }))
  return view
}

test('a stale save tells the gone line, stays open and keeps everything typed', async () => {
  const { router } = await staleSave(async () => jsonResponse(200, ONLY_GELATO))

  const first = await screen.findByRole('group', { name: 'Variedad y gramos 1' })
  expect(await within(first).findByText('Eso ya no está.')).toBeInTheDocument()
  expect(within(screen.getByRole('group', { name: 'Variedad y gramos 2' })).queryByText(/ya no está/)).toBeNull()
  expect(router.state.location.pathname).toBe(WITHDRAWAL_NEW)
  expect(screen.getByLabelText('Variedad 1')).toHaveValue('')
  expect(screen.getByLabelText('Gramos 1')).toHaveValue('2,5')
  expect(screen.getByLabelText('Variedad 2')).toHaveValue('2')
  expect(screen.getByLabelText('Gramos 2')).toHaveValue('1')
  expect(screen.getByLabelText('Nota')).toHaveValue('secreta')
  expect(screen.getByRole('button', { name: 'Promoción' })).toHaveAttribute('aria-pressed', 'true')
  // choosing another variety takes the message away
  await userEvent.selectOptions(screen.getByLabelText('Variedad 1'), 'Gelato')
  expect(screen.queryByText('Eso ya no está.')).not.toBeInTheDocument()
})

test('a stale save whose refetch fails says so on the form and keeps everything typed', async () => {
  const { router } = await staleSave(async () => jsonResponse(500, {}))

  expect(await screen.findByRole('alert')).toHaveTextContent('Alguna variedad ya no está: elegí otra')
  expect(router.state.location.pathname).toBe(WITHDRAWAL_NEW)
  expect(screen.getByLabelText('Variedad 1')).toHaveValue('1')
  expect(screen.getByLabelText('Gramos 1')).toHaveValue('2,5')
  expect(screen.getByLabelText('Nota')).toHaveValue('secreta')
})

test('a second tap on save while the refetch is pending sends nothing', async () => {
  let release: () => void = () => undefined
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const posts: unknown[] = []
  await staleSave(async () => {
    await gate
    return jsonResponse(200, ONLY_GELATO)
  }, posts)
  await waitFor(() => expect(posts).toHaveLength(1))

  const submit = screen.getByRole('button', { name: 'Guardá el retiro' })
  await waitFor(() => expect(submit).toBeDisabled())
  await userEvent.click(submit)
  expect(posts).toHaveLength(1)

  release()
  expect(await screen.findByText('Eso ya no está.')).toBeInTheDocument()
  expect(posts).toHaveLength(1)
})
