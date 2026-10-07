/**
 * `WithdrawalDetail` (`/withdrawals/:id`, `RetiroDetalle`): a detail under the navigation
 * rule, with the bar or sidebar and a "‹" back to the variety's page it was opened from
 * (Variedades with no history to go back to), and no "+ Nueva venta" (the route's
 * `chrome: 'card'`). It shows the date, the reason by word, every line and the note, with
 * "Editar" (the same form, filled in) and "Borrar" ("Antes de borrar", naming the reason,
 * the date and the total grams: `stock.md`).
 *
 * A withdrawal that is gone shows "Eso ya no está." with "Volver a Variedades"; a delete
 * that finds it gone goes to Variedades with "Eso ya no está. La lista ya está al día."
 */

import { type QueryClient, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useLocation, useNavigate, useOutletContext, useParams } from 'react-router'
import { ApiError, NetworkError } from '../../api/client'
import { keys } from '../../api/keys'
import type { Me } from '../../api/me'
import { isGone } from '../../api/refusals'
import { deleteWithdrawal, getWithdrawal } from '../../api/stock'
import ConfirmDialog from '../../components/ConfirmDialog'
import ErrorGenerico, { ERROR_GENERICO_MENSAJE } from '../../components/ErrorGenerico'
import GoneScreen from '../../components/GoneScreen'
import Loading from '../../components/Loading'
import SinConexion from '../../components/SinConexion'
import { gone } from '../../components/feedback'
import { useFlash } from '../../flash/useFlash'
import { formatDate } from '../../format/dates'
import { formatGrams } from '../../format/money'
import { VARIETIES, withdrawalEditPath } from '../../routes'
import { REASON_OPTIONS } from './withdrawalReasons'


/** A deleted withdrawal's own query shares the `'stock'` prefix every other stock figure
 * is refreshed through. A plain invalidation would refetch it while the detail is still
 * mounted (the moment before `navigate` unmounts it) and the browser would log the 404
 * (the e2e run asserts a silent console). This marks that one query stale without
 * refetching it, and refreshes every other `'stock'` query as usual. */
function invalidateStockAfterDeleting(queryClient: QueryClient, id: string): void {
  queryClient.invalidateQueries({
    queryKey: keys.stockWithdrawal(id),
    exact: true,
    refetchType: 'none',
  })
  queryClient.invalidateQueries({
    predicate: (query) =>
      query.queryKey[0] === 'stock' && !(query.queryKey[1] === 'withdrawals' && query.queryKey[2] === id),
  })
}

export default function WithdrawalDetail() {
  const me = useOutletContext<Me>()
  const { id } = useParams<{ id: string }>()
  const withdrawalId = id ?? ''
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const flash = useFlash()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const query = useQuery({
    queryKey: keys.stockWithdrawal(withdrawalId),
    queryFn: () => getWithdrawal(withdrawalId),
    retry: false,
  })

  function back(): void {
    if (location.key === 'default') void navigate(VARIETIES, { replace: true })
    else void navigate(-1)
  }

  async function onConfirmDelete(): Promise<void> {
    setDeleting(true)
    setDeleteError(null)
    setOffline(false)
    try {
      await deleteWithdrawal(withdrawalId)
      invalidateStockAfterDeleting(queryClient, withdrawalId)
      flash.armAfterLeaving('Retiro eliminado')
      back()
    } catch (caught) {
      setConfirmingDelete(false)
      if (caught instanceof ApiError && isGone(caught.code)) {
        invalidateStockAfterDeleting(queryClient, withdrawalId)
        void navigate(VARIETIES, { replace: true, state: gone() })
      } else if (caught instanceof NetworkError) {
        setOffline(true)
      } else {
        setDeleteError(ERROR_GENERICO_MENSAJE)
      }
    } finally {
      setDeleting(false)
    }
  }

  if (query.isError) {
    if (query.error instanceof ApiError && isGone(query.error.code)) {
      return <GoneScreen label="Variedades" to={VARIETIES} />
    }
    return (
      <main className="pantalla">
        <div className="cuerpo">
          {query.error instanceof NetworkError ? <SinConexion /> : <ErrorGenerico />}
        </div>
      </main>
    )
  }
  if (query.data === undefined) {
    return (
      <main className="pantalla">
        <div className="cuerpo">
          <Loading />
        </div>
      </main>
    )
  }

  const withdrawal = query.data
  const reasonWord = REASON_OPTIONS.find((option) => option.value === withdrawal.reason)?.label ?? ''
  const date = formatDate(withdrawal.date, me.today)
  const confirmation =
    withdrawal.reason === 'promotion'
      ? `¿Borrás la promoción del ${date}? Vuelven ${formatGrams(withdrawal.total_grams)} al stock.`
      : `¿Borrás el consumo propio del ${date}? Vuelven ${formatGrams(withdrawal.total_grams)} al stock.`

  return (
    <main className="pantalla">
      <div className="cuerpo">
        <div className="encabezado-fila">
          <button type="button" className="boton-icono" aria-label="Volver" onClick={back}>
            ‹
          </button>
          <span className="encabezado__titulo">Retiro</span>
        </div>
        <dl className="retiro__datos">
          <div className="retiro__dato">
            <dt className="campo__rotulo">Motivo</dt>
            <dd>{reasonWord}</dd>
          </div>
          <div className="retiro__dato">
            <dt className="campo__rotulo">Fecha</dt>
            <dd>{date}</dd>
          </div>
        </dl>
        <ul className="retiro__lineas" aria-label="Variedades">
          {withdrawal.lines.map((line, index) => (
            // A variety may repeat in several lines with no merging: the position is the identity.
            <li key={index} className="retiro__linea">
              <span>{line.variety_name}</span>
              <span>{formatGrams(line.grams)}</span>
            </li>
          ))}
        </ul>
        {withdrawal.note !== null && (
          <div className="retiro__dato">
            <span className="campo__rotulo">Nota</span>
            <span>{withdrawal.note}</span>
          </div>
        )}
        {offline && <SinConexion />}
        {deleteError !== null && (
          <span className="campo__error" role="alert">
            {deleteError}
          </span>
        )}
        <div className="retiro__acciones">
          <Link className="boton" to={withdrawalEditPath(withdrawal.id)}>
            Editar
          </Link>
          <button type="button" className="boton boton--destructivo" onClick={() => setConfirmingDelete(true)}>
            Borrar
          </button>
        </div>
      </div>
      {confirmingDelete && (
        <ConfirmDialog
          title="Antes de borrar"
          detail={confirmation}
          confirmText="Sí, borralo"
          cancelText="No, dejalo"
          onConfirm={() => {
            if (!deleting) void onConfirmDelete()
          }}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </main>
  )
}
