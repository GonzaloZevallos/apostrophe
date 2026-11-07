/**
 * The Selector on a phone, through what the user sees: the field, the list in the Sheet frame,
 * its rows, search, clearing row, empty set, the `selected` mark and loading.
 */

import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { stubViewport } from '../test-viewport'
import { Controlled, numbered, paymentMethodOptions, renderForm, submitSpy } from './selectorTestKit'

beforeEach(() => {
  stubViewport('phone')
  submitSpy.mockReset()
})
afterEach(() => vi.unstubAllGlobals())

const base = {
  label: 'Category',
  loading: false,
  emptySetMessage: 'No categories yet. Add them in Settings → Expense categories.',
}

function field() {
  return screen.getByRole('button', { name: /^Category/ })
}

function rowTexts(): (string | null)[] {
  return within(screen.getByRole('dialog'))
    .getAllByRole('button')
    .map((button) => button.textContent)
}

describe('picking', () => {
  test('takes exactly 2 taps with 20 options', async () => {
    const user = userEvent.setup()
    const onPick = vi.fn()
    renderForm(<Controlled {...base} required options={numbered(20)} onPick={onPick} />)
    await user.click(field())
    expect(screen.getByRole('dialog', { name: 'Category options' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Option 14' }))
    expect(onPick).toHaveBeenCalledExactlyOnceWith('v14')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(field()).toHaveTextContent('Option 14')
  })

  test('the current option carries a check and the word Selected, the others do not', async () => {
    const user = userEvent.setup()
    renderForm(<Controlled {...base} required options={numbered(3)} initial="v2" />)
    await user.click(field())
    expect(screen.getByRole('button', { name: 'Option 2 Selected' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Option 1' })).toBeInTheDocument()
    expect(screen.getAllByText('Selected')).toHaveLength(1)
  })

  test('keeps the caller order, and a glyph is drawn before the name but hidden', async () => {
    const user = userEvent.setup()
    renderForm(<Controlled {...base} required options={[...paymentMethodOptions()].reverse()} />)
    await user.click(field())
    expect(rowTexts()).toEqual(['', 'Owing', 'Paid', '$Payment method'])
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Payment method' })).toBeInTheDocument()
  })

  test('focus returns to the field after a pick and after Close', async () => {
    const user = userEvent.setup()
    renderForm(<Controlled {...base} required options={numbered(3)} />)
    await user.click(field())
    await user.click(screen.getByRole('button', { name: 'Option 1' }))
    expect(field()).toHaveFocus()
    await user.click(field())
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(field()).toHaveFocus()
  })

  test('the list takes focus on the current option, or on the first row', async () => {
    const user = userEvent.setup()
    const { unmount } = renderForm(<Controlled {...base} required options={numbered(3)} initial="v2" />)
    await user.click(field())
    expect(screen.getByRole('button', { name: 'Option 2 Selected' })).toHaveFocus()
    unmount()
    renderForm(<Controlled {...base} emptyWording="No type" options={numbered(3)} />)
    await user.click(field())
    expect(screen.getByRole('button', { name: 'No type' })).toHaveFocus()
  })
})

describe('search', () => {
  test('is absent with 8 options and present with 9, with the phone search keyboard', async () => {
    const user = userEvent.setup()
    const { unmount } = renderForm(<Controlled {...base} required options={numbered(8)} />)
    await user.click(field())
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
    unmount()
    renderForm(<Controlled {...base} required options={numbered(9)} />)
    await user.click(field())
    const search = screen.getByRole('searchbox', { name: 'Search' })
    expect(search).toHaveAttribute('type', 'search')
    expect(search).toHaveAttribute('inputmode', 'search')
    expect(search).toHaveAttribute('autocomplete', 'off')
    expect(search).toHaveAttribute('enterkeyhint', 'search')
    expect(search).toHaveFocus()
  })

  test('ignores case and accents, matches the name only and keeps the order', async () => {
    const user = userEvent.setup()
    const options = [
      ...numbered(9).map((option) => ({ ...option, label: `Fila ${option.value}` })),
      { value: 'n', label: 'Piña', glyph: 'zzz' },
      { value: 'u', label: 'PINGÜINO' },
    ]
    renderForm(<Controlled {...base} required options={options} />)
    await user.click(field())
    await user.type(screen.getByRole('searchbox'), 'PIN')
    expect(rowTexts()).toEqual(['', 'zzzPiña', 'PINGÜINO'])
    await user.clear(screen.getByRole('searchbox'))
    await user.type(screen.getByRole('searchbox'), 'pingui')
    expect(rowTexts()).toEqual(['', 'PINGÜINO'])
    await user.clear(screen.getByRole('searchbox'))
    await user.type(screen.getByRole('searchbox'), 'pina')
    expect(rowTexts()).toEqual(['', 'zzzPiña'])
    await user.clear(screen.getByRole('searchbox'))
    await user.type(screen.getByRole('searchbox'), 'zzz')
    expect(screen.getByText('No results')).toBeInTheDocument()
    expect(rowTexts()).toEqual([''])
  })

  test('the clearing row is never filtered and No results shows below it', async () => {
    const user = userEvent.setup()
    renderForm(<Controlled {...base} emptyWording="No type" options={numbered(9)} />)
    await user.click(field())
    await user.type(screen.getByRole('searchbox'), 'qqq')
    expect(screen.getByRole('button', { name: 'No type' })).toBeInTheDocument()
    expect(screen.getByText('No results')).toBeInTheDocument()
  })

  test('starts empty every time the list opens', async () => {
    const user = userEvent.setup()
    renderForm(<Controlled {...base} required options={numbered(9)} />)
    await user.click(field())
    await user.type(screen.getByRole('searchbox'), 'Option 3')
    expect(rowTexts()).toEqual(['', 'Option 3'])
    await user.click(screen.getByRole('button', { name: 'Close' }))
    await user.click(field())
    expect(screen.getByRole('searchbox')).toHaveValue('')
    expect(rowTexts()).toHaveLength(10)
  })

  test('Enter in the search field submits nothing and keeps focus inside the dialog', async () => {
    const user = userEvent.setup()
    renderForm(<Controlled {...base} required options={numbered(9)} />)
    await user.click(field())
    await user.keyboard('{Enter}')
    expect(submitSpy).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement)
    expect(document.activeElement).not.toBe(screen.getByRole('searchbox'))
  })

  test('the options dropping from 9 to 8 clear the query and move focus to the first row', async () => {
    const user = userEvent.setup()
    let setCount: (count: number) => void = () => undefined
    function Shrinking() {
      const [count, set] = useState(9)
      setCount = set
      return <Controlled {...base} required options={numbered(count)} />
    }
    renderForm(<Shrinking />)
    await user.click(field())
    await user.type(screen.getByRole('searchbox'), 'Option 1')
    act(() => setCount(8))
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
    expect(rowTexts()).toHaveLength(9)
    expect(screen.getByRole('button', { name: 'Option 1' })).toHaveFocus()
  })

  test('the current option removed while the list is open leaves the list without its row', async () => {
    const user = userEvent.setup()
    let setOptions: (count: number) => void = () => undefined
    function Changing() {
      const [count, set] = useState(3)
      setOptions = set
      return <Controlled {...base} required initial="v3" options={numbered(count)} />
    }
    renderForm(<Changing />)
    await user.click(field())
    act(() => setOptions(2))
    expect(screen.queryByRole('button', { name: /Option 3/ })).not.toBeInTheDocument()
    expect(field()).toHaveTextContent('no longer available')
  })
})

describe('clearing row and empty set', () => {
  test('an optional field has a clearing row first that clears the choice; a required one has none', async () => {
    const user = userEvent.setup()
    const onPick = vi.fn()
    const { unmount } = renderForm(
      <Controlled {...base} emptyWording="No type" initial="v2" options={numbered(3)} onPick={onPick} />,
    )
    await user.click(field())
    expect(rowTexts()).toEqual(['', 'No type', 'Option 1', 'Option 2 Selected', 'Option 3'])
    await user.click(screen.getByRole('button', { name: 'No type' }))
    expect(onPick).toHaveBeenCalledExactlyOnceWith(null)
    expect(field()).toHaveTextContent('No type')
    unmount()
    renderForm(<Controlled {...base} required options={numbered(3)} />)
    await user.click(field())
    expect(screen.queryByRole('button', { name: 'No type' })).not.toBeInTheDocument()
    expect(rowTexts()).toHaveLength(4)
  })

  test('an empty set shows its message as plain text, alone when nothing is set', async () => {
    const user = userEvent.setup()
    renderForm(<Controlled {...base} required options={[]} />)
    await user.click(field())
    expect(screen.getByText(base.emptySetMessage)).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(rowTexts()).toEqual([''])
  })

  test('an optional field with a choice set shows the clearing row above the message', async () => {
    const user = userEvent.setup()
    renderForm(
      <Controlled {...base} emptyWording="No type" initial="gone" selected={{ value: 'gone', label: 'Old' }} options={[]} />,
    )
    await user.click(field())
    const dialog = screen.getByRole('dialog')
    const clear = within(dialog).getByRole('button', { name: 'No type' })
    const message = within(dialog).getByText(base.emptySetMessage)
    expect(clear.compareDocumentPosition(message) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})

describe('the field', () => {
  test('a selected choice outside the options shows its name with the mark and is not offered', async () => {
    const user = userEvent.setup()
    renderForm(
      <Controlled {...base} required initial="gone" selected={{ value: 'gone', label: 'Old category' }} options={numbered(3)} />,
    )
    expect(field()).toHaveTextContent('Old category')
    expect(field()).toHaveTextContent('no longer available')
    await user.click(field())
    expect(within(screen.getByRole('dialog')).queryByText('Old category')).not.toBeInTheDocument()
  })

  test('a value in neither list shows the mark with no name, even with another selected given', () => {
    renderForm(
      <Controlled {...base} required initial="ghost" selected={{ value: 'other', label: 'Other name' }} options={numbered(3)} />,
    )
    expect(field()).toHaveTextContent('no longer available')
    expect(field()).not.toHaveTextContent('Other name')
  })

  test('a null value with selected given shows the empty wording and no mark', () => {
    renderForm(
      <Controlled {...base} emptyWording="No type" selected={{ value: 'gone', label: 'Old' }} options={numbered(3)} />,
    )
    expect(field()).toHaveTextContent('No type')
    expect(field()).not.toHaveTextContent('no longer available')
    expect(field()).not.toHaveTextContent('Old')
  })

  test('loading is busy, disabled, shows no wording and cannot open', async () => {
    const user = userEvent.setup()
    renderForm(<Controlled {...base} loading emptyWording="No type" initial="v1" options={numbered(3)} />)
    const loading = screen.getByRole('button', { name: 'Category' })
    expect(loading).toBeDisabled()
    expect(loading).toHaveAttribute('aria-busy', 'true')
    expect(loading.textContent).toBe('')
    expect(loading).not.toHaveTextContent(/\d/)
    await user.click(loading)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  test('loading turning true while the list is open closes it and focus goes to the wrapper', async () => {
    const user = userEvent.setup()
    let setLoading: (loading: boolean) => void = () => undefined
    function Switching() {
      const [loading, set] = useState(false)
      setLoading = set
      return <Controlled {...base} loading={loading} required options={numbered(3)} />
    }
    const { depth } = renderForm(<Switching />)
    await user.click(field())
    expect(depth()).toBe(1)
    act(() => setLoading(true))
    await vi.waitFor(() => expect(depth()).toBe(0))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Category' })).toHaveFocus()
  })
})

test('a row click and Enter on the field never submit the form', async () => {
  const user = userEvent.setup()
  renderForm(<Controlled {...base} required options={numbered(3)} />)
  field().focus()
  await user.keyboard('{Enter}')
  await user.click(screen.getByRole('button', { name: 'Option 1' }))
  expect(submitSpy).not.toHaveBeenCalled()
})
