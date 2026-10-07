/**
 * `VariedadMovimientos` (`/variedades/:id/movimientos`, "Ver todas" under "Stock y
 * entradas", `stock.md`): every stock entry and every withdrawal that touches one variety,
 * newest date first, as `GET /stock/varieties/{id}/movements` answers them. A detail under
 * the navigation rule: the bar or sidebar, a "‹" back to the variety's page, no "+ Nueva
 * venta". It is one variety's list: there is no business-wide list of withdrawals.
 */

import { useQuery } from '@tanstack/react-query'
import { useLocation, useNavigate, useParams } from 'react-router'
import { ApiError, NetworkError, get } from '../api/client'
import { keys } from '../api/keys'
import { isGone } from '../api/refusals'
import { readMovements } from '../api/stock'
import ErrorGenerico from '../components/ErrorGenerico'
import GoneScreen from '../components/GoneScreen'
import Loading from '../components/Loading'
import SinConexion from '../components/SinConexion'
import MovementRows from './MovementRows'
import type { Variety } from './Variedades'

const VARIETIES = '/variedades'

export default function VariedadMovimientos() {
  const { id } = useParams<{ id: string }>()
  const varietyId = id ?? ''
  const navigate = useNavigate()
  const location = useLocation()
  const movementsQuery = useQuery({
    queryKey: keys.stockMovements(varietyId),
    queryFn: () => readMovements(varietyId),
    retry: false,
  })
  const varietyQuery = useQuery({
    queryKey: keys.variety(varietyId),
    queryFn: () => get<Variety>(`/varieties/${varietyId}`),
    retry: false,
  })

  function back(): void {
    if (location.key === 'default') void navigate(`${VARIETIES}/${varietyId}`, { replace: true })
    else void navigate(-1)
  }

  const failure = movementsQuery.error ?? varietyQuery.error
  if (failure !== null) {
    if (failure instanceof ApiError && isGone(failure.code)) {
      return <GoneScreen label="Variedades" to={VARIETIES} />
    }
    return (
      <main className="pantalla">
        <div className="cuerpo">
          {failure instanceof NetworkError ? <SinConexion /> : <ErrorGenerico />}
        </div>
      </main>
    )
  }
  if (movementsQuery.data === undefined || varietyQuery.data === undefined) {
    return (
      <main className="pantalla">
        <div className="cuerpo">
          <Loading />
        </div>
      </main>
    )
  }

  return (
    <main className="pantalla">
      <div className="cuerpo">
        <div className="encabezado-fila">
          <button type="button" className="boton-icono" aria-label="Volver" onClick={back}>
            ‹
          </button>
          <span className="encabezado__titulo">{varietyQuery.data.name}</span>
        </div>
        <span className="campo__rotulo">Stock y entradas</span>
        <MovementRows movements={movementsQuery.data} />
      </div>
    </main>
  )
}
