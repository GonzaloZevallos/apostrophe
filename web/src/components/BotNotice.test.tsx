/**
 * `BotNotice` (plan C, "BotNotice component (Testing Library, fetch faked)"): fixed copy,
 * a button to Catálogo, and a dismissal that posts once and hands control back to
 * the parent, with no toast of its own.
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import BotNotice from './BotNotice'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderNotice(onDismissed: () => void = () => undefined) {
  return render(
    <MemoryRouter>
      <BotNotice onDismissed={onDismissed} />
    </MemoryRouter>,
  )
}

test('shows its fixed copy and a button that opens Catálogo', () => {
  renderNotice()

  expect(
    screen.getByText('Conectá el bot para publicar tu catálogo en Telegram.'),
  ).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Conectar el bot' })).toHaveAttribute('href', '/catalogo')
  expect(screen.getByRole('button', { name: 'No mostrar más' })).toBeInTheDocument()
})

test('dismissing posts once to the dismissal route, then calls onDismissed, with no toast', async () => {
  vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }))
  const onDismissed = vi.fn()
  renderNotice(onDismissed)

  await userEvent.click(screen.getByRole('button', { name: 'No mostrar más' }))

  await waitFor(() => expect(onDismissed).toHaveBeenCalledTimes(1))
  expect(fetch).toHaveBeenCalledTimes(1)
  const [path, init] = vi.mocked(fetch).mock.calls[0] ?? []
  expect(path).toBe('/panel/bot-notice/dismissal')
  expect(init?.method).toBe('POST')
  expect(screen.queryByRole('status')).toBeNull()
})

test('a second tap while the first is in flight posts nothing more', async () => {
  let release: (r: Response) => void = () => undefined
  vi.mocked(fetch).mockReturnValue(new Promise<Response>((resolve) => (release = resolve)))
  const onDismissed = vi.fn()
  renderNotice(onDismissed)

  const button = screen.getByRole('button', { name: 'No mostrar más' })
  await userEvent.click(button)
  await userEvent.click(button)
  release(new Response(null, { status: 204 }))

  await waitFor(() => expect(onDismissed).toHaveBeenCalledTimes(1))
  expect(fetch).toHaveBeenCalledTimes(1)
})

test('a failed dismissal leaves the notice and tells the parent nothing', async () => {
  vi.mocked(fetch).mockRejectedValue(new TypeError('failed'))
  const onDismissed = vi.fn()
  renderNotice(onDismissed)

  await userEvent.click(screen.getByRole('button', { name: 'No mostrar más' }))

  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  expect(onDismissed).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'No mostrar más' })).toBeEnabled()
})
