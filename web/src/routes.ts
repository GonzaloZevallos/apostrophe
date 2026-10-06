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

/** The path as a route-table segment (`'/more'` → `'more'`), for children of the root route. */
export function relative(path: string): string {
  return path.replace(/^\//, '')
}
