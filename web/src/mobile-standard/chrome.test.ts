import { describe, expect, test } from 'vitest'
import {
  expectationFor,
  judgeChrome,
  kindAt,
  type ChromeElement,
  type ChromeExpectation,
  type ChromeFacts,
} from './chrome.ts'
import { HOME, MORE, pathTo, SALE, SALE_NEW, STOCK, VARIETY_ENTRIES } from '../routes.ts'
import { ROUTE_REGISTRY, type RouteRegistryEntry } from './registry.ts'
import type { CellId } from './targets.ts'

const CELL: CellId = { screen: 'Somewhere', size: '375x812', theme: 'claro' }

type Partial3 = Partial<Record<ChromeElement, { present?: boolean; inView?: boolean; covered?: boolean }>>

/** Facts for both phases: bar and "+ New sale" present and in view unless `over` says otherwise. */
function facts(over: Partial3 = {}, modalOpen = false): ChromeFacts {
  const elements = (['bar', 'newSale', 'header'] as const).flatMap((element) =>
    (['load', 'mid'] as const).map((phase) => ({
      element,
      phase,
      present: element !== 'header',
      inView: true,
      covered: false,
      ...over[element],
    })),
  )
  return { modalOpen, elements }
}

const judged = (expectation: ChromeExpectation, found: ChromeFacts) =>
  judgeChrome(expectation, found, CELL).map((v) => `${v.rule} ${v.target}`)

describe('judgeChrome: each expectation', () => {
  test('a tab root wants the bar and "+ New sale", both there', () => {
    expect(judged('root', facts({ newSale: {} }))).toEqual([])
  })

  test('a tab root without either is reported at load and mid-scroll, with the fixed targets', () => {
    const missing = facts({ bar: { present: false }, newSale: { present: false } })
    expect(judged('root', missing)).toEqual([
      'chrome-at-load chrome:bar',
      'chrome-mid-scroll chrome:bar',
      'chrome-at-load chrome:new-sale',
      'chrome-mid-scroll chrome:new-sale',
    ])
  })

  test('a card wants the bar and no "+ New sale"', () => {
    expect(judged('card', facts({ newSale: { present: false } }))).toEqual([])
    expect(judged('card', facts({ bar: { present: false }, newSale: { present: false } }))).toEqual([
      'chrome-at-load chrome:bar',
      'chrome-mid-scroll chrome:bar',
    ])
  })

  test('a card with "+ New sale" is reported', () => {
    expect(judged('card', facts({ newSale: {} }))).toEqual([
      'chrome-at-load chrome:new-sale',
      'chrome-mid-scroll chrome:new-sale',
    ])
  })

  test.each(['form', 'signedOut'] as const)('a %s wants neither; an uncovered bar is reported', (expectation) => {
    const none = facts({ bar: { present: false }, newSale: { present: false } })
    expect(judged(expectation, none)).toEqual([])
    expect(judged(expectation, facts({ newSale: { present: false } }))).toEqual([
      'chrome-at-load chrome:bar',
      'chrome-mid-scroll chrome:bar',
    ])
  })

  test('a forbidden bar is reported even when it sits out of view', () => {
    const away = facts({ bar: { inView: false }, newSale: { present: false } })
    expect(judged('form', away)).toHaveLength(2)
  })

  test('an expected bar out of view and uncovered is reported, with the rule of the phase', () => {
    const found = facts({ newSale: { present: false } })
    const only = found.elements.map((e) => (e.element === 'bar' && e.phase === 'mid' ? { ...e, inView: false } : e))
    expect(judged('card', { ...found, elements: only })).toEqual(['chrome-mid-scroll chrome:bar'])
  })

  test('the violation carries the cell', () => {
    const [violation] = judgeChrome('card', facts({ bar: { inView: false }, newSale: { present: false } }), CELL)
    expect(violation).toEqual({ ...CELL, rule: 'chrome-at-load', target: 'chrome:bar' })
  })
})

describe('judgeChrome: the header', () => {
  test('an absent header is never reported, on any kind', () => {
    for (const expectation of ['root', 'card', 'form', 'signedOut'] as const) {
      const ok = facts({ bar: { present: expectation === 'root' || expectation === 'card' }, newSale: { present: expectation === 'root' } })
      expect(judged(expectation, ok)).toEqual([])
    }
  })

  test('a header present and out of view is reported; in view or covered it passes', () => {
    const base = { bar: { present: false }, newSale: { present: false } }
    expect(judged('form', facts({ ...base, header: { present: true, inView: false } }))).toEqual([
      'chrome-at-load chrome:header',
      'chrome-mid-scroll chrome:header',
    ])
    expect(judged('form', facts({ ...base, header: { present: true } }))).toEqual([])
    expect(judged('form', facts({ ...base, header: { present: true, inView: false, covered: true } }))).toEqual([])
  })
})

