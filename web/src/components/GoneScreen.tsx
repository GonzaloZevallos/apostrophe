/**
 * Shown instead of a detail screen for a record that is gone (plan, "Gone
 * records"): "Eso ya no está.", with no id, name, date or amount — it reads the
 * same whatever was deleted, foreign, or never existed (ADR-0004). `label` and `to`
 * name only the list to go back to, e.g. "Clientes" / /clientes.
 */

import BotonLink from './BotonLink'
import { GONE_DETAIL } from '../api/refusals'

export default function GoneScreen({ label, to }: { label: string; to: string }) {
  return (
    <main className="pantalla">
      <div className="cuerpo">
        <div className="estado-vacio">
          <span className="estado-vacio__titulo">{GONE_DETAIL}</span>
          <BotonLink variant="primary" icon="atras" to={to}>
            Volver a {label}
          </BotonLink>
        </div>
      </div>
    </main>
  )
}
