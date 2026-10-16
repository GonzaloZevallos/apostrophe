/**
 * "Restaurar" (`varieties.md`, "Archivadas"): one tap, no confirmation. On success the
 * toast "Variedad restaurada" shows where the seller is (no name, no amount) and the live
 * and archived lists, the stock and the catalog are read again. A variety that is gone
 * shows the generic gone notice; offline and any other failure keep their own notices.
 * Shared by the Archivadas card's rows and the archived variety's page. A caller that must
 * move the seller somewhere once the variety is restored passes `onRestored(id)`: it runs
 * after the restore answers, before the toast and the refresh.
 */

import { useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ApiError, NetworkError } from '../../api/client'
import { invalidateResource } from '../../api/keys'
import { isGone } from '../../api/refusals'
import { restoreVariety } from '../../api/varieties'
import ErrorGenerico from '../../components/ErrorGenerico'
import GoneNotice from '../../components/GoneNotice'
import SinConexion from '../../components/SinConexion'
import { useFlash } from '../../flash/useFlash'

type Problem = 'gone' | 'offline' | 'failed'

export function useRestore(onRestored?: (varietyId: number) => void): {
  restore: (varietyId: number) => Promise<void>
  sending: boolean
  notice: ReactNode
} {
  const queryClient = useQueryClient()
  const flash = useFlash()
  const [sending, setSending] = useState(false)
  // A ref as well: two taps in one tick both read the state before it re-renders.
  const inFlight = useRef(false)
  const [problem, setProblem] = useState<Problem | null>(null)

  function refresh(): void {
    invalidateResource(queryClient, 'varieties')
    invalidateResource(queryClient, 'stock')
  }

  async function restore(varietyId: number): Promise<void> {
    if (inFlight.current) return
    inFlight.current = true
    setSending(true)
    setProblem(null)
    try {
      await restoreVariety(varietyId)
      onRestored?.(varietyId)
      flash.showNow('Variedad restaurada')
      refresh()
    } catch (caught) {
      if (caught instanceof ApiError && isGone(caught.code)) {
        refresh()
        setProblem('gone')
      } else if (caught instanceof NetworkError) {
        setProblem('offline')
      } else {
        setProblem('failed')
      }
    } finally {
      inFlight.current = false
      setSending(false)
    }
  }

  const notice =
    problem === 'gone' ? <GoneNotice /> : problem === 'offline' ? <SinConexion /> : problem === 'failed' ? <ErrorGenerico /> : null
  return { restore, sending, notice }
}
