/**
 * Formats whole-peso amounts for display (`formato.ts`'s `plata`, English side):
 * dot thousands, never a decimal (money never carries cents in this product).
 * Parsing what a person types is `parse.ts`'s job, not this one.
 */

const FORMATTER = new Intl.NumberFormat('es-AR', {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
})

/** `11000` → `"$ 11.000"`. */
export function formatMoney(amount: number): string {
  return `$ ${FORMATTER.format(Math.round(amount))}`
}
