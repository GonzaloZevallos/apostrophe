/**
 * The one place the front names the path of Más, Gastos, the expense form, the
 * expense categories and Análisis. Components and the shell import these; none
 * writes the literal (a source scan in `routes.test.ts` fails if one does).
 *
 * `router.tsx` derives its route-table segments from the same constants through
 * `relative`, so the table and the links cannot drift apart.
 */

export const MORE = '/mas'
export const EXPENSES = '/gastos'
export const EXPENSE_CATEGORIES = '/gastos/categorias'
export const ANALYSIS = '/analisis'
// Placeholder: no route uses it yet; the flip to /more and /expenses sets its real value.
export const EXPENSE_NEW = '/gastos/nuevo'

/** The path as a route-table segment (`'/mas'` → `'mas'`), for children of the root route. */
export function relative(path: string): string {
  return path.replace(/^\//, '')
}
