/**
 * The flash reducer at its pure seam: the states `idle`, `armed` and `showing`, and
 * the sequences the plan lists (a toast armed before leaving shows only after the
 * location key changes; a blocked leave shows nothing).
 */

import { describe, expect, test } from 'vitest'
import { flashReducer, holdsAttention, type FlashState, type StoredMessage } from './flashReducer'

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

const SAVED_ACTION = { label: 'Undo', onPress: () => {} }
const FAILED = { kind: 'undoResult', result: 'failed' } as const
const OFFLINE = { kind: 'undoResult', result: 'offline' } as const
const DELETED = { kind: 'undoResult', result: 'deleted' } as const
const queued = (id: number, message: StoredMessage = DELETED) => ({
  message,
  id,
})

describe('the queue of action-less toasts that wait behind an actionable or attention one', () => {
  test('armed with a waiting result, then a new key: showing the armed toast, the queue kept', () => {
    const armed: FlashState = {
      status: 'armed',
      originKey: 'a',
      message: SALE,
      id: 3,
      action: SAVED_ACTION,
      queue: [queued(1, FAILED)],
    }

    const showing = flashReducer(armed, { type: 'locationChanged', key: 'b' })

    expect(showing).toEqual({
      status: 'showing',
      shownKey: 'b',
      message: SALE,
      id: 3,
      action: SAVED_ACTION,
      queue: [queued(1, FAILED)],
    })
  })

  test('armed with a waiting result: expired and dismissed leave it as it is', () => {
    const armed: FlashState = {
      status: 'armed',
      originKey: 'a',
      message: SALE,
      id: 3,
      queue: [queued(1, FAILED)],
    }

    expect(flashReducer(armed, { type: 'expired' })).toBe(armed)
    expect(flashReducer(armed, { type: 'dismissed' })).toBe(armed)
    expect(flashReducer(armed, { type: 'locationChanged', key: 'a' })).toBe(armed)
  })

  test('armed: a new armAfterLeaving replaces the armed toast and keeps the queue', () => {
    const armed: FlashState = {
      status: 'armed',
      originKey: 'a',
      message: SALE,
      id: 3,
      queue: [queued(1, FAILED)],
    }

    const next = flashReducer(armed, {
      type: 'armAfterLeaving',
      message: { kind: 'saleSaved', name: 'Bo' },
      id: 4,
      currentKey: 'a',
    })

    expect(next).toEqual({
      status: 'armed',
      originKey: 'a',
      message: { kind: 'saleSaved', name: 'Bo' },
      id: 4,
      queue: [queued(1, FAILED)],
    })
  })

  test('armed with a button: an action-less showNow joins the queue instead of replacing it', () => {
    const armed: FlashState = {
      status: 'armed',
      originKey: 'a',
      message: SALE,
      id: 3,
      action: SAVED_ACTION,
    }

    const next = flashReducer(armed, {
      type: 'showNow',
      message: DELETED,
      id: 4,
      currentKey: 'a',
    })

    expect(next).toEqual({ ...armed, queue: [queued(4)] })
  })

  test('armed without button, attention or queue: showNow replaces it as before', () => {
    const armed: FlashState = {
      status: 'armed',
      originKey: 'a',
      message: TEXT,
      id: 1,
    }

    const next = flashReducer(armed, {
      type: 'showNow',
      message: 'Expense deleted',
      id: 2,
      currentKey: 'a',
    })

    expect(next).toEqual({
      status: 'showing',
      shownKey: 'a',
      message: { kind: 'text', text: 'Expense deleted' },
      id: 2,
    })
  })

  test('showing with a button: an action-less showNow joins the queue and the toast stays', () => {
    const showing: FlashState = {
      status: 'showing',
      shownKey: 'b',
      message: SALE,
      id: 3,
      action: SAVED_ACTION,
    }

    const next = flashReducer(showing, {
      type: 'showNow',
      message: DELETED,
      id: 4,
      currentKey: 'b',
    })

    expect(next).toEqual({ ...showing, queue: [queued(4)] })
  })

  test('showing an attention result: showNow never replaces it, even with a button of its own', () => {
    const showing: FlashState = {
      status: 'showing',
      shownKey: 'b',
      message: FAILED,
      id: 3,
    }

    const plain = flashReducer(showing, {
      type: 'showNow',
      message: 'Expense saved',
      id: 4,
      currentKey: 'b',
    })
    const withButton = flashReducer(plain, {
      type: 'showNow',
      message: SALE,
      id: 5,
      action: SAVED_ACTION,
      currentKey: 'b',
    })

    expect(withButton).toEqual({
      ...showing,
      queue: [queued(4, TEXT), { message: SALE, id: 5, action: SAVED_ACTION }],
    })
  })

  test('results queue first in first out: failed, then deleted, release failed first, each with its id', () => {
    const showing: FlashState = {
      status: 'showing',
      shownKey: 'b',
      message: SALE,
      id: 3,
      action: SAVED_ACTION,
    }
    const withFailed = flashReducer(showing, {
      type: 'showNow',
      message: FAILED,
      id: 4,
      currentKey: 'b',
    })
    const withBoth = flashReducer(withFailed, {
      type: 'showNow',
      message: DELETED,
      id: 5,
      durationMs: 900,
      currentKey: 'b',
    })

    const first = flashReducer(withBoth, { type: 'expired' })
    expect(first).toEqual({
      status: 'showing',
      shownKey: 'b',
      message: FAILED,
      id: 4,
      queue: [{ message: DELETED, id: 5, durationMs: 900 }],
    })

    const second = flashReducer(first, { type: 'expired' })
    expect(second).toEqual({
      status: 'showing',
      shownKey: 'b',
      message: DELETED,
      id: 5,
      durationMs: 900,
    })
    expect(flashReducer(second, { type: 'expired' })).toEqual(idle)
  })

  test('showing with a queue: dismissed releases the head, and so does leaving, on the new key', () => {
    const showing: FlashState = {
      status: 'showing',
      shownKey: 'b',
      message: SALE,
      id: 3,
      action: SAVED_ACTION,
      queue: [queued(4, FAILED)],
    }
    const released = { status: 'showing', message: FAILED, id: 4 }

    expect(flashReducer(showing, { type: 'dismissed' })).toEqual({
      ...released,
      shownKey: 'b',
    })
    expect(flashReducer(showing, { type: 'locationChanged', key: 'c' })).toEqual({ ...released, shownKey: 'c' })
  })

  test('showing with a queue: a followed redirect only moves the key and keeps the queue', () => {
    const showing: FlashState = {
      status: 'showing',
      shownKey: 'b',
      message: FAILED,
      id: 3,
      queue: [queued(4)],
    }

    const followed = flashReducer(showing, {
      type: 'locationChanged',
      key: 'c',
      follows: true,
    })

    expect(followed).toEqual({ ...showing, shownKey: 'c' })
  })

  test('showing with a button and an empty queue: the end of it is idle', () => {
    const showing: FlashState = {
      status: 'showing',
      shownKey: 'b',
      message: SALE,
      id: 3,
      action: SAVED_ACTION,
    }

    expect(flashReducer(showing, { type: 'expired' })).toEqual(idle)
    expect(flashReducer(showing, { type: 'dismissed' })).toEqual(idle)
    expect(flashReducer(showing, { type: 'locationChanged', key: 'c' })).toEqual(idle)
  })

  test('showing a protected toast: armAfterLeaving does not replace it; the armed one shows when the seller leaves', () => {
    const showing: FlashState = {
      status: 'showing',
      shownKey: 'b',
      message: FAILED,
      id: 3,
      queue: [queued(4)],
    }

    const arming = flashReducer(showing, {
      type: 'armAfterLeaving',
      message: SALE,
      id: 5,
      action: SAVED_ACTION,
      currentKey: 'b',
    })

    expect(arming).toMatchObject({
      status: 'showing',
      message: FAILED,
      id: 3,
      queue: [queued(4)],
    })
    expect(flashReducer(arming, { type: 'locationChanged', key: 'c' })).toEqual({
      status: 'showing',
      shownKey: 'c',
      message: SALE,
      id: 5,
      action: SAVED_ACTION,
      queue: [queued(4)],
    })
  })

  test('a protected toast armed over ends by itself: the queue goes first, then the armed one waits for leaving', () => {
    const showing: FlashState = {
      status: 'showing',
      shownKey: 'b',
      message: FAILED,
      id: 3,
    }
    const arming = flashReducer(showing, {
      type: 'armAfterLeaving',
      message: SALE,
      id: 5,
      currentKey: 'b',
    })

    expect(flashReducer(arming, { type: 'expired' })).toEqual({
      status: 'armed',
      originKey: 'b',
      message: SALE,
      id: 5,
    })
    const withQueue = flashReducer(arming, {
      type: 'showNow',
      message: DELETED,
      id: 6,
      currentKey: 'b',
    })
    expect(flashReducer(withQueue, { type: 'expired' })).toMatchObject({
      status: 'showing',
      message: DELETED,
      id: 6,
    })
  })

  test('showing an action-less text toast with an empty queue: armAfterLeaving and showNow behave as today', () => {
    const showing: FlashState = {
      status: 'showing',
      shownKey: 'b',
      message: TEXT,
      id: 1,
    }

    expect(
      flashReducer(showing, {
        type: 'showNow',
        message: 'Expense deleted',
        id: 2,
        currentKey: 'b',
      }),
    ).toEqual({
      status: 'showing',
      shownKey: 'b',
      message: { kind: 'text', text: 'Expense deleted' },
      id: 2,
    })
    expect(
      flashReducer(showing, {
        type: 'armAfterLeaving',
        message: 'Expense deleted',
        id: 2,
        currentKey: 'b',
      }),
    ).toEqual({
      status: 'armed',
      originKey: 'b',
      message: { kind: 'text', text: 'Expense deleted' },
      id: 2,
    })
  })

  test('the queue never loses an attention result to a replacing call', () => {
    const showing: FlashState = {
      status: 'showing',
      shownKey: 'b',
      message: SALE,
      id: 1,
      action: SAVED_ACTION,
      queue: [queued(2, OFFLINE)],
    }
    const armed = flashReducer(showing, {
      type: 'armAfterLeaving',
      message: SALE,
      id: 3,
      action: SAVED_ACTION,
      currentKey: 'b',
    })
    const left = flashReducer(armed, { type: 'locationChanged', key: 'c' })

    expect(left).toMatchObject({
      message: SALE,
      id: 3,
      queue: [queued(2, OFFLINE)],
    })
  })

  test('holdsAttention is true only for the offline and failed results', () => {
    expect(holdsAttention(FAILED)).toBe(true)
    expect(holdsAttention(OFFLINE)).toBe(true)
    expect(holdsAttention(DELETED)).toBe(false)
    expect(holdsAttention({ kind: 'undoResult', result: 'gone' })).toBe(false)
    expect(holdsAttention(TEXT)).toBe(false)
    expect(holdsAttention(SALE)).toBe(false)
  })
})
