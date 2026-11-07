/**
 * The Selector's list as a history entry (ADR-0027): back and Close close only the list, one
 * open issues one `close()`, and the level comes from `SheetLevel`, never from a prop.
 */

import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { flipViewport, stubViewport } from '../test-viewport'
import { Controlled, numbered, renderForm, submitSpy } from './selectorTestKit'
import { SheetLevel, useSheet } from './useSheetStack'

beforeEach(() => {
  stubViewport('phone')
  submitSpy.mockReset()
})
afterEach(() => vi.unstubAllGlobals())

const base = { loading: false, required: true as const, emptySetMessage: 'Nothing yet.' }

function fieldOf(label: string) {
  return screen.getByRole('button', { name: new RegExp(`^${label}`) })
}

function formIsRendered() {
  expect(screen.getByRole('heading', { name: 'The form' })).toBeInTheDocument()
}

describe('back and Close over a form at depth 0', () => {
  test('Close pops exactly the list entry', async () => {
    const user = userEvent.setup()
    const { depth } = renderForm(<Controlled {...base} label="Category" options={numbered(3)} />)
    await user.click(fieldOf('Category'))
    expect(depth()).toBe(1)
    await user.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(depth()).toBe(0))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    formIsRendered()
  })

  test('the system back closes the list and leaves the form, with focus on the field', async () => {
    const user = userEvent.setup()
    const { depth, router } = renderForm(<Controlled {...base} label="Category" options={numbered(3)} />)
    await user.click(fieldOf('Category'))
    await act(async () => {
      await router.navigate(-1)
    })
    expect(depth()).toBe(0)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    formIsRendered()
    expect(fieldOf('Category')).toHaveFocus()
  })

  test('Escape closes the list and focus returns to the field', async () => {
    const user = userEvent.setup()
    const { depth } = renderForm(<Controlled {...base} label="Category" options={numbered(3)} />)
    await user.click(fieldOf('Category'))
    await user.keyboard('{Escape}')
    await waitFor(() => expect(depth()).toBe(0))
    expect(fieldOf('Category')).toHaveFocus()
  })
})

