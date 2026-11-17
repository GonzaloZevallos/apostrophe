/**
 * The Selector's `locked` state (`docs/product/selector.md`, "Bloqueado"): the value shows in the
 * normal text token, the reason is a visible line that describes the field, the list never opens
 * (no history entry), there is no skeleton, and unlocking keeps the value. `locked` without
 * `lockedReason` does not compile: a plain `tsc` run is that test, as in `Boton.types.test.tsx`.
 */

import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { flipViewport, stubViewport } from '../test-viewport'
import Selector, { type SelectorOption, type SelectorProps } from './Selector'
import { numbered, renderForm } from './selectorTestKit'

beforeEach(() => stubViewport('phone'))
afterEach(() => vi.unstubAllGlobals())

const REASON = 'The + and the code set the country'

function Host({ startsLocked = true, initial = 'v2' }: { startsLocked?: boolean; initial?: string }) {
  const [locked, setLocked] = useState(startsLocked)
  const [value, setValue] = useState<string | null>(initial)
  const shared = {
    label: 'Phone country',
    value,
    onChange: setValue,
    required: true as const,
    loading: false,
    options: numbered(3),
    emptySetMessage: 'Nothing yet.',
  }
  return (
    <>
      <button type="button" onClick={() => setLocked((now) => !now)}>
        Toggle lock
      </button>
      {locked ? <Selector {...shared} locked lockedReason={REASON} /> : <Selector {...shared} />}
    </>
  )
}

function field() {
  return screen.getByRole('button', { name: /^Phone country/ })
}

describe('what a locked field shows', () => {
  test('the value in the normal text token, the field as aria-disabled and not skeleton', () => {
    renderForm(<Host />)
    expect(field()).toHaveAttribute('aria-disabled', 'true')
    expect(field()).not.toBeDisabled()
    expect(field()).not.toHaveAttribute('aria-busy')
    expect(field()).toHaveTextContent('Option 2')
    expect(screen.getByRole('main')).not.toHaveAttribute('aria-busy')
  })

  test('a visible reason line describes the field', () => {
    renderForm(<Host />)
    const reason = screen.getByText(REASON)
    expect(reason).toBeVisible()
    expect(reason.id).not.toBe('')
    expect(field()).toHaveAccessibleDescription(REASON)
    expect(field().getAttribute('aria-describedby')).toContain(reason.id)
  })

  test('the reason joins the description the screen already passed', () => {
    renderForm(
      <>
        <p id="refusal">Pick again.</p>
        <Selector
          label="Phone country"
          value="v1"
          onChange={vi.fn()}
          required
          loading={false}
          options={numbered(3)}
          emptySetMessage="Nothing yet."
          describedBy="refusal"
          locked
          lockedReason={REASON}
        />
      </>,
    )
    expect(field()).toHaveAccessibleDescription(`Pick again. ${REASON}`)
  })

  test('an unlocked field has no aria-disabled and no reason line', () => {
    renderForm(<Host startsLocked={false} />)
    expect(field()).not.toHaveAttribute('aria-disabled')
    expect(screen.queryByText(REASON)).not.toBeInTheDocument()
  })
})

describe('the list never opens', () => {
  test('a tap on the phone opens no dialog and pushes no history entry', async () => {
    const user = userEvent.setup()
    const { depth } = renderForm(<Host />)
    await user.click(field())
    fireEvent.click(field())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(depth()).toBe(0)
    expect(field()).toHaveAttribute('aria-expanded', 'false')
  })

  test('Enter, Space and the arrows open nothing on the phone', async () => {
    const user = userEvent.setup()
    const { depth } = renderForm(<Host />)
    field().focus()
    await user.keyboard('{Enter} {ArrowDown}{ArrowUp}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(depth()).toBe(0)
  })

  test('on a computer a tap, Enter, Space and the arrows open no dropdown', async () => {
    stubViewport('computer')
    const user = userEvent.setup()
    const { depth } = renderForm(<Host />)
    await user.click(field())
    field().focus()
    await user.keyboard('{Enter} {ArrowDown}{ArrowUp}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(depth()).toBe(0)
  })

  test('locking with the phone list open closes it and leaves the stack at the form', async () => {
    const user = userEvent.setup()
    function LocksWhileOpen() {
      const [locked, setLocked] = useState(false)
      const shared = {
        label: 'Phone country',
        value: 'v1',
        onChange: vi.fn(),
        required: true as const,
        loading: false,
        options: numbered(3),
        emptySetMessage: 'Nothing yet.',
      }
      return (
        <>
          <button type="button" onClick={() => setLocked(true)}>
            Lock now
          </button>
          {locked ? <Selector {...shared} locked lockedReason={REASON} /> : <Selector {...shared} />}
        </>
      )
    }
    const { depth } = renderForm(<LocksWhileOpen />)
    await user.click(field())
    expect(depth()).toBe(1)
    fireEvent.click(screen.getByRole('button', { name: 'Lock now' }))
    await waitFor(() => expect(depth()).toBe(0))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('unlocking', () => {
  test('keeps the value, and the list then opens', async () => {
    const user = userEvent.setup()
    const { depth } = renderForm(<Host />)
    await user.click(screen.getByRole('button', { name: 'Toggle lock' }))
    expect(field()).toHaveTextContent('Option 2')
    expect(field()).not.toHaveAttribute('aria-disabled')
    await user.click(field())
    expect(depth()).toBe(1)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  test('relocking after a change keeps the value that was picked', async () => {
    const user = userEvent.setup()
    renderForm(<Host startsLocked={false} />)
    await user.click(field())
    await user.click(screen.getByRole('button', { name: 'Option 3' }))
    await user.click(screen.getByRole('button', { name: 'Toggle lock' }))
    expect(field()).toHaveTextContent('Option 3')
    expect(field()).toHaveAttribute('aria-disabled', 'true')
  })

  test('a computer viewport change leaves a locked field locked', () => {
    renderForm(<Host />)
    flipViewport('computer')
    expect(field()).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByText(REASON)).toBeVisible()
  })
})

// `locked` without `lockedReason` must not compile, and an unlocked field must not take one.
type Fed = {
  value: string | null
  onChange: (value: string | null) => void
  label: string
  options: readonly SelectorOption[]
  loading: boolean
  required: true
  emptySetMessage: string
}
type Rejected<P> = [P] extends [SelectorProps] ? false : true

const lockedWithoutReason: Rejected<Fed & { locked: true }> = true
const lockedWithOnlyUndefinedReason: Rejected<Fed & { locked: true; lockedReason: undefined }> = true
const reasonWithoutLock: Rejected<Fed & { lockedReason: string }> = true
const reasonOnUnlocked: Rejected<Fed & { locked: false; lockedReason: string }> = true
const lockedWithReason: Rejected<Fed & { locked: true; lockedReason: string }> = false
const notLocked: Rejected<Fed> = false

test('locked without lockedReason is enforced by tsc, not at run time', () => {
  expect(
    [lockedWithoutReason, lockedWithOnlyUndefinedReason, reasonWithoutLock, reasonOnUnlocked].every(Boolean),
  ).toBe(true)
  expect([lockedWithReason, notLocked].some(Boolean)).toBe(false)
})
