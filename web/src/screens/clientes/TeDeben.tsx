/**
 * "Te deben" (`payments.md`, "On screen"): opened from the Clientes header,
 * every customer with a balance above $0, oldest debt first — the API's own
 * order (`GET /payments/debtors`), never resorted here. No search, no new tab,
 * no entry in `Más` (PRD, "Out of scope").
 */

import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { NetworkError } from '../../api/client'
import { keys } from '../../api/keys'
import { getDebtors } from '../../api/payments'
import ErrorGenerico from '../../components/ErrorGenerico'
import SinConexion from '../../components/SinConexion'
import { salesCount } from '../../format/counts'
import { formatDateShort } from '../../format/dates'
import { formatMoney } from '../../format/money'

export const EMPTY_LIST = 'Nadie te debe.'

export default function TeDeben() {
  const { data, isPending, isError, error } = useQuery({
    queryKey: keys.debtors(),
    queryFn: () => getDebtors(),
  })

  return (
    <main className="pantalla">
      <div className="cuerpo">
        <div>
          <Link to="/clientes">Volver</Link>
          <span className="encabezado__titulo">Te deben</span>
        </div>

        {isError && error instanceof NetworkError && <SinConexion />}
        {isError && !(error instanceof NetworkError) && <ErrorGenerico />}

        {!isError && !isPending && data !== undefined && (
          <>
            <div className="ventas__resumen">
              <span className="cifra-xl">{formatMoney(data.total_owed)}</span>
              <span className="rotulo">{`${salesCount(data.sales_owing_count)} debiendo`}</span>
            </div>

            {data.debtors.length === 0 && <span className="campo__rotulo">{EMPTY_LIST}</span>}

            <div className="lista-clientes">
              {data.debtors.map((debtor) => (
                <Link
                  key={debtor.customer.id}
                  to={`/clientes/${debtor.customer.id}`}
                  className="lista-clientes__fila"
                >
                  <span className="lista-clientes__nombre">{debtor.customer.name}</span>
                  <span className="monto-deuda">{formatMoney(debtor.balance)}</span>
                  {debtor.owing_since !== null && (
                    <span className="monto-deuda">{`desde ${formatDateShort(debtor.owing_since)}`}</span>
                  )}
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
