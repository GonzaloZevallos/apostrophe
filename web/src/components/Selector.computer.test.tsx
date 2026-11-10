/**
 * The Selector on a computer (>= 900 px): an inline dropdown driven by the keyboard that never
 * touches the sheet stack. Also the phone list's frame following the visual viewport.
 */

import { act, fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { stubViewport } from '../test-viewport'
import { Controlled } from './SelectorTestHost'
import { numbered, renderForm, submitSpy } from './selectorTestKit'

beforeEach(() => {
  stubViewport('computer')
  submitSpy.mockReset()
})
afterEach(() => {
  vi.unstubAllGlobals()
  Reflect.deleteProperty(window, 'visualViewport')
})

const SCROLL_CLASS = 'selector-lista__filas'

const base = { label: 'Category', loading: false, emptySetMessage: 'Nothing yet.' }

function field() {
  return screen.getByRole('button', { name: /^Category/ })
}

describe('the dropdown', () => {
  test('opens as a listbox named by its field without touching the stack, and a click picks', async () => {
    const user = userEvent.setup()
    const onPick = vi.fn()
    const { depth } = renderForm(<Controlled {...base} required options={numbered(4)} onPick={onPick} />)
    expect(field()).toHaveAttribute('aria-haspopup', 'listbox')
    await user.click(field())
    expect(field()).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('listbox', { name: 'Category options' })).toBeInTheDocument()
    expect(depth()).toBe(0)
    await user.click(screen.getByRole('option', { name: 'Option 3' }))
    expect(onPick).toHaveBeenCalledExactlyOnceWith('v3')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(field()).toHaveTextContent('Option 3')
    expect(field()).toHaveFocus()
    expect(depth()).toBe(0)
  })

  test('arrows move the active row, Enter picks it and submits nothing', async () => {
    const user = userEvent.setup()
    const onPick = vi.fn()
    renderForm(<Controlled {...base} required options={numbered(4)} onPick={onPick} />)
    await user.click(field())
    const list = screen.getByRole('listbox')
    expect(list).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'Option 1' }).id)
    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(list).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'Option 3' }).id)
    await user.keyboard('{ArrowUp}')
    expect(list).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'Option 2' }).id)
    await user.keyboard('{Enter}')
    expect(onPick).toHaveBeenCalledExactlyOnceWith('v2')
    expect(submitSpy).not.toHaveBeenCalled()
    expect(field()).toHaveFocus()
  })

  test('the arrow keys open it from the field, with the active row on the current option', async () => {
    const user = userEvent.setup()
    renderForm(<Controlled {...base} required initial="v3" options={numbered(4)} />)
    field().focus()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('listbox')).toHaveAttribute(
      'aria-activedescendant',
      screen.getByRole('option', { name: 'Option 3 Selected' }).id,
    )
  })

  test('Escape closes the dropdown only: no document or window keydown listener receives it', async () => {
    const user = userEvent.setup()
    const onDocument = vi.fn()
    const onWindow = vi.fn()
    document.addEventListener('keydown', onDocument)
    window.addEventListener('keydown', onWindow)
    renderForm(<Controlled {...base} required options={numbered(4)} />)
    await user.click(field())
    onDocument.mockClear()
    onWindow.mockClear()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(field()).toHaveFocus()
    expect(onDocument).not.toHaveBeenCalled()
    expect(onWindow).not.toHaveBeenCalled()
    document.removeEventListener('keydown', onDocument)
    window.removeEventListener('keydown', onWindow)
  })

  test('Tab leaves the dropdown, closing it', async () => {
    const user = userEvent.setup()
    renderForm(
      <>
        <Controlled {...base} required options={numbered(4)} />
        <input aria-label="Next field" />
      </>,
    )
    await user.click(field())
    await user.tab()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Next field' })).toHaveFocus()
  })

  test('a press outside closes it without moving focus back', async () => {
    const user = userEvent.setup()
    renderForm(
      <>
        <Controlled {...base} required options={numbered(4)} />
        <input aria-label="Next field" />
      </>,
    )
    await user.click(field())
    await user.click(screen.getByRole('textbox', { name: 'Next field' }))
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Next field' })).toHaveFocus()
  })

  test('Enter on the field and a pick submit nothing', async () => {
    const user = userEvent.setup()
    renderForm(<Controlled {...base} required options={numbered(4)} />)
    field().focus()
    await user.keyboard('{Enter}')
    await user.click(screen.getByRole('option', { name: 'Option 1' }))
    expect(submitSpy).not.toHaveBeenCalled()
  })

  test('goes up when the room below the field is smaller than its height', async () => {
    const style = document.createElement('style')
    style.textContent = '.selector-desplegable { max-height: 300px; }'
    document.head.append(style)
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 500 })
    const user = userEvent.setup()
    renderForm(<Controlled {...base} required options={numbered(4)} />)
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ bottom: 400 } as DOMRect)
    await user.click(field())
    const box = screen.getByRole('listbox').parentElement
    expect(box?.className).toContain('selector-desplegable--arriba')
    style.remove()
    vi.restoreAllMocks()
  })
})

