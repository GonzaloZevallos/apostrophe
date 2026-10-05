/**
 * `Boton` (`componentes.ts`'s `BotonProps`, plan "Components"): the one button
 * shape the app draws — primary (tinta llena), secondary (superficie, "suave"),
 * link (underlined, `boton--enlace`) and destructive (critical fill), an
 * icon-only mode with no visible text, and `row`: a full-width, left-aligned,
 * stacked-content button for a tappable list row (a closed sale line, say) —
 * still reset only through its own `styles/app.css` class (`boton--fila`), never
 * a one-off class a screen writes itself. No screen writes its own button base
 * styles (plan, invariants): every variant below is one of `styles/app.css`'s own
 * classes, never an inline style or a one-off class.
 *
 * Variant names are English (CODING_STANDARDS §10, §2: code names follow
 * CONTEXT.md's English, screen text stays Spanish) even though the design's own
 * `BotonProps.variante` spells them `primario`/`suave`/`enlace`/`destructivo` —
 * only the rendered word is Spanish, same split `ConfirmDialogProps` already
 * makes (`title`/`confirmText` in English, their values in Spanish).
 *
 * Icon-only needs a name a screen reader can say: `children` is optional, but a
 * caller that omits it must pass `ariaLabel`, so the button never ships with no
 * accessible name at all. `ariaDescribedBy` is for a row whose own message sits
 * just below it (a line's `combinedLineError`, say): the row names the message,
 * never the other way around.
 */

import type { ReactNode } from 'react'
import Icono, { type NombreIcono } from './Icono'

export type BotonVariant = 'primary' | 'secondary' | 'link' | 'destructive' | 'icon' | 'row'

interface BotonPropsBase {
  variant?: BotonVariant
  icon?: NombreIcono
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit'
  ariaDescribedBy?: string
}

interface BotonPropsWithChildren extends BotonPropsBase {
  children: ReactNode
  ariaLabel?: string
}

interface BotonPropsIconOnly extends BotonPropsBase {
  children?: undefined
  ariaLabel: string
}

export type BotonProps = BotonPropsWithChildren | BotonPropsIconOnly

const CLASS: Record<BotonVariant, string> = {
  primary: 'boton',
  secondary: 'boton boton--suave',
  link: 'boton--enlace',
  destructive: 'boton boton--destructivo',
  icon: 'boton-icono',
  row: 'boton--fila',
}

export default function Boton({
  children,
  variant = 'primary',
  icon,
  ariaLabel,
  ariaDescribedBy,
  onClick,
  disabled = false,
  type = 'button',
}: BotonProps) {
  return (
    <button
      type={type}
      className={CLASS[variant]}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
    >
      {icon !== undefined && <Icono nombre={icon} />}
      {children}
    </button>
  )
}
