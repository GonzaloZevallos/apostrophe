/**
 * The one place the front names the path of Más, Gastos, the expense form, the
 * expense categories (a Configuración group since #60), Análisis, the stock withdrawal
 * form and a withdrawal's detail, and every
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
export const WITHDRAWAL_NEW = '/withdrawals/new'
export const WITHDRAWAL = '/withdrawals/:id'
export const WITHDRAWAL_EDIT = '/withdrawals/:id/edit'

/** The Onboarding (docs/product/onboarding.md): `/onboarding` resolves to the resume step,
 * each step has its own path, and "Listo" is `/onboarding/done`. The API's own segment is
 * `onboarding-progress`, so none of these is a shared route. */
export const ONBOARDING = '/onboarding'
export const ONBOARDING_VARIETY = '/onboarding/variety'
export const ONBOARDING_STOCK = '/onboarding/stock'
export const ONBOARDING_CATALOG_MESSAGE = '/onboarding/catalog-message'
export const ONBOARDING_BOT = '/onboarding/bot'
export const ONBOARDING_PARTNER = '/onboarding/partner'
export const ONBOARDING_CATEGORIES = '/onboarding/categories'
export const ONBOARDING_DONE = '/onboarding/done'
export const NEW_SALE = '/ventas/nueva'

/** A withdrawal's detail path, from its id alone: never a business id (ADR-0004). */
export function withdrawalPath(id: number | string): string {
  return `/withdrawals/${id}`
}

/** The edit form's path for a withdrawal. */
export function withdrawalEditPath(id: number | string): string {
  return `${withdrawalPath(id)}/edit`
}

/** The form that opens with `variety` already chosen on its first line. */
export function withdrawalNewFor(varietyId: number | string): string {
  return `${WITHDRAWAL_NEW}?variety=${varietyId}`
}

type Id = string | number

export const VARIETIES = '/varieties'
export const VARIETY_NEW = '/varieties/new'
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
