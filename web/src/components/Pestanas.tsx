/**
 * `Pestanas`: a plain text tab list — the design's period switch (`Ventas.dc.html`,
 * `VentasCompu.dc.html`), an underline (`box-shadow`) on the active tab, never a
 * pill. Every tab renders over `.boton--enlace`, one of `Boton`'s own five
 * classes, which is where `border`/`background` are reset (plan, invariants:
 * "border, background and appearance are reset only by `Boton`'s classes") —
 * `pestanas__opcion`/`--activa` only add colour, `text-decoration`, weight and the
 * active underline on top, never a reset of their own (review finding: the
 * earlier version re-reset `border`/`background` in its own class).
 */

import type { ReactNode } from 'react'

export interface PestanaItem<T extends string> {
  value: T
  label: ReactNode
}

export interface PestanasProps<T extends string> {
  items: readonly PestanaItem<T>[]
  value: T
  onChange: (value: T) => void
  ariaLabel: string
}

export default function Pestanas<T extends string>({
  items,
  value,
  onChange,
  ariaLabel,
}: PestanasProps<T>) {
  return (
    <div className="pestanas" role="group" aria-label={ariaLabel}>
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          className={
            item.value === value
              ? 'boton--enlace pestanas__opcion pestanas__opcion--activa'
              : 'boton--enlace pestanas__opcion'
          }
          aria-pressed={item.value === value}
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
