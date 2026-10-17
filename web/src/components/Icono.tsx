/**
 * `Icono` (`componentes.ts`'s `NombreIcono`/`IconoProps`): the app's one source of
 * `<svg>` icons — no screen draws its own. Every icon is 22 px at stroke 1.6, set once
 * on the `<svg>` below: no caller passes a size or a stroke, and no glyph sets its own
 * stroke, fill or transform (`tests/test_design_icons.py` checks both).
 *
 * `ICON_NAMES` is the one list of what is drawn; `componentes.ts` names the same set
 * for the design and the same test fails when the two differ. `'agregar'`
 * and `'telegram'` are drawn here and named there too.
 *
 * Decorative (`aria-hidden`) unless a caller passes `label`, which makes it
 * `role="img"` with that `aria-label` instead; a caller that wants the icon
 * announced (say, inside an icon-only `Boton`) passes the label there, never on a
 * wrapping element that duplicates it.
 */

import type { ReactNode } from 'react'

export const ICON_NAMES = [
  'inicio',
  'ventas',
  'clientes',
  'variedades',
  'mas',
  'atras',
  'chevron',
  'abajo',
  'buscar',
  'telegram',
  'tacho',
  'cobro',
  'personaMas',
  'agregar',
  'lapiz',
  'cerrar',
  'info',
  'compartir',
  'candado',
  'salirSesion',
  'archivar',
  'restaurar',
  'probar',
  'salidaStock',
  'atencion',
  'copiar',
  'publicar',
  'precio',
  'gastos',
  'analisis',
  'configuracion',
  'negocio',
  'usuarios',
  'integraciones',
  'mensaje',
  'categorias',
  'apariencia',
  'cuenta',
  'hecho',
  'calendario',
] as const

export type NombreIcono = (typeof ICON_NAMES)[number]

export interface IconoProps {
  nombre: NombreIcono
  /** When given, the icon itself carries the accessible name (`role="img"`).
   * Omitted, it is purely decorative. */
  label?: string
}

const DOTS: ReactNode = (
  <>
    <circle cx="5" cy="12" r="0.75" />
    <circle cx="12" cy="12" r="0.75" />
    <circle cx="19" cy="12" r="0.75" />
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
  lapiz: (
    <><path d="M4 20l1.2-4.4L16.2 4.6a2.1 2.1 0 0 1 3 3L8.4 18.8z" /><path d="M14 7l3 3" /></>
  ),
  cerrar: (
    <><path d="M6 6l12 12" /><path d="M18 6 6 18" /></>
  ),
  info: (
    <><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 8h.01" /></>
  ),
  compartir: (
    <><circle cx="6" cy="12" r="2.5" /><circle cx="17" cy="6" r="2.5" /><circle cx="17" cy="18" r="2.5" /><path d="M8.2 10.8 14.8 7.2" /><path d="M8.2 13.2l6.6 3.6" /></>
  ),
  candado: (
    <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>
  ),
  salirSesion: (
    <><path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" /><path d="m15 8 4 4-4 4" /><path d="M19 12H9" /></>
  ),
  archivar: (
    <><rect x="3.5" y="4" width="17" height="4.5" rx="1" /><path d="M5 8.5V18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5" /><path d="M10 12.5h4" /></>
  ),
  restaurar: (
    <><path d="M4 12a8 8 0 1 0 2.3-5.6" /><path d="M4 4v4.5h4.5" /></>
  ),
  probar: (
    <><path d="M9.5 3.5h5" /><path d="M10.5 3.5v5.2L5 18.5A1.6 1.6 0 0 0 6.4 21h11.2a1.6 1.6 0 0 0 1.4-2.5l-5.5-9.8V3.5" /></>
  ),
  salidaStock: (
    <><path d="M4 13v6h16v-6" /><path d="M12 16V4" /><path d="m8 8 4-4 4 4" /></>
  ),
  atencion: (
    <><path d="M12 3.5 21.5 20h-19z" /><path d="M12 10v4.5" /><path d="M12 17.5h.01" /></>
  ),
  copiar: (
    <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3" /></>
  ),
  publicar: (
    <><path d="M4 10h3l7-4v12l-7-4H4z" /><path d="M17.5 9a4 4 0 0 1 0 6" /></>
  ),
  precio: (
    <><path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1 1 0 0 1 0 1.4l-7.4 7.4a1 1 0 0 1-1.4 0z" /><circle cx="8" cy="8" r="1" /></>
  ),
  gastos: (
    <><rect x="3.5" y="7" width="17" height="12.5" rx="2.5" /><path d="M20.5 11.5h-4a1.8 1.8 0 0 0 0 3.6h4" /><path d="M6 7l9.5-3 1 3" /></>
  ),
  analisis: (
    <><path d="M5 20v-8" /><path d="M12 20V5" /><path d="M19 20v-9" /></>
  ),
  configuracion: (
    <><path d="M4 7h9" /><path d="M17 7h3" /><circle cx="15" cy="7" r="2" /><path d="M4 17h3" /><path d="M11 17h9" /><circle cx="9" cy="17" r="2" /></>
  ),
  negocio: (
    <><path d="M4 9.5 5.5 4h13L20 9.5" /><path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0" /><path d="M5.5 12.5V20h13v-7.5" /><path d="M10 20v-4.5h4V20" /></>
  ),
  usuarios: (
    <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19.5c0-3 2.5-5.2 5.5-5.2s5.5 2.2 5.5 5.2" /><path d="m16.5 15 1.5 1.5 3-3" /></>
  ),
  integraciones: (
    <><path d="M9 3v5" /><path d="M15 3v5" /><path d="M6.5 8h11v3.5a5.5 5.5 0 0 1-11 0z" /><path d="M12 17v4" /></>
  ),
  mensaje: (
    <><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H11l-4.5 4V16H5.5A1.5 1.5 0 0 1 4 14.5z" /><path d="M8 9h8" /><path d="M8 12h5" /></>
  ),
  categorias: (
    <><rect x="4" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" /></>
  ),
  apariencia: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />,
  cuenta: (
    <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="10" r="3" /><path d="M6.2 18.2c1.2-2.3 3.2-3.4 5.8-3.4s4.6 1.1 5.8 3.4" /></>
  ),
  hecho: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  calendario: (
    <><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M8 3v4" /><path d="M16 3v4" /><path d="M3.5 10h17" /></>
  ),
}

export default function Icono({ nombre, label }: IconoProps) {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
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
