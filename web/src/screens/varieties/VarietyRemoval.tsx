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
import ConfirmDialog from '../../components/ConfirmDialog'
import ErrorGenerico from '../../components/ErrorGenerico'
import GoneNotice from '../../components/GoneNotice'
import SinConexion from '../../components/SinConexion'
import { useIsComputer } from '../../components/useIsComputer'
import { useFlash } from '../../flash/useFlash'
import { formatGrams } from '../../format/money'
import { VARIETIES, VARIETY } from '../../routes'
import type { Variety } from '../Variedades'
import { varietiesByName } from './varietiesByName'

const HAS_HISTORY_CODE = 'variety.has_history'

/** The detail line of the archive confirmation: the grams on hand when there are any. */
function archiveDetail(grams: number | null): string {
  const tail = 'dejan de verse en Inicio y en las listas, pero el stock queda guardado.'
  if (grams === null || grams === 0) return `Si la archivás, ${tail}`
  if (grams < 0) return `Tiene un faltante de ${formatGrams(-grams)}. Si la archivás, ${tail}`
  return `Te quedan ${formatGrams(grams)}. Si la archivás, ${tail}`
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
  const computer = useIsComputer()
  const [asking, setAsking] = useState(false)
  const [sending, setSending] = useState(false)
  const [gone, setGone] = useState(false)
  const [offline, setOffline] = useState(false)
  const [failed, setFailed] = useState(false)

  if (removal === null) return null

  function leave(): void {
    const list = queryClient.getQueryData<Variety[]>(keys.varieties())
    const next = computer && list !== undefined ? neighbourOf(list, varietyId) : null
    if (list !== undefined) {
      queryClient.setQueryData(
        keys.varieties(),
        list.filter((variety) => variety.id !== varietyId),
      )
    }
    flash.armAfterLeaving(removal === 'delete' ? 'Variedad eliminada' : 'Variedad archivada')
    void navigate(next === null ? VARIETIES : VARIETY(next), { replace: true })
    invalidateResource(queryClient, 'varieties')
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
        <button type="button" className="boton boton--suave" onClick={() => setAsking(true)}>
          {deleting ? 'Eliminar variedad' : 'Archivar variedad'}
        </button>
      </div>
      {asking && (
        <ConfirmDialog
          title={deleting ? '¿Eliminás esta variedad?' : '¿Archivás esta variedad?'}
          detail={
            deleting
              ? 'No tiene ventas ni entradas. Se borra para siempre, con sus precios. Esto no se puede deshacer.'
              : archiveDetail(grams)
          }
          confirmText={deleting ? 'Sí, eliminala' : 'Sí, archivala'}
          cancelText="No, dejala"
          onConfirm={() => {
            if (!sending) void onConfirm()
          }}
          onCancel={() => setAsking(false)}
        />
      )}
    </>
  )
}
