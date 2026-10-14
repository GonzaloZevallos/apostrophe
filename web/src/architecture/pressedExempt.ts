/**
 * The controls left out of the pressed state for a design decision (GH-102): no visible
 * pressed state is possible from the existing tokens, or it is unclear whether the control
 * is tappable. One table, read by `touch.test.ts` (the static guard, which fails on an entry
 * whose classes are gone or now covered) and by `e2e/pressed.spec.ts` (which presses nothing
 * listed here). Never a way round the guard for a control that simply lacks its rule.
 */

export interface ExemptEntry {
  classes: string[]
  screen: string
  variant: 'selected' | 'disabled' | 'none'
  reason: string
}

export const EXEMPT: ExemptEntry[] = [
  {
    classes: ['opcion-interruptor__input'],
    screen: 'Configuración > Precios, Nueva venta',
    variant: 'none',
    reason:
      'a visually hidden native switch: the person taps its label, `.opcion-interruptor`, which carries the pressed state',
  },
]
