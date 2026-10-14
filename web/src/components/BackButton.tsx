/**
 * `BackButton`: the one renderer of a back control, "‹ <parent>" (GH-135, ADR-0041, amends
 * ADR-0037's `back` kind). The shell's `BackArrow` draws it for every card; Análisis draws
 * it for its tab root's "Volver" to Más. Nothing else imports it and nothing else writes the
 * glyph (`architecture/backControl.ts`).
 *
 * With an `onClick` it is a button (the shell goes back by history); with a `to` it is an
 * in-app link. It keeps the look the old `Boton variant="back"` had: the same class, from
 * `botonVisual`. `ariaLabel` is for the bare arrow only (Análisis's "Volver"), where there
 * is no parent word to name it.
 */

import type { MouseEvent } from 'react'
import type { LinkProps } from 'react-router'
import { botonClass } from './botonVisual'
import InAppLink from './InAppLink'

/** The glyph every back control starts with. */
export const BACK_GLYPH = '‹'

interface BackCommon {
  /** The parent's word. Omitted only by the bare arrow, which needs an `ariaLabel`. */
  title?: string
  ariaLabel?: string
}

interface BackAsButton extends BackCommon {
  onClick: (event: MouseEvent<HTMLElement>) => void
  to?: undefined
}

interface BackAsLink extends BackCommon, Pick<LinkProps, 'to' | 'replace' | 'state'> {
  onClick?: (event: MouseEvent<HTMLElement>) => void
}

export type BackButtonProps = BackAsButton | BackAsLink

export default function BackButton(props: BackButtonProps) {
  const label = props.title === undefined ? BACK_GLYPH : `${BACK_GLYPH} ${props.title}`
  const className = botonClass('back')
  if (props.to === undefined) {
    return (
      <button type="button" className={className} onClick={props.onClick} aria-label={props.ariaLabel}>
        {label}
      </button>
    )
  }
  return (
    <InAppLink
      to={props.to}
      replace={props.replace}
      state={props.state}
      className={className}
      onClick={props.onClick}
      aria-label={props.ariaLabel}
    >
      {label}
    </InAppLink>
  )
}
