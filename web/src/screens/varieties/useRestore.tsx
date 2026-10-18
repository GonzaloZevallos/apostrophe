/**
 * "Restaurar" (`varieties.md`, "Archivadas"): one tap, no confirmation. On success the
 * toast "Variedad restaurada" shows where the seller is (no name, no amount) and the live
 * and archived lists, the stock and the catalog are read again. A variety that is gone
 * shows the generic gone notice; offline and any other failure keep their own notices.
 * Shared by the Archivadas card's rows and the archived variety's page.
 *
 * `restoreFromPage` is the page's own restore (ADR-0032 amendment): it never turns the page
 * into the live variety. In order: the restore, the landing (`restoreLanding`, the only code
 * that picks one), the restored id dropped from the cached archived lists, the toast armed to
 * show on the next location, the navigation, and last the invalidation with `refetchType:
 * 'none'`, so nothing mounted is read again before the page is gone.
 */

import { useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router'
import { ApiError, NetworkError } from '../../api/client'
import type { ArchivedAttributes } from '../../api/catalog'
import { invalidateResource, keys } from '../../api/keys'
import { isGone } from '../../api/refusals'
import { restoreVariety } from '../../api/varieties'
import ErrorGenerico from '../../components/ErrorGenerico'
import GoneNotice from '../../components/GoneNotice'
import SinConexion from '../../components/SinConexion'
import { inAppState } from '../../components/inAppState'
import { useBackOr } from '../../components/useBackOr'
import { useFlash } from '../../flash/useFlash'
import { VARIETY_RESTORED } from '../../copy/varieties'
import { ARCHIVED_VARIETIES, VARIETIES, VARIETY, pathTo } from '../../routes'
import { useViewport } from '../../shell/useViewport'
import type { Variety } from '../Variedades'
import { restoreLanding, type Landing } from './restoreLanding'

type Problem = 'gone' | 'offline' | 'failed'

export function useRestore(): {
  restore: (varietyId: number) => Promise<void>
  restoreFromPage: (varietyId: number) => Promise<void>
  sending: boolean
  notice: ReactNode
} {
  const queryClient = useQueryClient()
  const flash = useFlash()
  const navigate = useNavigate()
  const location = useLocation()
  const computer = useViewport() === 'computer'
  const backToArchived = useBackOr(ARCHIVED_VARIETIES)
  const [sending, setSending] = useState(false)
  const [problem, setProblem] = useState<Problem | null>(null)

  function refresh(): void {
    invalidateResource(queryClient, 'varieties')
    invalidateResource(queryClient, 'stock')
  }

  /** The one request: `onRestored` runs after it succeeded, every failure is a notice. */
  async function send(varietyId: number, onRestored: () => void): Promise<void> {
    if (sending) return
    setSending(true)
    setProblem(null)
    try {
      await restoreVariety(varietyId)
      onRestored()
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

  function restore(varietyId: number): Promise<void> {
    return send(varietyId, () => {
      flash.showNow(VARIETY_RESTORED)
      refresh()
    })
  }

  function leaveTo(landing: Landing): void {
    if (landing === 'unknown') {
      void navigate(ARCHIVED_VARIETIES, { replace: true })
    } else if (computer) {
      const target = landing === null ? VARIETIES : pathTo(VARIETY, { id: landing })
      void navigate(target, { replace: true, state: inAppState(location) })
    } else {
      backToArchived()
    }
  }

  function restoreFromPage(varietyId: number): Promise<void> {
    return send(varietyId, () => {
      const landing = restoreLanding(queryClient.getQueryData<Variety[]>(keys.archivedVarieties()), varietyId)
      queryClient.setQueryData<Variety[]>(keys.archivedVarieties(), (old) => old?.filter((variety) => variety.id !== varietyId))
      queryClient.setQueryData<ArchivedAttributes[]>(keys.archivedCatalog(), (old) =>
        old?.filter((attributes) => attributes.variety_id !== varietyId),
      )
      flash.armAfterLeaving(VARIETY_RESTORED)
      leaveTo(landing)
      invalidateResource(queryClient, 'varieties', { refetchType: 'none' })
      invalidateResource(queryClient, 'stock', { refetchType: 'none' })
    })
  }

  const notice =
    problem === 'gone' ? <GoneNotice /> : problem === 'offline' ? <SinConexion /> : problem === 'failed' ? <ErrorGenerico /> : null
  return { restore, restoreFromPage, sending, notice }
}
