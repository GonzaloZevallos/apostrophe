/**
 * The exit of a form or sheet whose record turned out to be gone: the same move as "Cerrar",
 * with the gone notice on the parent. When the entry behind is the parent (the entry's `from`,
 * normalised, equals the parent's filled pathname) it pops, so history never holds the parent
 * twice, and leaves the notice in `goneNotice`. Otherwise (a direct link, a reload that dropped
 * the state, an entry opened from elsewhere) it replaces the entry with the parent and carries
 * the notice in that entry's state. The viewport is read when the user leaves, because a
 * screen's parent can differ between phone and computer.
 */

import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { type ScreenId, parentOf, pathTo } from '../routes'
import { currentViewport } from '../shell/useViewport'
import { gone } from './feedback'
import { markGone } from './goneNotice'

/** A pathname without its query, hash and one trailing slash (the root stays `/`). */
export function normalisePath(path: string): string {
  const bare = path.replace(/[?#].*$/, '')
  return bare.length > 1 && bare.endsWith('/') ? bare.slice(0, -1) : bare
}

function fromOf(state: unknown): string | null {
  if (typeof state !== 'object' || state === null || !('from' in state)) return null
  return typeof state.from === 'string' ? state.from : null
}

export function useGoneExit(
  screenId: ScreenId,
  params: Readonly<Record<string, string | number>> = {},
): () => void {
  const navigate = useNavigate()
  const location = useLocation()
  const id = params.id
  return useCallback(() => {
    const parent = parentOf(screenId, currentViewport())
    if (parent === undefined) throw new Error(`useGoneExit: ${screenId} has no parent`)
    const target = pathTo(parent.path, id === undefined ? {} : { id })
    const from = fromOf(location.state)
    if (from !== null && normalisePath(from) === target) {
      markGone(target, location.key)
      void navigate(-1)
    } else {
      void navigate(target, { replace: true, state: gone() })
    }
  }, [navigate, location, screenId, id])
}
