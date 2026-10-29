/**
 * `nextPlaces` at its seam: a pure table of the bookkeeping, plus `watchScroll` against a
 * fake router to show the offset is read synchronously in `subscribe`.
 */

import { afterEach, expect, test, vi } from 'vitest'
import { SALE, SALES, pathTo } from '../routes'
import { nextPlaces, offsetFor, resetPlaces, watchScroll } from './scrollPlaces'

const SALE_THREE = pathTo(SALE, { id: 3 })
const EMPTY = new Map<string, number>()

type Action = 'POP' | 'PUSH' | 'REPLACE'

test('PUSH keeps the offset of the screen being left under its entry', () => {
  expect(nextPlaces(EMPTY, 'a', 'b', 'PUSH', false, 700)).toEqual(new Map([['a', 700]]))
})

test('POP keeps it too, and an earlier offset of that entry is replaced', () => {
  expect(nextPlaces(new Map([['b', 20]]), 'b', 'a', 'POP', false, 35)).toEqual(new Map([['b', 35]]))
})

test('a same-path PUSH (a sheet stacked on the screen) still records the screen left', () => {
  expect(nextPlaces(EMPTY, 'a', 'b', 'PUSH', true, 410)).toEqual(new Map([['a', 410]]))
})

test('a same-path REPLACE carries the offset to the new entry and drops the old one', () => {
  expect(nextPlaces(new Map([['x', 5]]), 'a', 'b', 'REPLACE', true, 410)).toEqual(
    new Map([
      ['x', 5],
      ['b', 410],
    ]),
  )
})

test('a different-path REPLACE records nothing and the replaced entry is gone', () => {
  expect(nextPlaces(new Map([['a', 90]]), 'a', 'b', 'REPLACE', false, 410)).toEqual(new Map())
})

test('it does not change the map it was given', () => {
  const before = new Map([['a', 1]])
  nextPlaces(before, 'a', 'b', 'PUSH', false, 9)
  expect(before).toEqual(new Map([['a', 1]]))
})

interface FakeState {
  location: { key: string; pathname: string }
  historyAction: Action
}

function fakeRouter(start: { key: string; pathname: string }) {
  const listeners = new Set<(state: FakeState) => void>()
  const router = {
    state: { location: start },
    subscribe: (listener: (state: FakeState) => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
  const go = (key: string, pathname: string, historyAction: Action) => {
    router.state = { location: { key, pathname } }
    listeners.forEach((listener) => listener({ location: { key, pathname }, historyAction }))
  }
  return { router, go }
}

afterEach(() => {
  resetPlaces()
  vi.restoreAllMocks()
})

test('watchScroll reads scrollY at the moment of the change, for the entry being left', () => {
  const { router, go } = fakeRouter({ key: 'default', pathname: SALES })
  watchScroll(router as never)
  vi.spyOn(window, 'scrollY', 'get').mockReturnValue(640)
  go('k1', SALE_THREE, 'PUSH')
  vi.spyOn(window, 'scrollY', 'get').mockReturnValue(0)
  go('k2', SALES, 'POP')
  expect(offsetFor('default')).toBe(640)
  expect(offsetFor('k1')).toBe(0)
  expect(offsetFor('never-seen')).toBe(0)
})

test('watchScroll ignores a state whose location did not change, and carries a same-path REPLACE', () => {
  const { router, go } = fakeRouter({ key: 'default', pathname: SALES })
  watchScroll(router as never)
  vi.spyOn(window, 'scrollY', 'get').mockReturnValue(300)
  go('default', SALES, 'PUSH')
  expect(offsetFor('default')).toBe(0)
  go('k1', SALES, 'REPLACE')
  expect(offsetFor('k1')).toBe(300)
})
