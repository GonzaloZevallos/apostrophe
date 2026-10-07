/**
 * The one place the front names the path of Más, Gastos, the expense form, the
 * expense categories (a Configuración group since #60), Análisis and every
 * `/varieties/*` path (Variedades, a variety's page, its lists, the catalog screen and
 * the stock entry form; ADR-0030). A variety or an entry is named by its integer id,
 * never by its name. Every constant under an API segment (`/varieties`, `/expenses`)
 * also appears in `contract.json`'s `sharedFrontRoutes` (`routes.test.ts` checks it). Components and
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

type Id = string | number

export const VARIETIES = '/varieties'
export const VARIETY_NEW = '/varieties/new'
export const ARCHIVED_VARIETIES = '/varieties/archived'
export const CATALOG = '/varieties/catalog'
export const ENTRIES = '/varieties/entries'
export const ENTRY_NEW = '/varieties/entries/new'
export const ENTRY = (id: Id): string => `/varieties/entries/${id}`
export const VARIETY = (id: Id): string => `/varieties/${id}`
export const VARIETY_PRICES = (id: Id): string => `/varieties/${id}/prices`
export const VARIETY_PRICE_NEW = (id: Id): string => `/varieties/${id}/prices/new`
export const VARIETY_ENTRIES = (id: Id): string => `/varieties/${id}/entries`

/** The anchor of a variety's "En el catálogo" section: the catalog screen links to it and
 * the variety's page honours it. Not a path, so it is not a sharedFrontRoutes entry. */
export const CATALOG_SECTION_ID = 'en-el-catalogo'

/** The path as a route-table segment (`'/more'` → `'more'`), for children of the root route. */
export function relative(path: string): string {
  return path.replace(/^\//, '')
}
