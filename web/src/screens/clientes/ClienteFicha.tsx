/**
 * `ClienteFicha`: a customer's card — phone, channel and VIP, no balance, account
 * or payment yet (`customers.md`, "On screen"). A `gone` answer (another
 * business's id, or an old link) shows `GoneScreen`, never a 403 or a hint that a
 * record exists somewhere else (ADR-0004).
 */

import { useQuery } from '@tanstack/react-query'
import { Link, useLocation, useParams } from 'react-router'
import { ApiError, NetworkError } from '../../api/client'
import { type Channel, getCustomer } from '../../api/customers'
import { keys } from '../../api/keys'
import { isGone } from '../../api/refusals'
import { formatPhone } from '../../format/phone'
import ErrorGenerico from '../../components/ErrorGenerico'
import { newSaleFor, readFeedback } from '../../components/feedback'
import GoneScreen from '../../components/GoneScreen'
import Notice from '../../components/Notice'
import SinConexion from '../../components/SinConexion'

const CHANNEL_LABEL: Record<Channel, string> = {
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
}

export default function ClienteFicha() {
  const { id } = useParams<{ id: string }>()
  const customerId = id ?? ''
  const location = useLocation()
  const feedback = readFeedback(location.state)

  const { data, error, isPending, isError } = useQuery({
    queryKey: keys.customer(customerId),
    queryFn: () => getCustomer(customerId),
  })

  if (isError) {
    if (error instanceof ApiError && isGone(error.code)) {
      return <GoneScreen label="Clientes" to="/clientes" />
    }
    if (error instanceof NetworkError) {
      return (
        <main className="pantalla">
          <div className="cuerpo">
            <SinConexion />
          </div>
        </main>
      )
    }
    return (
      <main className="pantalla">
        <div className="cuerpo">
          <ErrorGenerico />
        </div>
      </main>
    )
  }

  if (isPending || data === undefined) return null

  return (
    <main className="pantalla">
      <div className="cuerpo">
        <div>
          <Link to="/clientes">Volver</Link>
          <span className="encabezado__titulo">{data.name}</span>
          <Link to={`/clientes/${customerId}/editar`}>Editar</Link>
        </div>
        {feedback !== null && <Notice kind={feedback.kind} message={feedback.message} />}
        <div className="formulario">
          <div className="campo">
            <span className="campo__rotulo">Teléfono</span>
            <span>{formatPhone(data.phone)}</span>
          </div>
          <div className="campo">
            <span className="campo__rotulo">Canal</span>
            <span>{data.channel !== null ? CHANNEL_LABEL[data.channel] : 'Sin canal'}</span>
          </div>
          <div className="campo">
            <span className="campo__rotulo">VIP</span>
            <span>{data.vip ? 'Sí' : 'No'}</span>
          </div>
        </div>
        <Link to="/ventas/nueva" state={newSaleFor(customerId)} className="boton">
          Nueva venta a {data.name}
        </Link>
      </div>
    </main>
  )
}
