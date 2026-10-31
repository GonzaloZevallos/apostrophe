/**
 * `ThresholdForm` and the unit's decimals (`units.md`): a threshold finer than the product's
 * unit is turned back before any request, with the sentence of what the unit allows under the
 * field and what was typed kept; a server `quantity.too_many_decimals` shows the same sentence.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'
import ThresholdForm from './ThresholdForm'

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderForm(decimals: number, fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal('fetch', fetchMock)
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <ThresholdForm
        varietyId={1}
        decimals={decimals}
        threshold={null}
        onDone={vi.fn()}
        onCancel={vi.fn()}
        onDirtyChange={vi.fn()}
        onGone={vi.fn()}
      />
    </QueryClientProvider>,
  )
}

describe('ThresholdForm against the unit decimals', () => {
  test.each([
    [0, '1.5', 'Whole units only'],
    [1, '1.25', 'Up to 1 decimal'],
    [2, '2.555', 'Up to 2 decimals'],
  ])('a unit of %i decimals refuses %s with its sentence and sends nothing', async (decimals, typed, sentence) => {
    const fetchMock = vi.fn()
    renderForm(decimals, fetchMock)
    const field = screen.getByRole('textbox')
    await userEvent.type(field, typed)
    await userEvent.click(screen.getByRole('button', { name: /save|guarda/i }))
    expect(screen.getByRole('alert')).toHaveTextContent(sentence)
    expect(field).toHaveValue(typed)
    expect(field).toBeInvalid()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('a server too-many-decimals answer shows the same sentence and keeps what was typed', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: 'quantity.too_many_decimals', detail: 'diagnostic' }), {
        status: 422,
        headers: { 'content-type': 'application/json' },
      }),
    )
    renderForm(1, fetchMock)
    const field = screen.getByRole('textbox')
    await userEvent.type(field, '1,5')
    await userEvent.click(screen.getByRole('button', { name: /save|guarda/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Up to 1 decimal')
    expect(field).toHaveValue('1,5')
  })
})
