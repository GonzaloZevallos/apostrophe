/**
 * What `Boton` and `BotonLink` both draw from one `BotonProps`: the class, the
 * `aria-label` (if any) and the content, the icon hidden next to a word. `ACTION_ICON` is
 * the closed map of the icon-only actions to their icons.
 */

import type { ReactNode } from 'react'
import type { BotonProps, IconOnlyAction } from './Boton'
import Icono, { type NombreIcono } from './Icono'

const ACTION_ICON: Record<IconOnlyAction, NombreIcono> = {
  delete: 'tacho',
  search: 'buscar',
  close: 'cerrar',
  edit: 'lapiz',
  share: 'compartir',
}

/** Placement classes of the fixed "Nueva venta" button (phone and computer), kept here so no
 * other file writes a `boton*` literal. */
export const NUEVA_VENTA_CLASS = 'boton-nueva-venta'
export const NUEVA_VENTA_ESCRITORIO_CLASS = 'boton-nueva-venta--escritorio'

const CLASS = {
  primary: 'boton',
  secondary: 'boton boton--suave',
  destructive: 'boton boton--destructivo',
  link: 'boton--enlace',
  undo: 'boton--enlace',
  back: 'boton--enlace',
  icon: 'boton-icono',
  row: 'boton--fila',
  notice: 'boton-aviso',
} as const

/** The class string of a variant, for a component that draws a choice (an option tab) over a
 * button look without writing a `boton*` literal itself. */
export function botonClass(variant: keyof typeof CLASS): string {
  return CLASS[variant]
}

export function botonVisual(props: BotonProps): {
  className: string
  ariaLabel: string | undefined
  content: ReactNode
} {
  const className = CLASS[props.variant ?? 'primary']
  if (props.variant === 'icon') {
    return {
      className,
      ariaLabel: props.ariaLabel,
      content: <Icono nombre={ACTION_ICON[props.action]} />,
    }
  }
  return {
    className,
    ariaLabel: props.ariaLabel,
    content: (
      <>
        {props.icon !== undefined && <Icono nombre={props.icon} />}
        {props.children}
      </>
    ),
  }
}
