/**
 * `nextPlaces` and the module's memory at their seam: the bookkeeping of the offsets, as pure
 * steps and as sequences through `recordChange`/`offsetFor`/`decisionFor`.
 */

import { afterEach, expect, test } from 'vitest'
import { PLACES_CAP, nextPlaces, offsetFor, decisionFor, recordChange, resetPlaces, type Change } from './scrollPlaces'

const EMPTY = new Map<string, number>()

function change(partial: Partial<Change> & Pick<Change, 'prevKey' | 'nextKey'>): Change {
  return {
    action: 'PUSH',
    decision: 'top',
    overPage: false,
    pinned: false,
    liveScrollY: 0,
    ...partial,
  }
}

afterEach(() => {
  resetPlaces()
})

test('the screen being left keeps the live offset under its key, on PUSH and on POP', () => {
  expect(nextPlaces(EMPTY, undefined, 'a', 'b', 'PUSH', 'top', false, false, 700).places).toEqual(new Map([['a', 700]]))
  expect(nextPlaces(new Map([['b', 20]]), undefined, 'b', 'a', 'POP', 'restore', false, false, 35).places).toEqual(new Map([['b', 35]]))
})

test('a pinned leave saves held, never the live reading', () => {
  const step = nextPlaces(EMPTY, 800, 'sheet', 'b', 'PUSH', 'top', false, true, 0)
  expect(step.places).toEqual(new Map([['sheet', 800]]))
})

test('a pinned leave with held undefined saves nothing, and keeps what was saved before', () => {
  expect(nextPlaces(EMPTY, undefined, 'sheet', 'b', 'POP', 'keep', false, true, 0).places).toEqual(new Map())
  expect(nextPlaces(new Map([['sheet', 55]]), undefined, 'sheet', 'a', 'POP', 'keep', false, true, 0).places).toEqual(new Map([['sheet', 55]]))
})

test('held becomes the leaving value only for a keep drawn over the same page', () => {
  expect(nextPlaces(EMPTY, undefined, 'a', 's', 'PUSH', 'keep', true, false, 800).held).toBe(800)
  expect(nextPlaces(EMPTY, undefined, 'a', 's', 'PUSH', 'keep', false, false, 800).held).toBeUndefined()
  expect(nextPlaces(EMPTY, undefined, 'a', 's', 'PUSH', 'top', true, false, 800).held).toBeUndefined()
  expect(nextPlaces(EMPTY, undefined, 'a', 's', 'POP', 'restore', true, false, 800).held).toBeUndefined()
})

test('a sheet over a sheet carries the same held, from the page underneath', () => {
  const first = nextPlaces(EMPTY, undefined, 'a', 's1', 'PUSH', 'keep', true, false, 800)
  const second = nextPlaces(first.places, first.held, 's1', 's2', 'PUSH', 'keep', true, true, 0)
  expect(second.held).toBe(800)
  expect(second.places.get('s1')).toBe(800)
})

test('a REPLACE that keeps the page carries its offset to the new key and drops the old one', () => {
  const step = nextPlaces(new Map([['x', 5]]), undefined, 'a', 'b', 'REPLACE', 'keep', false, false, 410)
  expect(step.places).toEqual(
    new Map([
      ['x', 5],
      ['b', 410],
    ]),
  )
})

test('a REPLACE that opens elsewhere records nothing and the replaced entry is gone', () => {
  const step = nextPlaces(new Map([['a', 90]]), undefined, 'a', 'b', 'REPLACE', 'top', false, false, 410)
  expect(step.places).toEqual(new Map())
  expect(step.held).toBeUndefined()
})

test('a pinned REPLACE that keeps the page carries held, or the old entry when held is undefined', () => {
  expect(nextPlaces(new Map([['a', 90]]), 300, 'a', 'b', 'REPLACE', 'keep', false, true, 0).places).toEqual(new Map([['b', 300]]))
  expect(nextPlaces(new Map([['a', 90]]), undefined, 'a', 'b', 'REPLACE', 'keep', false, true, 0).places).toEqual(new Map([['b', 90]]))
})

