/**
 * `Pestanas`: a plain text tab list — the design's period switch (`Ventas.dc.html`,
 * `VentasCompu.dc.html`), an underline (`box-shadow`) on the active tab, never a
 * pill. None of `Boton`'s five variants draw this shape (the active tab is black
 * and bold, never the link variant's blue accent), so — same as `SelectorPago`'s
 * own segmented control already does for payment — this component owns its one
 * button reset itself, in its own class, rather than a screen reaching for a bare
 * `<button>` (plan, invariants: "buttons from `Boton`"; review guidance: "render
 * through `Boton` or another foundation component").
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
            item.value === value ? 'pestanas__opcion pestanas__opcion--activa' : 'pestanas__opcion'
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
