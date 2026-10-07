/**
 * The one place the front names the path of Más, Gastos, the expense form, the
 * expense categories (a Configuración group since #60) and Análisis. Components and
 * the shell import these; none writes the literal (a source scan in `routes.test.ts` fails if one does).
 *
 * `router.tsx` derives its route-table segments from the same constants through
 * `relative`, so the table and the links cannot drift apart.
 */

export const MORE = '/more'
export const EXPENSES = '/expenses'
export const EXPENSE_CATEGORIES = '/settings/expense-categories'
export const ANALYSIS = '/analisis'
export const EXPENSE_NEW = '/expenses/new'
export const WITHDRAWAL_NEW = '/withdrawals/new'
export const WITHDRAWAL = '/withdrawals/:id'
export const WITHDRAWAL_EDIT = '/withdrawals/:id/edit'
/** A variety's "Ver todas" of "Stock y entradas": its own page, under the variety's. */
export const VARIETY_MOVEMENTS = '/variedades/:id/movimientos'

/** A withdrawal's detail path, from its id alone: never a business id (ADR-0004). */
export function withdrawalPath(id: number | string): string {
  return `/withdrawals/${id}`
}

/** The full list of one variety's movements (entries and withdrawals). */
export function varietyMovementsPath(varietyId: number | string): string {
  return `/variedades/${varietyId}/movimientos`
}

/** The edit form's path for a withdrawal. */
export function withdrawalEditPath(id: number | string): string {
  return `${withdrawalPath(id)}/edit`
}

/** The form that opens with `variety` already chosen on its first line. */
export function withdrawalNewFor(varietyId: number | string): string {
  return `${WITHDRAWAL_NEW}?variety=${varietyId}`
}

/** The path as a route-table segment (`'/more'` → `'more'`), for children of the root route. */
export function relative(path: string): string {
  return path.replace(/^\//, '')
}