test('it does not change the map it was given', () => {
  const before = new Map([['a', 1]])
  nextPlaces(before, undefined, 'a', 'b', 'PUSH', 'top', false, false, 9)
  expect(before).toEqual(new Map([['a', 1]]))
})

test('a sheet, a page on top of it and the way back: B keeps 300, the sheet 800 and A is kept', () => {
  // A at 800, a sheet opened over A (not yet pinned when the location changes).
  recordChange(change({ prevKey: 'A', nextKey: 'S', decision: 'keep', overPage: true, liveScrollY: 800 }))
  // From the pinned sheet to page B: the live reading is 0 because the page is pinned.
  recordChange(change({ prevKey: 'S', nextKey: 'B', decision: 'top', pinned: true, liveScrollY: 0 }))
  // B scrolled to 300, then to C.
  recordChange(change({ prevKey: 'B', nextKey: 'C', decision: 'top', liveScrollY: 300 }))
  // Back to B, back to the sheet, back to A.
  recordChange(change({ prevKey: 'C', nextKey: 'B', action: 'POP', decision: 'restore', liveScrollY: 40 }))
  expect(offsetFor('B')).toBe(300)
  recordChange(change({ prevKey: 'B', nextKey: 'S', action: 'POP', decision: 'restore', liveScrollY: 300 }))
  expect(offsetFor('S')).toBe(800)
  recordChange(change({ prevKey: 'S', nextKey: 'A', action: 'POP', decision: 'keep', pinned: true, liveScrollY: 0 }))
  expect(decisionFor('A')).toBe('keep')
  expect(offsetFor('A')).toBe(800)
  expect(offsetFor('S')).toBe(800)
})

test('an entry never left has no offset and no decision', () => {
  expect(offsetFor('never')).toBeUndefined()
  expect(decisionFor('never')).toBeUndefined()
})

test('recordChange stores the decision under the new key', () => {
  recordChange(change({ prevKey: 'a', nextKey: 'b', decision: 'top' }))
  recordChange(change({ prevKey: 'b', nextKey: 'a', action: 'POP', decision: 'restore' }))
  expect(decisionFor('b')).toBe('top')
  expect(decisionFor('a')).toBe('restore')
})

test('held is never read from another arrival: a top clears it before the next pinned leave', () => {
  recordChange(change({ prevKey: 'A', nextKey: 'S', decision: 'keep', overPage: true, liveScrollY: 800 }))
  recordChange(change({ prevKey: 'S', nextKey: 'B', decision: 'top', pinned: true }))
  // A pinned leave of B (say a sheet opened on B drew it pinned) must not save A's 800.
  recordChange(change({ prevKey: 'B', nextKey: 'C', decision: 'top', pinned: true, liveScrollY: 0 }))
  expect(offsetFor('B')).toBeUndefined()
})

test('the memory is capped at 100 keys and drops the oldest by insertion', () => {
  for (let i = 0; i < PLACES_CAP + 5; i += 1) {
    recordChange(change({ prevKey: `k${i}`, nextKey: `k${i + 1}`, liveScrollY: i + 1 }))
  }
  expect(offsetFor('k0')).toBeUndefined()
  expect(offsetFor('k4')).toBeUndefined()
  expect(offsetFor('k5')).toBe(6)
  expect(offsetFor(`k${PLACES_CAP + 4}`)).toBe(PLACES_CAP + 5)
  expect(decisionFor('k1')).toBeUndefined()
  expect(decisionFor(`k${PLACES_CAP + 5}`)).toBe('top')
})

test('nextPlaces itself drops the oldest key once past the cap', () => {
  let places: ReadonlyMap<string, number> = EMPTY
  for (let i = 0; i < PLACES_CAP; i += 1) places = nextPlaces(places, undefined, `k${i}`, 'next', 'PUSH', 'top', false, false, i).places
  expect(places.size).toBe(PLACES_CAP)
  places = nextPlaces(places, undefined, 'extra', 'next', 'PUSH', 'top', false, false, 7).places
  expect(places.size).toBe(PLACES_CAP)
  expect(places.has('k0')).toBe(false)
  expect(places.get('extra')).toBe(7)
})
