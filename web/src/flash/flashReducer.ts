/**
 * The flash toast's state machine (plan, "Flash toast"): a success toast that must
 * survive `navigate(-1)`. One state value, not two booleans:
 *
 * - `idle`: nothing to show.
 * - `armed`: set on `originKey`, waiting for the router to leave that location.
 * - `showing`: on screen on `shownKey`; moving to another location dismisses it.
 *
 * A toast with a button, one that holds attention (a failed Undo) or one with others waiting is
 * never replaced: later `showNow` toasts wait in a first-in-first-out `queue` and show, each with
 * its own id and duration, when it ends; a toast armed meanwhile waits in `arming`.
 *
 * Pure: the provider feeds it the router's `location.key` and the id of each toast.
 */

/** The history state of a redirect that replaces the screen a toast was armed for with the
 * screen the seller meant (Variedades' first variety on a computer): the toast follows it. */
export const FOLLOWED_REDIRECT = { flashFollows: true } as const

import type { SuccessToast } from '../components/AvisoExito'

/** What an Undo ended in: the sale is deleted, was already gone, or the call did not go through. */
export type UndoResult = 'deleted' | 'gone' | 'offline' | 'failed'

type UndoResultMessage = { kind: 'undoResult'; result: UndoResult }

/** What a caller may raise: a bare string of the closed union, or a kind with its own parts. */
export type FlashMessage = SuccessToast | { kind: 'saleSaved'; name: string } | UndoResultMessage

/** What the reducer holds: a bare string is always `{ kind: 'text' }`, so no caller changes. */
export type StoredMessage = { kind: 'text'; text: SuccessToast } | { kind: 'saleSaved'; name: string } | UndoResultMessage

/** A button the toast offers; pressing it dismisses the toast, then calls `onPress`. */
export interface FlashAction {
  label: string
  onPress: () => void
}

/** Per-toast settings; absent, the toast lasts the default and has no button. */
export interface FlashOptions {
  durationMs?: number
  action?: FlashAction
}

/** What every state that holds a toast carries. `id` tells one toast from the next. */
interface Carried extends FlashOptions {
  message: StoredMessage
  id: number
}

/** Toasts that wait their turn, first in first out; absent means none. */
interface Waiting {
  queue?: Carried[]
}

type Armed = { status: 'armed'; originKey: string } & Carried & Waiting
type Showing = {
  status: 'showing'
  shownKey: string
  /** A toast armed while a protected one was on screen: it takes over when the seller leaves. */
  arming?: Carried & { originKey: string }
} & Carried &
  Waiting

export type FlashState = { status: 'idle' } | Armed | Showing

/** `id` is stamped by the provider (a counter), which keeps the reducer pure. */
type Raise = FlashOptions & {
  message: FlashMessage
  id: number
  currentKey: string
}

export type FlashEvent =
  | ({ type: 'armAfterLeaving' } & Raise)
  | ({ type: 'showNow' } & Raise)
  | { type: 'locationChanged'; key: string; follows?: boolean }
  | { type: 'expired' }
  | { type: 'dismissed' }

/** A result the seller must read: the Undo did not go through, so the sale is still saved. */
export function holdsAttention(message: StoredMessage): boolean {
  return message.kind === 'undoResult' && (message.result === 'offline' || message.result === 'failed')
}

/** The toast's own parts; an absent duration or action stays absent, not `undefined`. */
function carry({
  message,
  id,
  durationMs,
  action,
}: FlashOptions & {
  message: FlashMessage | StoredMessage
  id: number
}): Carried {
  const stored: StoredMessage = typeof message === 'string' ? { kind: 'text', text: message } : message
  return {
    message: stored,
    id,
    ...(durationMs === undefined ? {} : { durationMs }),
    ...(action === undefined ? {} : { action }),
  }
}

function waiting(queue: Carried[]): Waiting {
  return queue.length === 0 ? {} : { queue }
}

/** A toast that nothing may replace: it has a button, needs reading, or others wait behind it. */
function isProtected(state: Armed | Showing): boolean {
  return state.action !== undefined || holdsAttention(state.message) || (state.queue ?? []).length > 0
}

/** The showing toast ends: the toast armed for leaving takes over if the seller left, else the
 * first one waiting, else the one armed during it, else nothing. */
function finish(state: Showing, at: string, leaving: boolean): FlashState {
  const queue = state.queue ?? []
  if (leaving && state.arming !== undefined) {
    return {
      status: 'showing',
      shownKey: at,
      ...carry(state.arming),
      ...waiting(queue),
    }
  }
  const [head, ...rest] = queue
  if (head !== undefined) {
    return {
      status: 'showing',
      shownKey: at,
      ...carry(head),
      ...waiting(rest),
      ...(state.arming === undefined ? {} : { arming: state.arming }),
    }
  }
  if (state.arming !== undefined)
    return {
      status: 'armed',
      ...carry(state.arming),
      originKey: state.arming.originKey,
    }
  return { status: 'idle' }
}

export function flashReducer(state: FlashState, event: FlashEvent): FlashState {
  switch (event.type) {
    case 'armAfterLeaving':
      if (state.status === 'showing' && isProtected(state)) {
        return {
          ...state,
          arming: { ...carry(event), originKey: event.currentKey },
        }
      }
      return {
        status: 'armed',
        originKey: event.currentKey,
        ...carry(event),
        ...(state.status === 'idle' ? {} : waiting(state.queue ?? [])),
      }
    case 'showNow':
      if (state.status !== 'idle' && isProtected(state)) {
        return { ...state, queue: [...(state.queue ?? []), carry(event)] }
      }
      return {
        status: 'showing',
        shownKey: event.currentKey,
        ...carry(event),
        // A toast armed over a protected one that has since ended still waits for leaving.
        ...(state.status === 'showing' && state.arming !== undefined ? { arming: state.arming } : {}),
      }
    case 'locationChanged':
      if (state.status === 'armed' && event.key !== state.originKey) {
        return {
          status: 'showing',
          shownKey: event.key,
          ...carry(state),
          ...waiting(state.queue ?? []),
        }
      }
      if (state.status === 'showing' && event.key !== state.shownKey) {
        // A redirect the router made on the toast's own behalf (`FOLLOWED_REDIRECT`) is not the
        // seller leaving: the toast moves to the entry the redirect replaced it with.
        if (event.follows === true) return { ...state, shownKey: event.key }
        return finish(state, event.key, true)
      }
      return state
    case 'expired':
      return state.status === 'showing' ? finish(state, state.shownKey, false) : state
    case 'dismissed':
      if (state.status === 'showing') return finish(state, state.shownKey, false)
      // An armed toast with results waiting is not dropped: only a showing one is dismissed.
      if (state.status === 'armed' && (state.queue ?? []).length > 0) return state
      return { status: 'idle' }
  }
}
