/**
 * The flash reducer at its pure seam: the states `idle`, `armed` and `showing`, and
 * the sequences the plan lists (a toast armed before leaving shows only after the
 * location key changes; a blocked leave shows nothing).
 */

import { expect, test } from 'vitest'
import { flashReducer, type FlashState } from './flashReducer'

const idle: FlashState = { status: 'idle' }
const TEXT = { kind: 'text', text: 'Expense saved' } as const
const SALE = { kind: 'saleSaved', name: 'Ana' } as const

test('armed, then the same key: nothing is shown', () => {
  const armed = flashReducer(idle, { type: 'armAfterLeaving', message: 'Expense saved', id: 1, currentKey: 'a' })
  expect(armed).toEqual({ status: 'armed', originKey: 'a', message: TEXT, id: 1 })

  expect(flashReducer(armed, { type: 'locationChanged', key: 'a' })).toBe(armed)
})

test('armed, then a new key: shown once, on that key', () => {
  const armed = flashReducer(idle, { type: 'armAfterLeaving', message: 'Expense saved', id: 1, currentKey: 'a' })

  const showing = flashReducer(armed, { type: 'locationChanged', key: 'b' })

  expect(showing).toEqual({ status: 'showing', message: TEXT, id: 1, shownKey: 'b' })
})

test('shown, then a new key: idle', () => {
  const showing: FlashState = { status: 'showing', message: TEXT, id: 1, shownKey: 'b' }

  expect(flashReducer(showing, { type: 'locationChanged', key: 'c' })).toEqual(idle)
  expect(flashReducer(showing, { type: 'locationChanged', key: 'b' })).toBe(showing)
})

test('shown, then expired: idle', () => {
  const showing: FlashState = { status: 'showing', message: TEXT, id: 1, shownKey: 'b' }

  expect(flashReducer(showing, { type: 'expired' })).toEqual(idle)
})

test('expired when nothing is showing changes nothing, not even an armed toast', () => {
  const armed: FlashState = { status: 'armed', originKey: 'a', message: TEXT, id: 1 }

  expect(flashReducer(armed, { type: 'expired' })).toBe(armed)
  expect(flashReducer(idle, { type: 'expired' })).toBe(idle)
})

test('showNow shows in place, on the current key', () => {
  const showing = flashReducer(idle, { type: 'showNow', message: 'Expense deleted', id: 1, currentKey: 'a' })

  expect(showing).toEqual({ status: 'showing', message: { kind: 'text', text: 'Expense deleted' }, id: 1, shownKey: 'a' })
})

test('a location change while idle changes nothing', () => {
  expect(flashReducer(idle, { type: 'locationChanged', key: 'x' })).toBe(idle)
})

test('shown, then a redirect that follows the toast: still shown, on the new key; any other new key: idle', () => {
  const showing: FlashState = { status: 'showing', message: TEXT, id: 1, shownKey: 'b' }

  const followed = flashReducer(showing, { type: 'locationChanged', key: 'c', follows: true })

  expect(followed).toEqual({ status: 'showing', message: TEXT, id: 1, shownKey: 'c' })
  expect(flashReducer(followed, { type: 'locationChanged', key: 'd', follows: false })).toEqual(idle)
})

test('a bare string becomes a text message with the default duration and no action', () => {
  const showing = flashReducer(idle, { type: 'showNow', message: 'Expense saved', id: 7, currentKey: 'a' })

  expect(showing).toEqual({ status: 'showing', message: TEXT, id: 7, shownKey: 'a' })
  expect(showing).not.toHaveProperty('durationMs')
  expect(showing).not.toHaveProperty('action')
})

test('the duration, the action and the id survive arming, showing and a followed redirect', () => {
  const action = { label: 'Undo', onPress: () => {} }
  const armed = flashReducer(idle, {
    type: 'armAfterLeaving',
    message: { kind: 'saleSaved', name: 'Ana' },
    id: 3,
    durationMs: 5000,
    action,
    currentKey: 'a',
  })
  expect(armed).toEqual({ status: 'armed', originKey: 'a', message: SALE, id: 3, durationMs: 5000, action })

  const showing = flashReducer(armed, { type: 'locationChanged', key: 'b' })
  expect(showing).toEqual({ status: 'showing', message: SALE, id: 3, durationMs: 5000, action, shownKey: 'b' })

  const followed = flashReducer(showing, { type: 'locationChanged', key: 'c', follows: true })
  expect(followed).toEqual({ status: 'showing', message: SALE, id: 3, durationMs: 5000, action, shownKey: 'c' })
})

test('showNow carries the duration and the action too', () => {
  const action = { label: 'Undo', onPress: () => {} }

  const showing = flashReducer(idle, {
    type: 'showNow',
    message: { kind: 'saleSaved', name: 'Ana' },
    id: 4,
    durationMs: 5000,
    action,
    currentKey: 'a',
  })

  expect(showing).toEqual({ status: 'showing', message: SALE, id: 4, durationMs: 5000, action, shownKey: 'a' })
})

test('dismissed goes to idle', () => {
  const showing: FlashState = { status: 'showing', message: TEXT, id: 1, shownKey: 'b' }
  const armed: FlashState = { status: 'armed', originKey: 'a', message: TEXT, id: 1 }

  expect(flashReducer(showing, { type: 'dismissed' })).toEqual(idle)
  expect(flashReducer(armed, { type: 'dismissed' })).toEqual(idle)
  expect(flashReducer(idle, { type: 'dismissed' })).toEqual(idle)
})

test('two sequential location changes go armed, then showing, then idle', () => {
  const armed = flashReducer(idle, { type: 'armAfterLeaving', message: 'Expense saved', id: 1, currentKey: 'a' })

  const showing = flashReducer(armed, { type: 'locationChanged', key: 'b' })
  const gone = flashReducer(showing, { type: 'locationChanged', key: 'c' })

  expect(armed.status).toBe('armed')
  expect(showing.status).toBe('showing')
  expect(gone).toEqual(idle)
})
