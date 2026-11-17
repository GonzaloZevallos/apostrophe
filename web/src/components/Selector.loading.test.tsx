/**
 * The Selector's skeleton, seen from the content area it stands in: the area carries
 * `aria-busy="true"` while the skeleton stands where the value will be, and loses it when the
 * options have loaded (CODING_STANDARDS §10 item 7).
 */

import { fireEvent, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { stubViewport } from '../test-viewport'
import { Controlled } from './SelectorTestHost'
import { numbered, renderForm } from './selectorTestKit'

beforeEach(() => stubViewport('phone'))
afterEach(() => vi.unstubAllGlobals())

function Field({ startsLoading }: { startsLoading: boolean }) {
  const [loading, setLoading] = useState(startsLoading)
  return (
    <>
      <button type="button" onClick={() => setLoading((now) => !now)}>
        Toggle loading
      </button>
      <Controlled label="Category" loading={loading} required options={numbered(3)} emptySetMessage="Nothing yet." />
    </>
  )
}

test('the area is busy from the first render while the skeleton shows, and clear after', () => {
  renderForm(<Field startsLoading />)
  expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true')
  fireEvent.click(screen.getByRole('button', { name: 'Toggle loading' }))
  expect(screen.getByRole('main')).not.toHaveAttribute('aria-busy')
})

test('a Selector with its options loaded leaves the area alone', () => {
  renderForm(<Field startsLoading={false} />)
  expect(screen.getByRole('main')).not.toHaveAttribute('aria-busy')
  fireEvent.click(screen.getByRole('button', { name: 'Toggle loading' }))
  expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true')
})
