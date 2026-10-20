import { SHELL_TEXT } from './copy/shell.ts'
import { COMMON_TEXT } from './copy/common.ts'
import { INTEGRATIONS_LINK_WORD } from './copy/pinnedCatalog.ts'
/**
 * The route registry: the one place the front writes a path, and the one place that says
 * what kind of screen each path is. No other file in `web/src` or `web/e2e` carries a route
 * literal (a source scan in `routes.test.ts` fails if one does).
 *
 * Pure data and functions, with no import of any screen: the e2e specs import it too, and
 * they type-check under the node project, which has no JSX. `router.tsx` binds each declared
 * screen to its element (`bind`) and each public page through `outside`.
 *
 * Every screen under `Shell` is declared once with `screen()` and is exactly one `kind` (the
 * Onboarding's forms too, though `OnboardingLayout` draws them instead of `Shell`):
 *   - `root`: a place of its own (the bar or the rail marks it); shows the bar and "+ Nueva venta".
 *   - `card`: a detail; shows the bar and a "‹ parent" arrow, no "+ Nueva venta".
 *   - `form`: a form or sheet; shows neither, and closes with "Cerrar".
 * Every route outside `Shell` (the public pages and the catch-all) is declared with
 * `outside()`; a route is one or the other, never both, never neither.
 *
 * `parentOf` and `placeOf` take the viewport because Configuración's list has a different
 * parent on the phone (Más) than on a computer (Inicio). A card or form has no place of its
 * own: `placeOf` walks its parent chain until a screen that declares one, so the mark never
 * depends on history, a reload or how the screen was opened.
 */

export type Viewport = 'phone' | 'computer'

/** Which kind of screen a route is; the chrome follows from it and from nothing else. */
export type Kind = 'root' | 'card' | 'form'

/** What the bottom bar can mark. */
export type BarPlace = 'home' | 'sales' | 'customers' | 'varieties' | 'more'

/** What the side rail can mark: the bar's places, Gastos, Análisis and the business row. */
export type RailPlace = BarPlace | 'expenses' | 'analysis' | 'business'

export interface Place {
  bar: BarPlace
  rail: RailPlace
}

export type ScreenId =
  | 'home'
  | 'more'
  | 'sales'
  | 'sale-new'
  | 'sale'
  | 'customers'
  | 'customer-new'
  | 'customer'
  | 'customer-edit'
  | 'customer-payment'
  | 'varieties'
  | 'variety'
  | 'variety-new'
  | 'variety-prices'
  | 'variety-price-new'
  | 'variety-entries'
  | 'catalog'
  | 'stock'
  | 'stock-entry-new'
  | 'stock-entry'
  | 'varieties-archived'
  | 'withdrawal-new'
  | 'withdrawal'
  | 'withdrawal-edit'
  | 'expenses'
  | 'expense-new'
  | 'analysis'
  | 'settings'
  | 'settings-business'
  | 'settings-users'
  | 'settings-prices'
  | 'settings-integrations'
  | 'settings-catalog-message'
  | 'settings-expense-categories'
  | 'settings-appearance'
  | 'settings-account'
  | 'onboarding'
  | 'onboarding-variety'
  | 'onboarding-stock'
  | 'onboarding-catalog-message'
  | 'onboarding-bot'
  | 'onboarding-partner'
  | 'onboarding-categories'
  | 'onboarding-done'

/** A screen's parent: one id, or one per viewport. */
export type Parent = ScreenId | { phone: ScreenId; computer: ScreenId }

// Paths. A `:name` segment is a parameter; `pathTo` fills it.
export const HOME = '/'
export const LOGIN = '/login'
export const INVITATION = '/invitation/:token'
export const RESET = '/reset/:token'
export const CATCH_ALL = '*'

export const SALES = '/sales'
export const SALE_NEW = '/sales/new'
export const SALE = '/sales/:id'

