/**
 * The one author of the "venta"/"ventas" wording for a sales count (plan
 * invariants: "The 'venta'/'ventas' wording for a sales count comes only from
 * `salesCount` ... no screen holds its own `=== 1 ? 'venta' : 'ventas'`").
 * `Inicio`, `Ventas` and `TeDeben` all word the same API figure the same way
 * by calling this, never by their own ternary.
 */

/** `1` → `"1 venta"`; every other count, `0` included, → `"N ventas"`. */
export function salesCount(n: number): string {
  return n === 1 ? '1 venta' : `${n} ventas`
}

/** The Te deben block's count line (`payments.md`): `1` → `"1 venta debiendo"`, `N` →
 * `"N ventas debiendo"`. `Inicio` and `TeDeben` (Clientes) both say it by calling this. */
export function salesOwingCount(n: number): string {
  return `${salesCount(n)} debiendo`
}
