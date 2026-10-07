/**
 * The flash toast's state machine (plan, "Flash toast"): a success toast that must
 * survive `navigate(-1)`. One state value, not two booleans:
 *
 * - `idle`: nothing to show.
 * - `armed`: set on `originKey`, waiting for the router to leave that location.
 * - `showing`: on screen on `shownKey`; moving to another location dismisses it.
 *
 * Pure: the provider feeds it the router's `location.key`.
 */

import type { SuccessToast } from '../components/AvisoExito'

export type FlashState =
  | { status: 'idle' }
  | { status: 'armed'; originKey: string; toast: SuccessToast }
  | { status: 'showing'; toast: SuccessToast; shownKey: string }

export type FlashEvent =
  | { type: 'armAfterLeaving'; toast: SuccessToast; currentKey: string }
  | { type: 'showNow'; toast: SuccessToast; currentKey: string }
  | { type: 'locationChanged'; key: string; replaced?: boolean }
  | { type: 'expired' }

export function flashReducer(state: FlashState, event: FlashEvent): FlashState {
  switch (event.type) {
    case 'armAfterLeaving':
      return { status: 'armed', originKey: event.currentKey, toast: event.toast }
    case 'showNow':
      return { status: 'showing', toast: event.toast, shownKey: event.currentKey }
    case 'locationChanged':
      if (state.status === 'armed' && event.key !== state.originKey) {
        return { status: 'showing', toast: state.toast, shownKey: event.key }
      }
      if (state.status === 'showing' && event.key !== state.shownKey) {
        // A replace is a redirect settling the same screen (`<Navigate replace>`), not the user
        // moving on: the toast stays, on the new key. The next real navigation dismisses it.
        return event.replaced === true ? { ...state, shownKey: event.key } : { status: 'idle' }
      }
      return state
    case 'expired':
      return state.status === 'showing' ? { status: 'idle' } : state
  }
}
