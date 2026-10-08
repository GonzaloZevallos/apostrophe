/**
 * The generic retry for a server error (`accounts.md`, "Feedback": "a server error
 * shows a generic retry"). Fixed copy, no data of its own, and never a refusal text
 * — a refusal would blame what the user typed, which is not what a 500 or an
 * unrecognised error body means.
 */

import AvisoAmbar from './AvisoAmbar'
import { ERROR_GENERICO_MENSAJE } from './estadosMessages'

export { ERROR_GENERICO_MENSAJE }

export default function ErrorGenerico() {
  return (
    <AvisoAmbar attention role="alert">
      <span className="aviso-ambar__titulo">{ERROR_GENERICO_MENSAJE}</span>
    </AvisoAmbar>
  )
}
