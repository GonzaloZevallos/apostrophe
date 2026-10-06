/**
 * "Back by history, or else the fixed parent" for a card or a form opened from another
 * screen: with an entry behind this one (`location.key !== 'default'`) it goes back, so
 * the seller lands where they came from; a typed address, a bookmark or a reload has none,
 * so it goes to `fallback` with `replace` and the entry that is left does not stay behind.
 * `ExpenseNewRoute` decides the same way.
 */

import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router'

export function useHistoryBack(fallback: string): () => void {
  const navigate = useNavigate()
  const location = useLocation()
  const hasHistory = location.key !== 'default'
  return useCallback(() => {
    if (hasHistory) void navigate(-1)
    else void navigate(fallback, { replace: true })
  }, [navigate, hasHistory, fallback])
}
