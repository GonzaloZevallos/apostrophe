/**
 * `useLabel` at its own seam: a key label is resolved with `t` on every render, a text label
 * (a record's own name) is returned verbatim and never read as a key.
 */

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useLabel, type Label } from './label'

function Probe({ label }: { label: Label }) {
  const resolve = useLabel()
  return <p>{resolve(label)}</p>
}

describe('useLabel', () => {
  it('resolves a key label through t', () => {
    render(<Probe label={{ kind: 'key', key: 'common:save' }} />)
    expect(screen.getByText('Save')).toBeTruthy()
  })

  it('renders a text label verbatim, even when it looks like a key', () => {
    render(<Probe label={{ kind: 'text', text: 'common:save' }} />)
    expect(screen.getByText('common:save')).toBeTruthy()
  })
})
