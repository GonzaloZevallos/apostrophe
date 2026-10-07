/**
 * The flash reducer at its pure seam: the states `idle`, `armed` and `showing`, and
 * the sequences the plan lists (a toast armed before leaving shows only after the
 * location key changes; a blocked leave shows nothing).
 */

import { expect, test } from 'vitest'
import { flashReducer, type FlashState } from './flashReducer'

const idle: FlashState = { status: 'idle' }

test('armed, then the same key: nothing is shown', () => {
  const armed = flashReducer(idle, { type: 'armAfterLeaving', toast: 'Gasto guardado', currentKey: 'a' })
  expect(armed).toEqual({ status: 'armed', originKey: 'a', toast: 'Gasto guardado' })

  expect(flashReducer(armed, { type: 'locationChanged', key: 'a' })).toBe(armed)
})

test('armed, then a new key: shown once, on that key', () => {
  const armed = flashReducer(idle, { type: 'armAfterLeaving', toast: 'Gasto guardado', currentKey: 'a' })

  const showing = flashReducer(armed, { type: 'locationChanged', key: 'b' })

  expect(showing).toEqual({ status: 'showing', toast: 'Gasto guardado', shownKey: 'b' })
})

test('shown, then a new key: idle', () => {
  const showing: FlashState = { status: 'showing', toast: 'Gasto guardado', shownKey: 'b' }

  expect(flashReducer(showing, { type: 'locationChanged', key: 'c' })).toEqual(idle)
  expect(flashReducer(showing, { type: 'locationChanged', key: 'b' })).toBe(showing)
})

test('shown, then expired: idle', () => {
  const showing: FlashState = { status: 'showing', toast: 'Gasto guardado', shownKey: 'b' }

  expect(flashReducer(showing, { type: 'expired' })).toEqual(idle)
})

test('expired when nothing is showing changes nothing, not even an armed toast', () => {
  const armed: FlashState = { status: 'armed', originKey: 'a', toast: 'Gasto guardado' }

  expect(flashReducer(armed, { type: 'expired' })).toBe(armed)
  expect(flashReducer(idle, { type: 'expired' })).toBe(idle)
})

test('showNow shows in place, on the current key', () => {
  const showing = flashReducer(idle, { type: 'showNow', toast: 'Gasto eliminado', currentKey: 'a' })

  expect(showing).toEqual({ status: 'showing', toast: 'Gasto eliminado', shownKey: 'a' })
})

test('a location change while idle changes nothing', () => {
  expect(flashReducer(idle, { type: 'locationChanged', key: 'x' })).toBe(idle)
})

const SHOWING: FlashState = { status: 'showing', toast: 'Entrada guardada', shownKey: 'a' }

test('keepAcrossReplace: the toast on screen survives the one location change after it, the next dismisses it', () => {
  const kept = flashReducer(flashReducer(SHOWING, { type: 'keepAcrossReplace' }), { type: 'locationChanged', key: 'b' })
  expect(kept).toEqual({ status: 'showing', toast: 'Entrada guardada', shownKey: 'b' })
  expect(flashReducer(kept, { type: 'locationChanged', key: 'c' })).toEqual({ status: 'idle' })
})

test('without keepAcrossReplace a location change dismisses the toast; with nothing showing it does nothing', () => {
  expect(flashReducer(SHOWING, { type: 'locationChanged', key: 'b' })).toEqual({ status: 'idle' })
  expect(flashReducer({ status: 'idle' }, { type: 'keepAcrossReplace' })).toEqual({ status: 'idle' })
})
