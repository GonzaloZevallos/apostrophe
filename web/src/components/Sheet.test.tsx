/**
 * `Sheet` at its own seam: Testing Library, no router. One element tree on both viewports
 * (`main > div.cuerpo > children`, then the aside); only the class, the dialog attributes and the
 * computer backdrop listener differ. A phone sheet has no outside, so nothing on it closes it.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef, type ReactNode } from 'react'
import { describe, expect, test, vi } from 'vitest'
import Sheet from './Sheet'

interface Options {
  computer?: boolean
  computerDialog?: boolean
  touched?: boolean
  onClose?: () => void
  initialFocus?: React.RefObject<HTMLElement | null>
  aside?: ReactNode
}

function renderSheet(form: ReactNode, options: Options = {}) {
  const { computer = false, computerDialog = true, touched = false, onClose = () => undefined, initialFocus, aside } = options
  return render(
    <Sheet
      computer={computer}
      computerClass="pantalla cobro-modal"
      computerDialog={computerDialog}
      label="A form"
      touched={touched}
      onClose={onClose}
      initialFocus={initialFocus}
      aside={aside}
    >
      {form}
    </Sheet>,
  )
}

function frame(): HTMLElement {
  const main = document.querySelector('main')
  if (main === null) throw new Error('no main')
  return main
}

describe('the element tree', () => {
  test('is main > div.cuerpo > children, then the aside, on both viewports', () => {
    for (const computer of [true, false]) {
      const { unmount } = renderSheet(<form aria-label="the form" />, { computer, aside: <p>beside</p> })
      const main = frame()
      expect(main.children).toHaveLength(2)
      const [body, aside] = Array.from(main.children)
      expect(body?.tagName).toBe('DIV')
      expect(body).toHaveClass('cuerpo')
      expect(body?.querySelector(':scope > form')).not.toBeNull()
      expect(aside).toHaveTextContent('beside')
      unmount()
    }
  })

  test('on the phone it is the sheet, a modal dialog named by its label', () => {
    renderSheet(<form aria-label="the form" />)
    expect(frame()).toHaveClass('pantalla', 'sheet')
    const dialog = screen.getByRole('dialog', { name: 'A form' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveClass('cuerpo', 'sheet__body')
  })

  test('on the phone the dialog is named by the title the form points at', () => {
    render(
      <Sheet computer={false} computerClass="pantalla" computerDialog={false} titleId="t" touched={false} onClose={() => undefined}>
        <span id="t">The title</span>
      </Sheet>,
    )
    expect(screen.getByRole('dialog', { name: 'The title' })).toBeInTheDocument()
  })

  test('on the computer it takes the host class, and is a dialog only when the host says so', () => {
    const { unmount } = renderSheet(<form aria-label="f" />, { computer: true })
    expect(frame()).toHaveClass('pantalla', 'cobro-modal')
    expect(frame()).not.toHaveClass('sheet')
    expect(screen.getByRole('dialog', { name: 'A form' })).not.toHaveClass('sheet__body')
    unmount()

    renderSheet(<form aria-label="f" />, { computer: true, computerDialog: false })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  test('a flip across 900 px keeps the form mounted and what was typed', async () => {
    const user = userEvent.setup()
    const field = <input aria-label="amount" />
    const { rerender } = renderSheet(field, { computer: true })
    await user.type(screen.getByLabelText('amount'), '123')
    const node = screen.getByLabelText('amount')

    rerender(
      <Sheet computer={false} computerClass="pantalla cobro-modal" computerDialog label="A form" touched={false} onClose={() => undefined}>
        {field}
      </Sheet>,
    )

    expect(screen.getByLabelText('amount')).toBe(node)
    expect(node).toHaveValue('123')
    expect(frame()).toHaveClass('sheet')
  })
})

describe('the computer backdrop', () => {
  test('a click on it closes an untouched dialog', async () => {
    const onClose = vi.fn()
    renderSheet(<form aria-label="f" />, { computer: true, onClose })
    await userEvent.click(frame())
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test('a click on it does nothing when touched', async () => {
    const onClose = vi.fn()
    renderSheet(<form aria-label="f" />, { computer: true, touched: true, onClose })
    await userEvent.click(frame())
    expect(onClose).not.toHaveBeenCalled()
  })

  test('a click inside the dialog is not a click on the backdrop', async () => {
    const onClose = vi.fn()
    renderSheet(<button type="button">inside</button>, { computer: true, onClose })
    await userEvent.click(screen.getByRole('button', { name: 'inside' }))
    expect(onClose).not.toHaveBeenCalled()
  })

  test('it never opens a dialog of its own: nothing but the form is a dialog', async () => {
    renderSheet(<form aria-label="f" />, { computer: true })
    await userEvent.click(frame())
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
  })

  test('the listener follows the live touched value', async () => {
    const onClose = vi.fn()
    const { rerender } = renderSheet(<form aria-label="f" />, { computer: true, touched: false, onClose })
    rerender(
      <Sheet computer computerClass="pantalla cobro-modal" computerDialog label="A form" touched onClose={onClose}>
        <form aria-label="f" />
      </Sheet>,
    )
    await userEvent.click(frame())
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('the phone has no outside', () => {
  test.each([false, true])('a click on the sheet or its top strip never closes it (touched: %s)', async (touched) => {
    const onClose = vi.fn()
    renderSheet(<form aria-label="f" />, { touched, onClose })
    await userEvent.click(frame())
    await userEvent.click(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('focus on the phone', () => {
  test('lands on the first control in DOM order', () => {
    renderSheet(
      <form>
        <span>title</span>
        <input aria-label="first" />
        <input aria-label="second" />
      </form>,
    )
    expect(screen.getByLabelText('first')).toHaveFocus()
  })

  test('looks inside the form: the Close above it does not take focus', () => {
    renderSheet(
      <>
        <button type="button">Close</button>
        <form>
          <input aria-label="first" />
        </form>
      </>,
    )
    expect(screen.getByLabelText('first')).toHaveFocus()
  })

  test('skips what is disabled, hidden, inert, aria-hidden or in a closed details', () => {
    renderSheet(
      <form>
        <input aria-label="disabled" disabled />
        <input aria-label="hidden attribute" hidden />
        <div hidden>
          <input aria-label="in hidden" />
        </div>
        <div style={{ display: 'none' }}>
          <input aria-label="not displayed" />
        </div>
        <div inert>
          <input aria-label="inert" />
        </div>
        <div aria-hidden="true">
          <input aria-label="aria hidden" />
        </div>
        <details>
          <summary>more</summary>
          <input aria-label="closed details" />
        </details>
        <select aria-label="the one">
          <option>a</option>
        </select>
      </form>,
    )
    expect(screen.getByLabelText('the one')).toHaveFocus()
  })

  test('counts a choice group first radio, and a button', () => {
    renderSheet(
      <form>
        <div role="radiogroup" aria-label="how">
          <input type="radio" name="how" aria-label="cash" />
          <input type="radio" name="how" aria-label="transfer" />
        </div>
        <button type="submit">Save</button>
      </form>,
    )
    expect(screen.getByLabelText('cash')).toHaveFocus()
  })

  test('an open details is eligible', () => {
    renderSheet(
      <form>
        <details open>
          <summary>more</summary>
          <input aria-label="open details" />
        </details>
      </form>,
    )
    expect(screen.getByLabelText('open details')).toHaveFocus()
  })

  test('initialFocus wins over the first control', () => {
    const named = createRef<HTMLInputElement>()
    renderSheet(
      <form>
        <input aria-label="first" />
        <input aria-label="named" ref={named} />
      </form>,
      { initialFocus: named },
    )
    expect(screen.getByLabelText('named')).toHaveFocus()
  })

  test('is taken without scrolling', () => {
    const focus = vi.spyOn(HTMLElement.prototype, 'focus')
    renderSheet(<input aria-label="first" />)
    expect(focus).toHaveBeenCalledWith({ preventScroll: true })
    focus.mockRestore()
  })

  test('waits for the first control when the form arrives after the frame, and then leaves focus alone', () => {
    const { rerender } = renderSheet(<p>Loading</p>)
    expect(document.body).toHaveFocus()

    rerender(
      <Sheet computer={false} computerClass="pantalla" computerDialog label="A form" touched={false} onClose={() => undefined}>
        <input aria-label="first" />
        <input aria-label="second" />
      </Sheet>,
    )
    expect(screen.getByLabelText('first')).toHaveFocus()

    screen.getByLabelText('second').focus()
    rerender(
      <Sheet computer={false} computerClass="pantalla" computerDialog label="A form" touched onClose={() => undefined}>
        <input aria-label="first" />
        <input aria-label="second" />
      </Sheet>,
    )
    expect(screen.getByLabelText('second')).toHaveFocus()
  })

  test('is not taken on the computer, where the host decides', () => {
    renderSheet(<input aria-label="first" />, { computer: true })
    expect(document.body).toHaveFocus()
  })

  test('is not taken when a flip to the phone happens after a computer mount', () => {
    const { rerender } = renderSheet(<input aria-label="first" />, { computer: true })
    rerender(
      <Sheet computer={false} computerClass="pantalla" computerDialog label="A form" touched={false} onClose={() => undefined}>
        <input aria-label="first" />
      </Sheet>,
    )
    expect(document.body).toHaveFocus()
  })
})
