/**
 * `Icono` (`componentes.ts`'s `NombreIcono`/`IconoProps`, plan "Components"): the
 * app's one source of `<svg>` icons — no screen draws its own (plan, invariants).
 * Decorative (`aria-hidden`) unless a caller passes `label`, which makes it
 * `role="img"` with that `aria-label` instead; a caller that wants the icon
 * announced (say, inside an icon-only `Boton`) passes the label there, never on a
 * wrapping element that duplicates it.
 *
 * Adds `'agregar'` to the design's own `NombreIcono` union (`docs/product/design-system/componentes.ts`)
 * for the "+" the plan calls out on "Nueva venta", "Nueva entrada" and the icon-only
 * `Boton` — the design draws it (`Componentes.dc.html`, `Inicio.dc.html`) but never
 * names it, so this is the one name this component adds to the contract's own set.
 */

import type { ReactNode } from 'react'

export type NombreIcono =
  | 'inicio'
  | 'ventas'
  | 'clientes'
  | 'stock'
  | 'variedades'
  | 'mas'
  | 'atras'
  | 'chevron'
  | 'abajo'
  | 'buscar'
  | 'calendario'
  | 'whatsapp'
  | 'telegram'
  | 'tacho'
  | 'cobro'
  | 'personaMas'
  | 'agregar'
  | 'hecho'

export interface IconoProps {
  nombre: NombreIcono
  size?: number
  strokeWidth?: number
  /** When given, the icon itself carries the accessible name (`role="img"`).
   * Omitted, it is purely decorative. */
  label?: string
}

const DOTS: ReactNode = (
  <>
    <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" />
  </>
)

const TRAZOS: Record<NombreIcono, ReactNode> = {
  inicio: (
    <>
      <path d="M3 10.6 12 3.4l9 7.2" />
      <path d="M5.4 9.6V20h13.2V9.6" />
    </>
  ),
  ventas: (
    <>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
      <path d="M9.5 8.5h5" />
      <path d="M9.5 12.5h5" />
    </>
  ),
  clientes: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19.5c0-3 2.5-5.2 5.5-5.2s5.5 2.2 5.5 5.2" />
      <path d="M16 6.4a3 3 0 0 1 0 5.4" />
    </>
  ),
  stock: (
    <>
      <path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5z" />
      <path d="M4 8.5 12 13l8-4.5" />
      <path d="M12 13v7" />
    </>
  ),
  variedades: <path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5z" />,
  mas: DOTS,
  atras: <path d="m15 5-7 7 7 7" />,
  chevron: <path d="m9 5 7 7-7 7" />,
  abajo: <path d="m5 9 7 7 7-7" />,
  buscar: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5 21 21" />
    </>
  ),
  calendario: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
      <path d="M3.5 10h17" />
    </>
  ),
  whatsapp: (
    <path d="M12 3.5c-4.7 0-8.5 3.4-8.5 7.6 0 2.4 1.2 4.5 3.1 5.9L5.5 20.5l3.9-1.5c.8.2 1.7.3 2.6.3 4.7 0 8.5-3.4 8.5-7.6S16.7 3.5 12 3.5z" />
  ),
  telegram: <path d="M21 4.5 3.8 11.2l5 1.7 1.7 5.6 3-3.6 4.6 3.2z" />,
  tacho: (
    <>
      <path d="M5 7h14" />
      <path d="M9.5 7V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v2" />
      <path d="M7 7l1 13h8l1-13" />
    </>
  ),
  cobro: (
    <>
      <rect x="3" y="6.5" width="18" height="11" rx="2.5" />
      <circle cx="12" cy="12" r="2.4" />
    </>
  ),
  personaMas: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19.5c0-3 2.5-5.2 5.5-5.2s5.5 2.2 5.5 5.2" />
      <path d="M18 8v4" />
      <path d="M16 10h4" />
    </>
  ),
  agregar: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  hecho: <path d="m5 12.5 4.5 4.5L19 7.5" />,
}

export default function Icono({ nombre, size = 22, strokeWidth = 1.6, label }: IconoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label !== undefined ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label === undefined ? true : undefined}
    >
      {TRAZOS[nombre]}
    </svg>
  )
}