describe('search in the dropdown', () => {
  test('behaves as on the phone: above 8 only, folds accents, No results, Enter picks the first match', async () => {
    const user = userEvent.setup()
    const onPick = vi.fn()
    const options = [...numbered(9), { value: 'n', label: 'Piña' }]
    renderForm(<Controlled {...base} required options={options} onPick={onPick} />)
    await user.click(field())
    const search = screen.getByRole('searchbox', { name: 'Search' })
    expect(search).toHaveFocus()
    await user.type(search, 'PINA')
    expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(1)
    await user.keyboard('{Enter}')
    expect(onPick).toHaveBeenCalledExactlyOnceWith('n')
    expect(submitSpy).not.toHaveBeenCalled()
    await user.click(field())
    expect(screen.getByRole('searchbox')).toHaveValue('')
    await user.type(screen.getByRole('searchbox'), 'zzz')
    expect(screen.getByText('No results')).toBeInTheDocument()
  })

  test('typing sends the active row back to the first visible one', async () => {
    const user = userEvent.setup()
    const options = [...numbered(9), { value: 'x', label: 'Option X' }]
    renderForm(<Controlled {...base} required options={options} />)
    await user.click(field())
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}')
    const search = screen.getByRole('searchbox')
    expect(search).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'Option 4' }).id)
    await user.type(search, 'option')
    expect(search).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'Option 1' }).id)
  })

  test('no search at 8 options; the empty set shows its message', async () => {
    const user = userEvent.setup()
    const { unmount } = renderForm(<Controlled {...base} required options={numbered(8)} />)
    await user.click(field())
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
    unmount()
    renderForm(<Controlled {...base} emptyWording="No type" options={[]} />)
    await user.click(field())
    expect(screen.getByText('Nothing yet.')).toBeInTheDocument()
    expect(screen.queryByRole('option')).not.toBeInTheDocument()
  })

  test('an optional field has its clearing row only with a choice; the active row follows the items', async () => {
    const user = userEvent.setup()
    const onPick = vi.fn()
    const { unmount } = renderForm(<Controlled {...base} emptyWording="No type" options={numbered(3)} onPick={onPick} />)
    await user.click(field())
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['Option 1', 'Option 2', 'Option 3'])
    expect(screen.getByRole('listbox')).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'Option 1' }).id)
    await user.keyboard('{ArrowDown}{Enter}')
    expect(onPick).toHaveBeenCalledExactlyOnceWith('v2')
    unmount()
    renderForm(<Controlled {...base} emptyWording="No type" initial="v2" options={numbered(3)} onPick={onPick} />)
    await user.click(field())
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['No type', 'Option 1', 'Option 2 Selected', 'Option 3'])
    expect(screen.getByRole('listbox')).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: /Option 2/ }).id)
    await user.keyboard('{ArrowUp}{ArrowUp}{Enter}')
    expect(onPick).toHaveBeenLastCalledWith(null)
  })
})

describe('loading', () => {
  test('turning true while the dropdown is open closes it and focus goes to the wrapper', async () => {
    const user = userEvent.setup()
    function Switching() {
      const [loading, setLoading] = useState(false)
      return (
        <>
          <button type="button" onClick={() => setLoading(true)}>
            Start loading
          </button>
          <Controlled {...base} loading={loading} required options={numbered(4)} />
        </>
      )
    }
    renderForm(<Switching />)
    await user.click(field())
    fireEvent.click(screen.getByRole('button', { name: 'Start loading' }))
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Category' })).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Category' })).toBeDisabled()
  })
})

describe('the phone list follows the visual viewport', () => {
  class FakeVisualViewport extends EventTarget {
    offsetTop = 0
    height = 700
    scale = 1
  }

  test('the frame carries --vv-alto of the mocked height and updates on resize', async () => {
    stubViewport('phone')
    const fake = new FakeVisualViewport()
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: fake })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 700 })
    const user = userEvent.setup()
    renderForm(<Controlled {...base} required options={numbered(20)} />)
    await user.click(field())
    const frame = screen.getByRole('dialog').parentElement
    expect(frame?.style.getPropertyValue('--vv-alto')).toBe('700px')
    fake.height = 420
    act(() => {
      fake.dispatchEvent(new Event('resize'))
    })
    expect(frame?.style.getPropertyValue('--vv-alto')).toBe('420px')
    const dialog = screen.getByRole('dialog')
    const rowsContainer = within(dialog).getByRole('group')
    expect(rowsContainer.className).toContain(SCROLL_CLASS)
    // Only that element scrolls: not the dialog, the header, the search field nor any row.
    const carriers = [dialog, ...Array.from(dialog.getElementsByTagName('*'))].filter((element) =>
      element.classList.contains(SCROLL_CLASS),
    )
    expect(carriers).toEqual([rowsContainer])
    expect(within(dialog).getByRole('searchbox')).not.toBe(rowsContainer)
    expect(rowsContainer).toContainElement(within(dialog).getByRole('button', { name: 'Option 5' }))
    expect(rowsContainer).not.toContainElement(within(dialog).getByRole('searchbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
  })
})

describe('the optional props on a computer', () => {
  test('accessibleName names the field and the listbox, and the placeholder shows in the empty field', async () => {
    const user = userEvent.setup()
    renderForm(<Controlled {...base} required options={numbered(4)} accessibleName="Line 1 item" placeholder="Pick one" />)
    const named = screen.getByRole('button', { name: /^Line 1 item/ })
    expect(named).toHaveTextContent('Pick one')
    await user.click(named)
    expect(screen.getByRole('listbox', { name: 'Line 1 item options' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Pick one' })).not.toBeInTheDocument()
  })
})
