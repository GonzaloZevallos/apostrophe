/**
 * `decideScroll`, the pure rule of "Scroll on a change of screen" (navigation.md, criteria
 * 21-23): what the page does when the location changes. One row per action x kind x viewport.
 */

import { describe, expect, test } from 'vitest'
import { CUSTOMER, CUSTOMER_EDIT, CUSTOMER_PAYMENT, CUSTOMER_NEW, CUSTOMERS, HOME, SALE_NEW, SALES, VARIETIES, VARIETY, pathTo } from '../routes'
import { decideScroll, type NavigationAction, type PlaceInHistory } from './scrollPlan'
import type { Viewport } from '../routes'

function at(pathname: string, state: unknown = null): PlaceInHistory {
  return { pathname, state }
}

const ACTIONS: readonly NavigationAction[] = ['PUSH', 'REPLACE', 'POP']
const VIEWPORTS: readonly Viewport[] = ['phone', 'computer']

describe('a change of path', () => {
  test.each(VIEWPORTS)('a forward move to another screen starts at the top (%s)', (viewport) => {
    for (const action of ['PUSH', 'REPLACE'] as const) {
      expect(decideScroll(at(SALES), at(CUSTOMERS), action, viewport)).toBe('top')
      expect(decideScroll(at(HOME), at(SALE_NEW), action, viewport)).toBe('top')
      expect(decideScroll(at(SALES), at(pathTo(CUSTOMER, { id: 4 })), action, viewport)).toBe('top')
    }
  })

  test.each(VIEWPORTS)('a pop restores the place of the entry it returns to (%s)', (viewport) => {
    expect(decideScroll(at(CUSTOMER_NEW), at(CUSTOMERS), 'POP', viewport)).toBe('restore')
    expect(decideScroll(at(SALES), at(HOME), 'POP', viewport)).toBe('restore')
  })

  test('a path outside the screens table is treated as a screen of its own', () => {
    expect(decideScroll(at('/nowhere'), at(HOME), 'PUSH', 'phone')).toBe('top')
    expect(decideScroll(at(HOME), at('/nowhere'), 'POP', 'computer')).toBe('restore')
  })
})

describe('the same path', () => {
  test.each(ACTIONS)('does nothing on %s, whatever the state or the search', (action) => {
    for (const viewport of VIEWPORTS) {
      expect(decideScroll(at(SALES), at(SALES, { depth: 1 }), action, viewport)).toBe('none')
      expect(decideScroll(at(SALES), at(SALES), action, viewport)).toBe('none')
    }
  })
})

describe('Record payment opened over the screen it came from', () => {
  const to = at(pathTo(CUSTOMER_PAYMENT, { id: 9 }), { underneath: 'customers' })

  test('does nothing on the phone: the full-screen sheet has no outside', () => {
    expect(decideScroll(at(CUSTOMERS), to, 'PUSH', 'phone')).toBe('none')
  })

  test('keeps the place of the screen under it on a computer', () => {
    expect(decideScroll(at(CUSTOMERS), to, 'PUSH', 'computer')).toBe('keep')
  })

  test('a route with no underneath in its state is an ordinary arrival', () => {
    expect(decideScroll(at(CUSTOMERS), at(pathTo(CUSTOMER_PAYMENT, { id: 9 })), 'PUSH', 'phone')).toBe('top')
    expect(decideScroll(at(CUSTOMERS), at(pathTo(CUSTOMER_PAYMENT, { id: 9 }), { underneath: 'elsewhere' }), 'PUSH', 'phone')).toBe('top')
  })

  test('going back out of it restores the screen underneath', () => {
    for (const viewport of VIEWPORTS) {
      expect(decideScroll(to, at(CUSTOMERS), 'POP', viewport)).toBe('restore')
    }
  })
})

describe('the two panes of a computer', () => {
  test('picking a row, or the auto-selected first one, moves nothing', () => {
    expect(decideScroll(at(CUSTOMERS), at(pathTo(CUSTOMER, { id: 3 })), 'PUSH', 'computer')).toBe('none')
    expect(decideScroll(at(VARIETIES), at(pathTo(VARIETY, { id: 3 })), 'REPLACE', 'computer')).toBe('none')
  })

  test('picking another row, or closing the detail, moves nothing', () => {
    expect(decideScroll(at(pathTo(CUSTOMER, { id: 3 })), at(pathTo(CUSTOMER, { id: 5 })), 'PUSH', 'computer')).toBe('none')
    expect(decideScroll(at(pathTo(CUSTOMER, { id: 3 })), at(CUSTOMERS), 'PUSH', 'computer')).toBe('none')
  })

  test('on the phone the same move is a new screen from its top', () => {
    expect(decideScroll(at(CUSTOMERS), at(pathTo(CUSTOMER, { id: 3 })), 'PUSH', 'phone')).toBe('top')
    expect(decideScroll(at(VARIETIES), at(pathTo(VARIETY, { id: 3 })), 'PUSH', 'phone')).toBe('top')
  })

  test('a form over the detail is not a pane: it is an arrival', () => {
    expect(decideScroll(at(pathTo(CUSTOMER, { id: 3 })), at(pathTo(CUSTOMER_EDIT, { id: 3 })), 'PUSH', 'computer')).toBe('top')
  })

  test('a pop between the panes still does nothing: both are one screen', () => {
    expect(decideScroll(at(pathTo(CUSTOMER, { id: 3 })), at(CUSTOMERS), 'POP', 'computer')).toBe('none')
  })
})
