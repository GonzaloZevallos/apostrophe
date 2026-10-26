/**
 * The behind-pane helper must reject what it is there to forbid (ADR-0053): a pane that is not
 * inert, not hidden, or holds an `h1`, an id, a busy mark or any text while it should be empty.
 */

import { render } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import BehindPane from '../components/BehindPane'
import { behindPane, expectBehindPane, expectBehindPaneEmpty } from './behindPane'

function pane(markup: string): HTMLElement {
  const holder = document.createElement('div')
  holder.innerHTML = markup
  return holder.firstElementChild as HTMLElement
}

describe('expectBehindPane', () => {
  test('accepts the pane BehindPane draws, loaded or empty', () => {
    const { container, rerender } = render(<BehindPane>{null}</BehindPane>)
    expectBehindPaneEmpty(behindPane(container))
    rerender(
      <BehindPane>
        <span>Ana</span>
      </BehindPane>,
    )
    expectBehindPane(behindPane(container))
  })

  test.each([
    ['not inert', '<div aria-hidden="true"></div>'],
    ['not aria-hidden', '<div inert></div>'],
    ['an h1', '<div inert aria-hidden="true"><h1>Customers</h1></div>'],
    ['an id', '<div inert aria-hidden="true"><span id="x">a</span></div>'],
    ['a busy mark', '<div inert aria-hidden="true"><div aria-busy="true"></div></div>'],
  ])('rejects a pane that is %s', (_name, markup) => {
    expect(() => expectBehindPane(pane(markup))).toThrow()
  })

  test('rejects a pane that should be empty and holds text or an element', () => {
    expect(() => expectBehindPaneEmpty(pane('<div inert aria-hidden="true">Loading</div>'))).toThrow()
    expect(() => expectBehindPaneEmpty(pane('<div inert aria-hidden="true"><i></i></div>'))).toThrow()
  })

  test('finds no pane when none is drawn', () => {
    expect(() => behindPane(document.createElement('div'))).toThrow()
  })
})