export const CUSTOMERS = '/customers'
export const CUSTOMER_NEW = '/customers/new'
export const CUSTOMER = '/customers/:id'
export const CUSTOMER_EDIT = '/customers/:id/edit'
export const CUSTOMER_PAYMENT = '/customers/:id/payment'

export const VARIETIES = '/varieties'
export const VARIETY_NEW = '/varieties/new'
export const ARCHIVED_VARIETIES = '/varieties/archived'
export const VARIETY = '/varieties/:id'
export const VARIETY_PRICES = '/varieties/:id/prices'
export const VARIETY_PRICE_NEW = '/varieties/:id/prices/new'
export const VARIETY_ENTRIES = '/varieties/:id/entries'
export const CATALOG = '/varieties/catalog'

export const STOCK = '/varieties/entries'
export const STOCK_ENTRY_NEW = '/varieties/entries/new'
export const STOCK_ENTRY = '/varieties/entries/:id'

/** The anchor of a variety's "En el catálogo" section: the catalog screen links to it and
 * the variety's page honours it. Not a path. */
export const CATALOG_SECTION_ID = 'en-el-catalogo'

export const WITHDRAWAL_NEW = '/withdrawals/new'
export const WITHDRAWAL = '/withdrawals/:id'
export const WITHDRAWAL_EDIT = '/withdrawals/:id/edit'

/** The withdrawal form with `varietyId` already chosen on its first line. */
export function withdrawalNewFor(varietyId: number | string): string {
  return `${WITHDRAWAL_NEW}?variety=${encodeURIComponent(String(varietyId))}`
}

export const MORE = '/more'
export const EXPENSES = '/expenses'
export const EXPENSE_NEW = '/expenses/new'
export const ANALYSIS = '/analysis'

export const SETTINGS = '/settings'
export const SETTINGS_BUSINESS = '/settings/business'
export const SETTINGS_USERS = '/settings/users'
export const SETTINGS_PRICES = '/settings/prices'
export const SETTINGS_INTEGRATIONS = '/settings/integrations'
export const SETTINGS_CATALOG_MESSAGE = '/settings/catalog-message'
export const EXPENSE_CATEGORIES = '/settings/expense-categories'
export const SETTINGS_APPEARANCE = '/settings/appearance'
export const SETTINGS_ACCOUNT = '/settings/account'

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

/** Fills a template's `:name` segments: `pathTo(SALE, { id: 7 })` is `/ventas/7`. */
export function pathTo(template: string, params: Readonly<Record<string, string | number>> = {}): string {
  return template.replace(/:([A-Za-z]+)/g, (_match, name: string) => {
    const value = params[name]
    if (value === undefined) throw new Error(`pathTo: ${template} needs ${name}`)
    return encodeURIComponent(String(value))
  })
}