describe('judgeChrome: covered chrome', () => {
  test('a covered bar passes at load and at mid-scroll, out of view or not, even where it is forbidden', () => {
    const covered = facts({ bar: { covered: true, inView: false }, newSale: { present: false } })
    expect(judged('card', covered)).toEqual([])
    expect(judged('form', covered)).toEqual([])
  })

  test('an overlay whose chrome is uncovered and out of view is reported', () => {
    const found = facts({ bar: { inView: false }, newSale: { present: false } }, true)
    expect(judged('card', found)).toEqual(['chrome-at-load chrome:bar', 'chrome-mid-scroll chrome:bar'])
  })

  test('with a modal open nothing is expected: a root passes with the bar absent and present', () => {
    expect(judged('root', facts({ bar: { present: false }, newSale: { present: false } }, true))).toEqual([])
    expect(judged('root', facts({ bar: { covered: true }, newSale: { covered: true } }, true))).toEqual([])
  })

  test('a covered "+ New sale" on a card passes', () => {
    expect(judged('card', facts({ newSale: { covered: true } }))).toEqual([])
  })
})

const rows = (...paths: [string, RouteRegistryEntry['kind']][]): RouteRegistryEntry[] =>
  paths.map(([path, kind]) => ({ path, kind, parent: null, computerParent: null, archivedParent: null }))

describe('kindAt', () => {
  test('resolves /sales/new to the form, not the /sales/{id} card, in either row order', () => {
    const form = rows([SALE_NEW, 'form'], [SALE, 'card'])
    expect(kindAt(SALE_NEW, form)).toBe('form')
    expect(kindAt(SALE_NEW, [...form].reverse())).toBe('form')
    expect(kindAt(pathTo(SALE, { id: 12 }), form)).toBe('card')
  })

  test('resolves /varieties/entries/x against /varieties/{id}/entries', () => {
    const list = rows([VARIETY_ENTRIES, 'card'], [`${STOCK}/:entry`, 'form'])
    expect(kindAt(`${STOCK}/x`, list)).toBe('form')
    expect(kindAt(pathTo(VARIETY_ENTRIES, { id: 7 }), list)).toBe('card')
  })

  test('accepts :name parameters as well as {name}', () => {
    expect(kindAt('/a/1', rows(['/a/:id', 'card']))).toBe('card')
  })

  test('gives null for a path no row matches, and for a different length', () => {
    const list = rows([SALE, 'card'])
    expect(kindAt('/nowhere', list)).toBeNull()
    expect(kindAt(`${pathTo(SALE, { id: 1 })}/extra`, list)).toBeNull()
  })

  test('a tie between two rows throws', () => {
    const tied = rows(['/a/{x}', 'card'], ['/{y}/b', 'form'])
    expect(() => kindAt('/a/b', tied)).toThrow('/a/b matches /a/{x} and /{y}/b equally')
  })

  test('the root path matches only the root row', () => {
    expect(kindAt(HOME, rows([HOME, 'root'], [MORE, 'root']))).toBe('root')
  })

  test('over the real registry every row, parameters filled, gives its own kind and never throws', () => {
    for (const row of ROUTE_REGISTRY) {
      const real = row.path.replace(/\{\w+\}|:\w+/g, 'sample')
      expect(kindAt(real, ROUTE_REGISTRY), row.path).toBe(row.kind)
    }
  })
})

describe('expectationFor', () => {
  const list = rows([SALE, 'card'])
  const sale = pathTo(SALE, { id: 1 })

  test('the signedOut flag beats a matching row', () => {
    expect(expectationFor(true, sale, list)).toBe('signedOut')
  })

  test('without the flag it is the row kind, or null when no row matches', () => {
    expect(expectationFor(false, sale, list)).toBe('card')
    expect(expectationFor(false, '/nowhere', list)).toBeNull()
  })

  test('the flag wins even for a path no row matches', () => {
    expect(expectationFor(true, '/nowhere', list)).toBe('signedOut')
  })
})
