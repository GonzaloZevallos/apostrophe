/**
 * `judgeLabel` and `rowLabels` at their own seam: a container and a label in, a verdict out;
 * registry rows in, `(screen, step, label)` out. Each refusal asserts the verdict's own text.
 */

import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { loadBundle } from '../../scripts/i18n/loadBundle.ts'
import { parseRegistry } from '../mobile-standard/registry'
import { judgeLabel, rowLabels, rowsWithoutEntry } from './screenImagesLabels'

describe('judgeLabel', () => {
  it('rejects a label that is a prefix of the real one (a wrapping label that holds its help text)', () => {
    const { container } = render(
      <label>
        <span>Name</span>
        <input />
        <span>Whatever the product is called</span>
      </label>,
    )
    expect(judgeLabel(container, 'Name')).toEqual({
      ok: false,
      matched: 0,
      problem: 'no control on the page has the label "Name"',
    })
  })

  it('passes an exact aria-labelledby name, whatever else the wrapping label holds', () => {
    const { container } = render(
      <label>
        <span id="rotulo">Name</span>
        <input aria-labelledby="rotulo" aria-describedby="ayuda" />
        <span id="ayuda">Whatever the product is called</span>
      </label>,
    )
    expect(judgeLabel(container, 'Name')).toEqual({ ok: true, matched: 1, problem: null })
  })

  it('joins several aria-labelledby texts with a space and collapses whitespace', () => {
    const { container } = render(
      <div>
        <span id="a">  Line   1 </span>
        <span id="b">grams</span>
        <input aria-labelledby="a b" />
      </div>,
    )
    expect(judgeLabel(container, 'Line 1 grams').ok).toBe(true)
  })

  it('reads aria-label, then a native label that wraps or that points through for', () => {
    const { container } = render(
      <div>
        <input aria-label="Grams" />
        <label>
          Email address
          <input />
        </label>
        <label htmlFor="clave">Password</label>
        <input id="clave" />
      </div>,
    )
    expect(judgeLabel(container, 'Grams').ok).toBe(true)
    expect(judgeLabel(container, 'Email address').ok).toBe(true)
    expect(judgeLabel(container, 'Password').ok).toBe(true)
  })

  it('rejects a label equal only to a control placeholder', () => {
    const { container } = render(<input placeholder="Name" />)
    expect(judgeLabel(container, 'Name')).toEqual({
      ok: false,
      matched: 0,
      problem: 'no control on the page has the label "Name"',
    })
  })

  it('rejects a label equal only to a control title', () => {
    const { container } = render(<input title="Name" />)
    expect(judgeLabel(container, 'Name').ok).toBe(false)
  })

  it('rejects a difference of case only', () => {
    const { container } = render(<input aria-label="Name" />)
    expect(judgeLabel(container, 'name')).toEqual({
      ok: false,
      matched: 0,
      problem: 'no control on the page has the label "name"',
    })
  })

  it('rejects a label that two controls have', () => {
    const { container } = render(
      <div>
        <input aria-label="Name" />
        <label>
          Name
          <input />
        </label>
      </div>,
    )
    expect(judgeLabel(container, 'Name')).toEqual({
      ok: false,
      matched: 2,
      problem: 'the label "Name" names 2 controls, it must name exactly one',
    })
  })

  it('does not fall back to the native label when aria-labelledby names something else', () => {
    const { container } = render(
      <label>
        Name
        <span id="otro">Other</span>
        <input aria-labelledby="otro" />
      </label>,
    )
    expect(judgeLabel(container, 'Name').ok).toBe(false)
    expect(judgeLabel(container, 'Other').ok).toBe(true)
  })
})

describe('rowLabels', () => {
  const bundle = loadBundle('en')
  const rows = parseRegistry({
    screens: [
      { screen: 'Plain', route: '/a', path: '/a' },
      {
        screen: 'Typed',
        route: '/b',
        path: '/b',
        steps: [
          { click: 'Go' },
          { fill: { label: 'Name', value: 'x' } },
          { select: { label: 'Country', index: 1 } },
          { fill: { label: 'common:close', value: 'y' } },
        ],
      },
    ],
  })

  it('lists the fill and select labels with their row and step index, keys resolved as the capture does', () => {
    expect(rowLabels(rows, bundle)).toEqual([
      { screen: 'Typed', step: 1, kind: 'fill', label: 'Name' },
      { screen: 'Typed', step: 2, kind: 'select', label: 'Country' },
      { screen: 'Typed', step: 3, kind: 'fill', label: 'Close' },
    ])
  })
})

describe('rowsWithoutEntry', () => {
  const labels = [
    { screen: 'Typed', step: 1, kind: 'fill', label: 'Name' },
    { screen: 'Typed', step: 2, kind: 'select', label: 'Country' },
    { screen: 'Other', step: 0, kind: 'fill', label: 'Grams' },
  ] as const

  it('names a row that has a label and no render entry, once, and no row that has one', () => {
    expect(rowsWithoutEntry(labels, ['Other'])).toEqual(['Typed: has a fill or select and no render entry'])
  })

  it('names nothing when every row with a label has an entry', () => {
    expect(rowsWithoutEntry(labels, ['Typed', 'Other'])).toEqual([])
  })
})
