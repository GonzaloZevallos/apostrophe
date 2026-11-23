/**
 * Whether Settings search is open is a history entry's `state.settingsSearch` flag, not a sheet:
 * it has no depth, no scroll lock, no inert background and no Close (ADR
 * 20261123-settings-search-is-a-history-entry-flag-not-a-sheet). This hook is the only reader and
 * writer of that flag.
 *
 * `open()` always pushes one entry, so a flagged entry has the app behind it, and `close()` pops it.
 * Both read the router's current location when they are called, never a captured value or a ref: a
 * pop the router already did is seen at once. On mount an entry that carries the flag (a reload, a
 * back from another screen) is replaced by the same entry without it, so search shows closed.
 */

import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useRouterHandle } from '../../components/useSheetStack'

const FLAG = 'settingsSearch'

/** Whether a history state carries the search flag. */
export function isSettingsSearchState(state: unknown): boolean {
  return typeof state === 'object' && state !== null && FLAG in state && state[FLAG] === true
}

function stateObject(state: unknown): Record<string, unknown> {
  return typeof state === 'object' && state !== null ? { ...state } : {}
}

export function useSettingsSearchEntry(): {
  readonly isOpen: boolean
  readonly open: () => void
  readonly close: () => void
} {
  const router = useRouterHandle()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const { pathname, search, hash, state } = router.state.location
    if (!isSettingsSearchState(state)) return
    const rest = stateObject(state)
    delete rest[FLAG]
    void navigate({ pathname, search, hash }, { replace: true, state: rest })
  }, [router, navigate])

  const open = () => {
    const { pathname, search, hash, state } = router.state.location
    if (isSettingsSearchState(state)) return
    void navigate({ pathname, search, hash }, { state: { ...stateObject(state), [FLAG]: true } })
  }

  const close = () => {
    if (isSettingsSearchState(router.state.location.state)) void navigate(-1)
  }

  return { isOpen: isSettingsSearchState(location.state), open, close }
}
