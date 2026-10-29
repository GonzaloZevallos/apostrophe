/**
 * One phone card (`Analisis.dc.html`): the title that ends in an ellipsis, the Sales
 * headline, and one block per figure. A row is inline flow: the words before the figure,
 * the figure (the only span that never wraps, so its "$" stays with its digits), the words
 * after it. The spaces baked into the copy keys stay significant. A pending text is a block
 * line of its own under its figure and is never truncated. The current week is set apart by
 * an edge (a border), not only by a fill, and carries no word.
 */

import { useId, type ReactNode } from 'react'
import type { CardProps } from './analisisCards'

export default function AnalisisTarjeta({
  card,
  bar,
}: {
  card: CardProps
  /** The week card's decorative bar, drawn between the title and the headline. */
  bar?: ReactNode
}) {
  const titleId = useId()
  return (
    <div
      role="group"
      aria-labelledby={titleId}
      className={card.current ? 'analisis__tarjeta analisis__tarjeta--actual' : 'analisis__tarjeta'}
    >
      <div className="analisis__tarjeta-cabecera">
        <span id={titleId} className="analisis__tarjeta-titulo">
          {card.title}
        </span>
        <span className="analisis__tarjeta-cifra analisis__tarjeta-titular">{card.headline}</span>
      </div>
      {bar}
      {card.mark !== undefined && <span className="analisis__marca-mejor">{card.mark}</span>}
      {card.rows.map((row, index) => (
        <div key={index} className="analisis__tarjeta-fila">
          {row.before}
          {row.figure !== null && <span className="analisis__tarjeta-cifra">{row.figure}</span>}
          {row.after}
          {row.pending !== null && (
            <div className="analisis__tarjeta-pendiente">{row.pending}</div>
          )}
        </div>
      ))}
    </div>
  )
}
