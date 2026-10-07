/**
 * The "Sin conexión" state of `Estados` (`accounts.md`, "No network"): fixed copy,
 * no data of its own. Shown wherever a request fails because the network dropped, or
 * the browser's own `online`/`offline` signal says so (`useOnline`) — never a success
 * toast, never the generic server-error retry.
 */

import { SIN_CONEXION_DETALLE, SIN_CONEXION_TITULO } from './estadosMessages'

export { SIN_CONEXION_DETALLE, SIN_CONEXION_TITULO }

export default function SinConexion() {
  return (
    <div className="aviso-ambar" role="status">
      <span className="aviso-ambar__titulo">{SIN_CONEXION_TITULO}</span>
      <span className="aviso-ambar__detalle">{SIN_CONEXION_DETALLE}</span>
    </div>
  )
}
