/**
 * The "Sin conexión" state of `Estados` (`accounts.md`, "No network"): fixed copy,
 * no data of its own. Shown wherever a request fails because the network dropped, or
 * the browser's own `online`/`offline` signal says so (`useOnline`) — never a success
 * toast, never the generic server-error retry.
 */

import AvisoAmbar from './AvisoAmbar'
import { SIN_CONEXION_MENSAJE } from './estadosMessages'

export default function SinConexion() {
  return (
    <AvisoAmbar attention role="status">
      <span className="aviso-ambar__titulo">{SIN_CONEXION_MENSAJE}</span>
    </AvisoAmbar>
  )
}