/** The path as a route-table segment (`'/more'` → `'more'`). */
export function relative(path: string): string {
  return path.replace(/^\//, '')
}

interface ScreenBase {
  id: ScreenId
  path: string
  /** The word "‹ <title>" shows when this screen is somebody's parent. */
  title: string
  /** Which pane a two-pane screen fills; inert until the area issues build the panes. */
  pane?: 'list' | 'detail'
  /**
   * Marks a card whose parent's word depends on the record shown (a variety's name). Such a
   * leaf draws its back only from an override the screen declared for this very record
   * (`useBackParent`), and nothing until then. Only a screen marked here may call the hook.
   */
  backLabel?: 'record'
  /** The route is a modal on a computer: the shell draws no side rail behind its scrim. The
   * only thing that hides the rail; it is never inferred from `pane` or `kind`. */
  modalOnComputer?: true
}

export type Screen =
  | (ScreenBase & { kind: 'root'; place: Place; parent?: undefined })
  | (ScreenBase & { kind: 'card'; parent: Parent; place?: Place })
  | (ScreenBase & { kind: 'form'; parent: Parent; place?: undefined })

/** Declares a screen under `Shell`. Returns it as given: the type is the check. */
export function screen<S extends Screen>(declaration: S): S {
  return declaration
}

export interface Outside {
  path: string
}

/** Declares a route outside `Shell`: a public page or the catch-all. */
export function outside<O extends Outside>(declaration: O): O {
  return declaration
}

export const SCREENS = [
  screen({ id: 'home', path: HOME, kind: 'root', title: SHELL_TEXT.inicio, place: { bar: 'home', rail: 'home' } }),
  screen({ id: 'more', path: MORE, kind: 'root', title: SHELL_TEXT.mas, place: { bar: 'more', rail: 'more' } }),

  screen({ id: 'sales', path: SALES, kind: 'root', title: SHELL_TEXT.ventas, place: { bar: 'sales', rail: 'sales' } }),
  screen({ id: 'sale-new', path: SALE_NEW, kind: 'form', title: SHELL_TEXT.nuevaVenta, parent: 'sales' }),
  screen({ id: 'sale', path: SALE, kind: 'card', title: SHELL_TEXT.venta, parent: 'sales' }),

  screen({
    id: 'customers',
    path: CUSTOMERS,
    kind: 'root',
    title: SHELL_TEXT.clientes,
    pane: 'list',
    place: { bar: 'customers', rail: 'customers' },
  }),
  screen({ id: 'customer-new', path: CUSTOMER_NEW, kind: 'form', title: SHELL_TEXT.nuevoCliente, parent: 'customers' }),
  screen({ id: 'customer', path: CUSTOMER, kind: 'card', title: SHELL_TEXT.cliente, pane: 'detail', parent: 'customers' }),
  screen({ id: 'customer-edit', path: CUSTOMER_EDIT, kind: 'form', title: SHELL_TEXT.editarCliente, parent: 'customer' }),
  screen({
    id: 'customer-payment',
    path: CUSTOMER_PAYMENT,
    kind: 'form',
    title: COMMON_TEXT.registrarCobro,
    parent: 'customers',
    modalOnComputer: true,
  }),

  screen({
    id: 'varieties',
    path: VARIETIES,
    kind: 'root',
    title: COMMON_TEXT.variedades,
    pane: 'list',
    place: { bar: 'varieties', rail: 'varieties' },
  }),
  screen({ id: 'variety', path: VARIETY, kind: 'card', title: SHELL_TEXT.variedad, pane: 'detail', parent: 'varieties', backLabel: 'record' }),
  screen({ id: 'variety-new', path: VARIETY_NEW, kind: 'form', title: SHELL_TEXT.nuevaVariedad, parent: 'varieties' }),
  screen({ id: 'variety-prices', path: VARIETY_PRICES, kind: 'card', title: COMMON_TEXT.precios, parent: 'variety', backLabel: 'record' }),
  screen({ id: 'variety-price-new', path: VARIETY_PRICE_NEW, kind: 'form', title: SHELL_TEXT.nuevoPrecio, parent: 'variety', modalOnComputer: true }),
  screen({ id: 'variety-entries', path: VARIETY_ENTRIES, kind: 'card', title: SHELL_TEXT.entradas, parent: 'variety', backLabel: 'record' }),
  screen({ id: 'catalog', path: CATALOG, kind: 'card', title: SHELL_TEXT.catalogo, parent: 'varieties' }),
  screen({ id: 'stock', path: STOCK, kind: 'card', title: SHELL_TEXT.todasLasEntradas, parent: 'varieties' }),
  screen({ id: 'stock-entry-new', path: STOCK_ENTRY_NEW, kind: 'form', title: SHELL_TEXT.entradaDeStock, parent: 'varieties' }),
  screen({ id: 'stock-entry', path: STOCK_ENTRY, kind: 'form', title: SHELL_TEXT.entradaDeStock, parent: 'stock' }),
  screen({
    id: 'varieties-archived',
    path: ARCHIVED_VARIETIES,
    kind: 'card',
    title: SHELL_TEXT.archivadas,
    pane: 'list',
    parent: 'varieties',
  }),
  screen({ id: 'withdrawal-new', path: WITHDRAWAL_NEW, kind: 'form', title: COMMON_TEXT.sacarDelStock, parent: 'varieties' }),
  screen({ id: 'withdrawal', path: WITHDRAWAL, kind: 'card', title: SHELL_TEXT.retiro, parent: 'varieties' }),
  screen({ id: 'withdrawal-edit', path: WITHDRAWAL_EDIT, kind: 'form', title: COMMON_TEXT.sacarDelStock, parent: 'withdrawal' }),

  screen({
    id: 'expenses',
    path: EXPENSES,
    kind: 'root',
    title: COMMON_TEXT.gastos,
    place: { bar: 'more', rail: 'expenses' },
  }),
  screen({ id: 'expense-new', path: EXPENSE_NEW, kind: 'form', title: SHELL_TEXT.gastoNuevo, parent: 'expenses' }),
  screen({
    id: 'analysis',
    path: ANALYSIS,
    kind: 'root',
    title: COMMON_TEXT.analisis,
    place: { bar: 'more', rail: 'analysis' },
  }),

  screen({
    id: 'settings',
    path: SETTINGS,
    kind: 'card',
    title: COMMON_TEXT.configuracion,
    parent: { phone: 'more', computer: 'home' },
    place: { bar: 'more', rail: 'business' },
  }),
  screen({ id: 'settings-business', path: SETTINGS_BUSINESS, kind: 'form', title: COMMON_TEXT.negocio, parent: 'settings' }),
  screen({ id: 'settings-users', path: SETTINGS_USERS, kind: 'form', title: COMMON_TEXT.usuarios, parent: 'settings' }),
  screen({ id: 'settings-prices', path: SETTINGS_PRICES, kind: 'form', title: COMMON_TEXT.precios, parent: 'settings' }),
  screen({
    id: 'settings-integrations',
    path: SETTINGS_INTEGRATIONS,
    kind: 'form',
    title: INTEGRATIONS_LINK_WORD,
    parent: 'settings',
  }),
  screen({
    id: 'settings-catalog-message',
    path: SETTINGS_CATALOG_MESSAGE,
    kind: 'form',
    title: COMMON_TEXT.mensajeDelCatalogo,
    parent: 'settings',
  }),
  screen({
    id: 'settings-expense-categories',
    path: EXPENSE_CATEGORIES,
    kind: 'form',
    title: COMMON_TEXT.categoriasDeGastos,
    parent: 'settings',
  }),
  screen({
    id: 'settings-appearance',
    path: SETTINGS_APPEARANCE,
    kind: 'form',
    title: COMMON_TEXT.apariencia,
    parent: 'settings',
  }),
  screen({ id: 'settings-account', path: SETTINGS_ACCOUNT, kind: 'form', title: COMMON_TEXT.tuCuenta, parent: 'settings' }),

  // The Onboarding's steps and "Listo" are forms whose parent is Inicio: "Cerrar" and back
  // with no history land there. `router.tsx` draws them in `OnboardingLayout`, the
  // Onboarding's own frame (one centred column, no bar, no rail), not in `Shell`.
  screen({ id: 'onboarding', path: ONBOARDING, kind: 'form', title: SHELL_TEXT.onboarding, parent: 'home' }),
  screen({ id: 'onboarding-variety', path: ONBOARDING_VARIETY, kind: 'form', title: COMMON_TEXT.variedadConPrecio, parent: 'home' }),
  screen({ id: 'onboarding-stock', path: ONBOARDING_STOCK, kind: 'form', title: COMMON_TEXT.stockInicial, parent: 'home' }),
  screen({
    id: 'onboarding-catalog-message',
    path: ONBOARDING_CATALOG_MESSAGE,
    kind: 'form',
    title: COMMON_TEXT.mensajeDelCatalogo,
    parent: 'home',
  }),
  screen({ id: 'onboarding-bot', path: ONBOARDING_BOT, kind: 'form', title: COMMON_TEXT.botDeTelegram, parent: 'home' }),
  screen({ id: 'onboarding-partner', path: ONBOARDING_PARTNER, kind: 'form', title: COMMON_TEXT.socio, parent: 'home' }),
  screen({
    id: 'onboarding-categories',
    path: ONBOARDING_CATEGORIES,
    kind: 'form',
    title: COMMON_TEXT.categoriasDeGastos,
    parent: 'home',
  }),
  screen({ id: 'onboarding-done', path: ONBOARDING_DONE, kind: 'form', title: SHELL_TEXT.listo, parent: 'home' }),
] as const satisfies readonly Screen[]

/** The ids marked `backLabel: 'record'`: the only screens `useBackParent` accepts, by type. */
export type RecordLabelledScreen = Extract<(typeof SCREENS)[number], { backLabel: 'record' }>['id']

/** The Onboarding's screens: drawn by `OnboardingLayout`, outside `Shell` (onboarding.md). */
export const ONBOARDING_SCREENS: ReadonlySet<ScreenId> = new Set<ScreenId>([
  'onboarding',
  'onboarding-variety',
  'onboarding-stock',
  'onboarding-catalog-message',
  'onboarding-bot',
  'onboarding-partner',
  'onboarding-categories',
  'onboarding-done',
])

/** The public pages and the catch-all: every route outside `Shell`. No front code redirects a
 * Spanish path; the server's `LEGACY_FRONT_PATHS` does (308). */
export const OUTSIDE: readonly Outside[] = [
  outside({ path: LOGIN }),
  outside({ path: INVITATION }),
  outside({ path: RESET }),
  outside({ path: CATCH_ALL }),
]

/** The registry entry of one screen. A missing id is a bug in the declaration, so it throws. */
export function screenOf(id: ScreenId): Screen {
  const found = SCREENS.find((candidate) => candidate.id === id)
  if (found === undefined) throw new Error(`routes: no screen declared as ${id}`)
  return found
}

function parentIdOf(entry: Screen, viewport: Viewport): ScreenId | undefined {
  if (entry.parent === undefined) return undefined
  return typeof entry.parent === 'string' ? entry.parent : entry.parent[viewport]
}

export interface ParentRef {
  id: ScreenId
  /** The parent's path template; `pathTo` fills it when the parent has parameters. */
  path: string
  /** The "‹ <title>" label. */
  title: string
}

/** The screen's fixed parent: the "‹ parent" label and the back fallback, from one result. */
export function parentOf(id: ScreenId, viewport: Viewport): ParentRef | undefined {
  const parentId = parentIdOf(screenOf(id), viewport)
  if (parentId === undefined) return undefined
  const parent = screenOf(parentId)
  return { id: parent.id, path: parent.path, title: parent.title }
}

/** The bar's and the rail's mark for the screen: its own, else its nearest ancestor's. */
export function placeOf(id: ScreenId, viewport: Viewport): Place {
  const seen = new Set<ScreenId>()
  let entry: Screen | undefined = screenOf(id)
  while (entry !== undefined) {
    if (entry.place !== undefined) return entry.place
    if (seen.has(entry.id)) throw new Error(`routes: ${id} has a parent cycle`)
    seen.add(entry.id)
    const parentId = parentIdOf(entry, viewport)
    entry = parentId === undefined ? undefined : screenOf(parentId)
  }
  throw new Error(`routes: ${id} has no place in its parent chain`)
}

/** Whether `value` names a declared screen; a route's `handle.screen` is checked with it. */
export function isScreenId(value: unknown): value is ScreenId {
  return SCREENS.some((candidate) => candidate.id === value)
}

function matchesTemplate(path: string, template: string): boolean {
  const have = path.split('/')
  const want = template.split('/')
  return (
    have.length === want.length &&
    want.every((segment, index) => (segment.startsWith(':') ? have[index] !== '' : segment === have[index]))
  )
}

/** Whether `path` is one of the public pages (Entrar, an invitation, a reset). */
export function isPublicPath(path: string): boolean {
  return [LOGIN, INVITATION, RESET].some((template) => matchesTemplate(path, template))
}