describe('a Selector inside a sheet (SheetLevel 1)', () => {
  function HostSheet() {
    const one = useSheet(1)
    return (
      <>
        <button type="button" onClick={one.open}>
          Open host sheet
        </button>
        {one.isOpen && (
          <SheetLevel.Provider value={1}>
            <section aria-label="Host sheet">
              <Controlled {...base} label="Reason" options={numbered(3)} />
            </section>
          </SheetLevel.Provider>
        )}
      </>
    )
  }

  test('Close and back pop only the list; the sheet under it stays', async () => {
    const user = userEvent.setup()
    const { depth, router } = renderForm(<HostSheet />)
    await user.click(screen.getByRole('button', { name: 'Open host sheet' }))
    expect(depth()).toBe(1)
    await user.click(fieldOf('Reason'))
    expect(depth()).toBe(2)
    await user.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(depth()).toBe(1))
    expect(screen.getByRole('region', { name: 'Host sheet' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await user.click(fieldOf('Reason'))
    expect(depth()).toBe(2)
    await act(async () => {
      await router.navigate(-1)
    })
    expect(depth()).toBe(1)
    expect(screen.getByRole('region', { name: 'Host sheet' })).toBeInTheDocument()
    formIsRendered()
  })
})

describe('one close per open', () => {
  test('a double click on rows without awaiting calls onChange once and pops once', async () => {
    const user = userEvent.setup()
    const onPick = vi.fn()
    const { depth } = renderForm(<Controlled {...base} label="Category" options={numbered(3)} onPick={onPick} />)
    await user.click(fieldOf('Category'))
    const row = screen.getByRole('button', { name: 'Option 2' })
    fireEvent.click(row)
    fireEvent.click(row)
    await waitFor(() => expect(depth()).toBe(0))
    expect(onPick).toHaveBeenCalledTimes(1)
    formIsRendered()
  })

  test('a pick followed at once by Close pops once', async () => {
    const user = userEvent.setup()
    const onPick = vi.fn()
    const { depth } = renderForm(<Controlled {...base} label="Category" options={numbered(3)} onPick={onPick} />)
    await user.click(fieldOf('Category'))
    const row = screen.getByRole('button', { name: 'Option 2' })
    const close = screen.getByRole('button', { name: 'Close' })
    act(() => {
      fireEvent.click(row)
      fireEvent.click(close)
    })
    await waitFor(() => expect(depth()).toBe(0))
    expect(onPick).toHaveBeenCalledTimes(1)
    formIsRendered()
  })

  test('a second tap on the field while the entry is arriving pushes once', async () => {
    const { depth } = renderForm(<Controlled {...base} label="Category" options={numbered(3)} />)
    fireEvent.click(fieldOf('Category'))
    fireEvent.click(fieldOf('Category'))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    expect(depth()).toBe(1)
  })
})

describe('two Selectors on one form', () => {
  test('opening A draws only A list; B shows none and does not take focus on close', async () => {
    const user = userEvent.setup()
    const { depth } = renderForm(
      <>
        <Controlled {...base} label="Alpha" options={numbered(3)} />
        <Controlled {...base} label="Beta" options={numbered(4)} />
      </>,
    )
    await user.click(fieldOf('Alpha'))
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(screen.getByRole('dialog', { name: 'Alpha options' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Beta options' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(depth()).toBe(0))
    expect(fieldOf('Alpha')).toHaveFocus()
  })
})

describe('resize with the list open', () => {
  test('phone to computer closes the list once and ends at the form depth', async () => {
    const user = userEvent.setup()
    const { depth } = renderForm(<Controlled {...base} label="Category" options={numbered(3)} />)
    await user.click(fieldOf('Category'))
    expect(depth()).toBe(1)
    flipViewport('computer')
    await waitFor(() => expect(depth()).toBe(0))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(fieldOf('Category')).toHaveFocus()
    formIsRendered()
  })

  test('computer to phone closes the dropdown and never touches the stack', async () => {
    stubViewport('computer')
    const user = userEvent.setup()
    const { depth } = renderForm(<Controlled {...base} label="Category" options={numbered(3)} />)
    await user.click(fieldOf('Category'))
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    flipViewport('phone')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(depth()).toBe(0)
    expect(fieldOf('Category')).toHaveFocus()
  })
})

describe('a host that remounts the Selector with its list open', () => {
  test('draws no list, and the two backs reach the form and then the earlier route', async () => {
    const user = userEvent.setup()
    let remount: () => void = () => undefined
    function Remounting() {
      const [key, setKey] = useState(0)
      remount = () => setKey((current) => current + 1)
      return <Controlled key={key} {...base} label="Category" options={numbered(3)} />
    }
    const { depth, router } = renderForm(<Remounting />)
    await user.click(fieldOf('Category'))
    expect(depth()).toBe(1)
    act(() => remount())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await act(async () => {
      await router.navigate(-1)
    })
    expect(depth()).toBe(0)
    formIsRendered()
    await act(async () => {
      await router.navigate(-1)
    })
    expect(screen.getByRole('heading', { name: 'Before the form' })).toBeInTheDocument()
  })
})

describe('the level a list takes', () => {
  function Probe() {
    return <output aria-label="level 2">{String(useSheet(2).isOpen)}</output>
  }

  function Sheeted() {
    const one = useSheet(1)
    return (
      <>
        <button type="button" onClick={one.open}>
          Open host sheet
        </button>
        {one.isOpen && (
          <SheetLevel.Provider value={1}>
            <Controlled {...base} label="Category" options={numbered(3)} />
            <Probe />
          </SheetLevel.Provider>
        )}
      </>
    )
  }

  test('a sibling sheet on the same level reads as open while the list is open (the known limit)', async () => {
    const user = userEvent.setup()
    renderForm(<Sheeted />)
    await user.click(screen.getByRole('button', { name: 'Open host sheet' }))
    expect(screen.getByLabelText('level 2')).toHaveTextContent('false')
    await user.click(fieldOf('Category'))
    expect(screen.getByLabelText('level 2')).toHaveTextContent('true')
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })
})
