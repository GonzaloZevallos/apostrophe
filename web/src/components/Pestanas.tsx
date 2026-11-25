/**
 * `Pestanas`: a plain text tab list — the design's period switch (`Ventas.dc.html`,
 * `VentasCompu.dc.html`), an underline (`box-shadow`) on the active tab, a pill only
 * with `ajuste="pastilla"`. Every tab renders over `.boton--enlace`, one of `Boton`'s own five
 * classes, which is where `border`/`background` are reset (plan, invariants:
 * "border, background and appearance are reset only by `Boton`'s classes") —
 * `pestanas__opcion`/`--activa` only add colour, `text-decoration`, weight and the
 * active underline on top, never a reset of their own (review finding: the
 * earlier version re-reset `border`/`background` in its own class).
 *
 * `ajuste="celdas"` is the opt-in phone fit: the group becomes a size container and
 * its tabs sit in an inner grid of equal cells, four in a row when they fit and two by
 * two when they don't (the CSS decides from the container's own width, never from a
 * measurement in code). Without it the output is the plain list above.
 *
 * `ajuste="pastilla"` is the opt-in pill look (the phone Products segments): the label sits in
 * an inner `.pestanas__pastilla` span, a 32 px pill inside the 44 px button, and the selected
 * one is a filled pill with heavier text (`aria-pressed` still says which, never colour alone).
 * The two values are exclusive; the roles, the `aria-label` and the buttons are the same.
 */

import { botonClass } from './botonVisual'
import type { FixedSet } from './fixedSets'

interface PestanasProps<T extends string> {
  items: FixedSet<T>
  value: T
  onChange: (value: T) => void
  ariaLabel: string
  ajuste?: 'celdas' | 'pastilla'
}

export default function Pestanas<T extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  ajuste,
}: PestanasProps<T>) {
  const pill = ajuste === 'pastilla'
  const tabs = items.map((item) => (
    <button
      key={item.value}
      type="button"
      className={
        item.value === value
          ? `${botonClass('link')} pestanas__opcion pestanas__opcion--activa`
          : `${botonClass('link')} pestanas__opcion`
      }
      aria-pressed={item.value === value}
      onClick={() => onChange(item.value)}
    >
      {pill ? <span className="pestanas__pastilla">{item.label()}</span> : item.label()}
    </button>
  ))
  if (pill) {
    return (
      <div className="pestanas pestanas--pastilla" role="group" aria-label={ariaLabel}>
        {tabs}
      </div>
    )
  }
  if (ajuste === 'celdas') {
    return (
      <div className="pestanas pestanas--celdas" role="group" aria-label={ariaLabel}>
        <div className="pestanas__celdas">{tabs}</div>
      </div>
    )
  }
  return (
    <div className="pestanas" role="group" aria-label={ariaLabel}>
      {tabs}
    </div>
  )
}
