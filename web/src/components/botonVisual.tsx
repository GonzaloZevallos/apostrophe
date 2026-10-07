/**
 * What `Boton` and `BotonLink` both draw from one `BotonProps`: the class, the
 * `aria-label` (if any) and the content, the icon hidden next to a word. `ACTION_ICON` is
 * the closed map of the icon-only actions to their icons (`Boton.tsx` says why it lists
 * two names today).
 */

import type { ReactNode } from 'react'
import type { BotonProps, IconOnlyAction } from './Boton'
import Icono, { type NombreIcono } from './Icono'

const ACTION_ICON: Record<IconOnlyAction, NombreIcono> = {
  delete: 'tacho',
  search: 'buscar',
}

const CLASS = {
  primary: 'boton',
  secondary: 'boton boton--suave',
  destructive: 'boton boton--destructivo',
  link: 'boton--enlace',
  undo: 'boton--enlace',
  back: 'boton--enlace',
  icon: 'boton-icono',
  row: 'boton--fila',
} as const

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
