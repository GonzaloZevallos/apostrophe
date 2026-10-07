/**
 * "Restaurar" (`varieties.md`, "Archivadas"): one tap, no confirmation. On success the
 * toast "Variedad restaurada" shows where the seller is (no name, no amount) and the live
 * and archived lists, the stock and the catalog are read again. A variety that is gone
 * shows the generic gone notice; offline and any other failure keep their own notices.
 * Shared by the Archivadas card's rows and the archived variety's page.
 */

import { useState, type ReactNode } from 'react'
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

export function useRestore(): {
  restore: (varietyId: number) => Promise<void>
  sending: boolean
  notice: ReactNode
} {
  const queryClient = useQueryClient()
  const flash = useFlash()
  const [sending, setSending] = useState(false)
  const [problem, setProblem] = useState<Problem | null>(null)

  function refresh(): void {
    invalidateResource(queryClient, 'varieties')
    invalidateResource(queryClient, 'stock')
  }

  async function restore(varietyId: number): Promise<void> {
    if (sending) return
    setSending(true)
    setProblem(null)
    try {
      await restoreVariety(varietyId)
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
      setSending(false)
    }
  }

  const notice =
    problem === 'gone' ? <GoneNotice /> : problem === 'offline' ? <SinConexion /> : problem === 'failed' ? <ErrorGenerico /> : null
  return { restore, sending, notice }
}
