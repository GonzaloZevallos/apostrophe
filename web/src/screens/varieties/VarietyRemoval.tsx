/**
 * The one removal action of a live variety's page (`varieties.md`, "Deleting and archiving"):
 * "Eliminar variedad" through a destructive confirmation when `GET /varieties/{id}` says
 * `delete`, "Archivar variedad" through a confirmation when it says `archive`, and nothing
 * for any other answer. The page never decides which: `removal` is the server's, worked out
 * from history when the page was read.
 *
 * A stale page can still meet `variety.has_history` on delete: the dialog closes and the
 * page is read again, so it then offers "Archivar variedad" (no toast). A variety that is
 * gone or already archived closes the dialog, refreshes the lists and says the generic gone
 * notice. Toasts and dialogs carry no name; the grams on hand are the stock row's own.
 *
 * On success the page leaves: a phone returns to Variedades; a computer selects the next
 * variety by name, else the previous one, else shows Variedades with no selection.
 */

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { ApiError, NetworkError } from '../../api/client'
import { invalidateResource, keys } from '../../api/keys'
import { isGone } from '../../api/refusals'
import { archiveVariety, deleteVariety, type Removal } from '../../api/varieties'
import Boton from '../../components/Boton'
import ConfirmDialog from '../../components/ConfirmDialog'
import ErrorGenerico from '../../components/ErrorGenerico'
import GoneNotice from '../../components/GoneNotice'
import SinConexion from '../../components/SinConexion'
import { useFlash } from '../../flash/useFlash'
import { formatGrams } from '../../format/money'
import { VARIETIES, VARIETY, pathTo } from '../../routes'
import { useViewport } from '../../shell/useViewport'
import type { Variety } from '../Variedades'
import { varietiesByName } from './varietiesByName'
import { VARIETIES_TEXT } from '../../copy/varieties'
import { COMMON_TEXT } from '../../copy/common'

const HAS_HISTORY_CODE = 'variety.has_history'

/** The detail line of the archive confirmation: the grams on hand when there are any. */
function archiveDetail(grams: number | null): string {
  const tail = VARIETIES_TEXT.dejanDeVerseEn
  if (grams === null || grams === 0) return VARIETIES_TEXT.siLaArchivas0(tail)
  if (grams < 0) return VARIETIES_TEXT.tieneUnFaltanteDe(formatGrams(-grams), tail)
  return VARIETIES_TEXT.teQuedan0Si(formatGrams(grams), tail)
}

/** Where a computer goes once `varietyId` leaves the list: the next by name, else the
 * previous one, else the list with nothing selected. */
function neighbourOf(list: readonly Variety[], varietyId: number): number | null {
  const ordered = varietiesByName(list)
  const at = ordered.findIndex((variety) => variety.id === varietyId)
  if (at === -1) return null
  return (ordered[at + 1] ?? ordered[at - 1])?.id ?? null
}

interface Props {
  varietyId: number
  removal: Removal | null
  /** The grams on hand from `GET /stock`, or `null` while that row is not there. */
  grams: number | null
}

export default function VarietyRemoval({ varietyId, removal, grams }: Props) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const flash = useFlash()
  const computer = useViewport() === 'computer'
  const [asking, setAsking] = useState(false)
  const [sending, setSending] = useState(false)
  const [gone, setGone] = useState(false)
  const [offline, setOffline] = useState(false)
  const [failed, setFailed] = useState(false)

  if (removal !== 'delete' && removal !== 'archive') return null

  function leave(): void {
    const list = queryClient.getQueryData<Variety[]>(keys.varieties())
    const next = computer && list !== undefined ? neighbourOf(list, varietyId) : null
    if (list !== undefined) {
      queryClient.setQueryData(
        keys.varieties(),
        list.filter((variety) => variety.id !== varietyId),
      )
    }
    flash.armAfterLeaving(removal === 'delete' ? VARIETIES_TEXT.variedadEliminada : VARIETIES_TEXT.variedadArchivada)
    void navigate(next === null ? VARIETIES : pathTo(VARIETY, { id: next }), { replace: true })
    // Mark stale without refetching now: the page still mounted would read the variety it
    // just deleted, a 404 the browser writes to its console (`invalidateResource`'s note).
    invalidateResource(queryClient, 'varieties', { refetchType: 'none' })
    // The archived list is not the deleted page's own query: a mounted left pane ("Archivadas (N)")
    // reads it again now.
    if (removal === 'archive') void queryClient.invalidateQueries({ queryKey: keys.archivedVarieties() })
  }

  async function onConfirm(): Promise<void> {
    setSending(true)
    setOffline(false)
    setFailed(false)
    try {
      if (removal === 'delete') await deleteVariety(varietyId)
      else await archiveVariety(varietyId)
      leave()
    } catch (caught) {
      setAsking(false)
      if (caught instanceof ApiError && caught.code === HAS_HISTORY_CODE) {
        invalidateResource(queryClient, 'varieties')
      } else if (caught instanceof ApiError && isGone(caught.code)) {
        invalidateResource(queryClient, 'varieties')
        setGone(true)
      } else if (caught instanceof NetworkError) {
        setOffline(true)
      } else {
        setFailed(true)
      }
    } finally {
      setSending(false)
    }
  }

  const deleting = removal === 'delete'
  return (
    <>
      {gone && <GoneNotice />}
      {offline && <SinConexion />}
      {failed && <ErrorGenerico />}
      <div className="variedad-retiro">
        {deleting ? (
          <Boton variant="critical" icon="tacho" onClick={() => setAsking(true)}>
            {VARIETIES_TEXT.eliminarVariedad}
          </Boton>
        ) : (
          <Boton variant="secondary" icon="archivar" onClick={() => setAsking(true)}>
            {VARIETIES_TEXT.archivarVariedad}
          </Boton>
        )}
      </div>
      {asking && (
        <ConfirmDialog
          title={deleting ? VARIETIES_TEXT.eliminasEstaVariedad : VARIETIES_TEXT.archivasEstaVariedad}
          detail={
            deleting
              ? VARIETIES_TEXT.noTieneVentasNi
              : archiveDetail(grams)
          }
          confirmText={deleting ? VARIETIES_TEXT.siEliminala : VARIETIES_TEXT.siArchivala}
          cancelText={COMMON_TEXT.noDejala}
          onConfirm={() => {
            if (!sending) void onConfirm()
          }}
          onCancel={() => setAsking(false)}
        />
      )}
    </>
  )
}
