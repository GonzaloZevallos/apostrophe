/**
 * `MasInfo` (GH-97, `docs/product/icon-and-text-rule.md`): a short line with an "i" at its end
 * that expands the longer explanation in place, under the line, and collapses it on a second
 * tap. Not a modal or a sheet. The "i" is the one icon-only control outside `Boton`'s closed
 * action map: its own term, its own fixed name "Más info", `aria-expanded` and a 44 px target.
 *
 * Whether it is open is local component state and nothing else: never in history
 * (ADR-0027), never in browser storage (ADR-0026), never a form's value, so opening it is not
 * an unsaved change and the leave guard never sees it. It always mounts closed. Only the "how"
 * or "why" goes behind it, never a consequence, a refusal's fix or a state. The ink is
 * `--tinta2`, the general text token ADR-0029 already guards.
 */

import { useId, useState } from 'react'
import Icono from './Icono'

export interface MasInfoProps {
  /** The always-visible line (a registered binding of at most 80 characters). */
  line: string
  /** The longer how or why, shown only while open. */
  more: string
}

export default function MasInfo({ line, more }: MasInfoProps) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  return (
    <div className="mas-info">
      <div className="mas-info__linea">
        <span className="mas-info__texto" data-copy="help">
          {line}
        </span>
        <button
          type="button"
          className="mas-info__boton"
          aria-label="Más info"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((was) => !was)}
        >
          <Icono nombre="info" />
        </button>
      </div>
      <p id={panelId} className="mas-info__detalle" hidden={!open}>
        {more}
      </p>
    </div>
  )
}
