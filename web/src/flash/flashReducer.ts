/**
 * The flash toast's state machine (plan, "Flash toast"): a success toast that must
 * survive `navigate(-1)`. One state value, not two booleans:
 *
 * - `idle`: nothing to show.
 * - `armed`: set on `originKey`, waiting for the router to leave that location.
 * - `showing`: on screen on `shownKey`; moving to another location dismisses it.
 *
 * Pure: the provider feeds it the router's `location.key` and the id of each toast.
 */

/** The history state of a redirect that replaces the screen a toast was armed for with the
 * screen the seller meant (Variedades' first variety on a computer): the toast follows it. */
export const FOLLOWED_REDIRECT = { flashFollows: true } as const

import type { SuccessToast } from '../components/AvisoExito'

/** What a caller may raise: a bare string of the closed union, or a kind with its own parts. */
export type FlashMessage = SuccessToast | { kind: 'saleSaved'; name: string }

/** What the reducer holds: a bare string is always `{ kind: 'text' }`, so no caller changes. */
export type StoredMessage = { kind: 'text'; text: SuccessToast } | { kind: 'saleSaved'; name: string }

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

export type FlashState =
  | { status: 'idle' }
  | ({ status: 'armed'; originKey: string } & Carried)
  | ({ status: 'showing'; shownKey: string } & Carried)

/** `id` is stamped by the provider (a counter), which keeps the reducer pure. */
type Raise = FlashOptions & { message: FlashMessage; id: number; currentKey: string }

export type FlashEvent =
  | ({ type: 'armAfterLeaving' } & Raise)
  | ({ type: 'showNow' } & Raise)
  | { type: 'locationChanged'; key: string; follows?: boolean }
  | { type: 'expired' }
  | { type: 'dismissed' }

/** The toast's own parts; an absent duration or action stays absent, not `undefined`. */
function carry({
  message,
  id,
  durationMs,
  action,
}: FlashOptions & { message: FlashMessage | StoredMessage; id: number }): Carried {
  const stored: StoredMessage = typeof message === 'string' ? { kind: 'text', text: message } : message
  return {
    message: stored,
    id,
    ...(durationMs === undefined ? {} : { durationMs }),
    ...(action === undefined ? {} : { action }),
  }
}

export function flashReducer(state: FlashState, event: FlashEvent): FlashState {
  switch (event.type) {
    case 'armAfterLeaving':
      return { status: 'armed', originKey: event.currentKey, ...carry(event) }
    case 'showNow':
      return { status: 'showing', shownKey: event.currentKey, ...carry(event) }
    case 'locationChanged':
      if (state.status === 'armed' && event.key !== state.originKey) {
        return { status: 'showing', shownKey: event.key, ...carry(state) }
      }
      if (state.status === 'showing' && event.key !== state.shownKey) {
        // A redirect the router made on the toast's own behalf (`FOLLOWED_REDIRECT`) is not the
        // seller leaving: the toast moves to the entry the redirect replaced it with.
        if (event.follows === true) return { ...state, shownKey: event.key }
        return { status: 'idle' }
      }
      return state
    case 'expired':
      return state.status === 'showing' ? { status: 'idle' } : state
    case 'dismissed':
      return { status: 'idle' }
  }
}
