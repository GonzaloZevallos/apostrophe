/**
 * `MarcaEstado` (`componentes.ts`: the shape that accompanies a stock status so it
 * reads without color — square = agotada, filled circle = baja, empty circle = ok;
 * `stock.md`, "Status marks": "told by shape and word, never by color alone"). The
 * word sits in the same element the shape does, so a screen reader announces both
 * together and nothing here depends on recognising a shape or a color.
 */

import type { Status } from '../api/stock'

const WORD: Record<Status, string> = {
  no_entries: 'sin entradas',
  sold_out: 'agotada',
  low: 'baja',
  ok: 'ok',
}

export default function MarcaEstado({ estado }: { estado: Status }) {
  return (
    <span className={`marca-estado marca-estado--${estado}`}>
      <span className="marca-estado__forma" aria-hidden="true" />
      <span className="marca-estado__palabra">{WORD[estado]}</span>
    </span>
  )
}
