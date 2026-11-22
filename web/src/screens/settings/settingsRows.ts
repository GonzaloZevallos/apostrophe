/**
 * The one typed registry of the Settings rows: the label, second line, icon and address of
 * each row live here and nowhere else. `unaccountedSettingsRoutes` is the rule that keeps it
 * in step with the routes: every `/settings/*` path is at least one row's `to`, or is listed
 * in `NON_ROW_ROUTES` with a reason, never both, and only `SHARED_TO` may repeat a `to`.
 */

import type { NombreIcono } from '../../components/Icono'
import type { LanguageTag } from '../../api/language'
import type { CopyKey } from '../../i18n/resources.generated'
import {
  EXPENSE_CATEGORIES,
  SETTINGS_ACCOUNT,
  SETTINGS_APPEARANCE,
  SETTINGS_BUSINESS,
  SETTINGS_CATALOG_MESSAGE,
  SETTINGS_CURRENCY,
  SETTINGS_CUSTOMER_TYPES,
  SETTINGS_INTEGRATIONS,
  SETTINGS_PAYMENT_METHODS,
  SETTINGS_PAYMENT_METHODS_ARCHIVED,
  SETTINGS_PAYMENTS,
  SETTINGS_PRICES,
  SETTINGS_USERS,
  SETTINGS_WITHDRAWAL_REASONS,
} from '../../routes'

/** The groups, in the order they show. */
export const SETTINGS_GROUPS = ['business', 'catalog', 'paymentsAndStock', 'channels', 'teamAndApp'] as const

export type SettingsGroup = (typeof SETTINGS_GROUPS)[number]

export type SettingsRowKey =
  | 'businessName'
  | 'currency'
  | 'language'
  | 'prices'
  | 'customerTypes'
  | 'paymentMethods'
  | 'expenseCategories'
  | 'withdrawalReasons'
  | 'integrations'
  | 'catalogMessage'
  | 'users'
  | 'theme'
  | 'account'

/** What a row's `isShown` reads. `undefined` is "not known yet": it never shows a conditional row. */
export interface SettingsRowContext {
  readonly selectableLanguages: readonly LanguageTag[] | undefined
  readonly isCustomerTypesOn: boolean | undefined
}

export interface SettingsRow {
  readonly key: SettingsRowKey
  readonly group: SettingsGroup
  readonly labelKey: CopyKey
  readonly descriptionKey: CopyKey
  readonly icon: NombreIcono
  readonly to: string
  readonly isShown: (ctx: SettingsRowContext) => boolean
}

function always(): boolean {
  return true
}

function row(
  key: SettingsRowKey,
  group: SettingsGroup,
  icon: NombreIcono,
  to: string,
  isShown: (ctx: SettingsRowContext) => boolean = always,
): SettingsRow {
  return {
    key,
    group,
    labelKey: `settings:rows.${key}.label`,
    descriptionKey: `settings:rows.${key}.description`,
    icon,
    to,
    isShown,
  }
}

export const SETTINGS_ROWS: readonly SettingsRow[] = [
  row('businessName', 'business', 'negocio', SETTINGS_BUSINESS),
  row('currency', 'business', 'monedas', SETTINGS_CURRENCY),
  row(
    'language',
    'business',
    'bandera',
    SETTINGS_BUSINESS,
    (ctx) => ctx.selectableLanguages !== undefined && ctx.selectableLanguages.length > 1,
  ),
  row('prices', 'catalog', 'precio', SETTINGS_PRICES),
  row('customerTypes', 'catalog', 'etiqueta', SETTINGS_CUSTOMER_TYPES, (ctx) => ctx.isCustomerTypesOn === true),
  row('paymentMethods', 'paymentsAndStock', 'tarjeta', SETTINGS_PAYMENT_METHODS),
  row('expenseCategories', 'paymentsAndStock', 'categorias', EXPENSE_CATEGORIES),
  row('withdrawalReasons', 'paymentsAndStock', 'salidaStock', SETTINGS_WITHDRAWAL_REASONS),
  row('integrations', 'channels', 'integraciones', SETTINGS_INTEGRATIONS),
  row('catalogMessage', 'channels', 'mensaje', SETTINGS_CATALOG_MESSAGE),
  row('users', 'teamAndApp', 'usuarios', SETTINGS_USERS),
  row('theme', 'teamAndApp', 'apariencia', SETTINGS_APPEARANCE),
  row('account', 'teamAndApp', 'cuenta', SETTINGS_ACCOUNT),
]

export interface NonRowRoute {
  readonly to: string
  readonly reason: string
}

/** `/settings/*` routes that are not a setting's page, each with why. */
export const NON_ROW_ROUTES: readonly NonRowRoute[] = [
  { to: SETTINGS_PAYMENTS, reason: 'reached only from the computer list' },
  { to: SETTINGS_PAYMENT_METHODS_ARCHIVED, reason: 'a sub-screen of Payment methods' },
]

/** The only `to` more than one row may share, with the rows that share it. */
export const SHARED_TO: Readonly<Record<string, readonly SettingsRowKey[]>> = {
  [SETTINGS_BUSINESS]: ['businessName', 'language'],
}

export type SettingsRouteProblemKind = 'unlisted' | 'both' | 'notAPath' | 'sharedUnnamed'

export interface SettingsRouteProblem {
  readonly kind: SettingsRouteProblemKind
  readonly to: string
}

const KIND_ORDER: readonly SettingsRouteProblemKind[] = ['unlisted', 'both', 'notAPath', 'sharedUnnamed']

const SETTINGS_PREFIX = '/settings/'

function sameKeys(left: readonly string[], right: readonly string[]): boolean {
  const leftSet = new Set(left)
  const rightSet = new Set(right)
  return leftSet.size === rightSet.size && [...leftSet].every((entry) => rightSet.has(entry))
}

/**
 * What breaks the route rule over `paths`, each problem once, sorted by kind and then by `to`.
 * Paths are compared as exact strings; bare `/settings` is never reported.
 */
export function unaccountedSettingsRoutes(
  paths: readonly string[],
  rows: readonly Pick<SettingsRow, 'key' | 'to'>[],
  nonRows: readonly NonRowRoute[],
  shared: Readonly<Record<string, readonly string[]>>,
): readonly SettingsRouteProblem[] {
  const pathSet = new Set(paths)
  const rowTos = new Set(rows.map((entry) => entry.to))
  const nonRowTos = new Set(nonRows.map((entry) => entry.to))
  const problems = new Map<string, SettingsRouteProblem>()
  const report = (kind: SettingsRouteProblemKind, to: string): void => {
    problems.set(`${kind} ${to}`, { kind, to })
  }

  for (const path of pathSet) {
    if (path.startsWith(SETTINGS_PREFIX) && !rowTos.has(path) && !nonRowTos.has(path)) report('unlisted', path)
  }
  for (const to of rowTos) {
    if (nonRowTos.has(to)) report('both', to)
    if (!pathSet.has(to)) report('notAPath', to)
  }
  const keysByTo = new Map<string, string[]>()
  for (const entry of rows) keysByTo.set(entry.to, [...(keysByTo.get(entry.to) ?? []), entry.key])
  for (const [to, keys] of keysByTo) {
    if (keys.length > 1 && !sameKeys(keys, shared[to] ?? [])) report('sharedUnnamed', to)
  }

  return [...problems.values()].sort(
    (left, right) =>
      KIND_ORDER.indexOf(left.kind) - KIND_ORDER.indexOf(right.kind) ||
      (left.to < right.to ? -1 : left.to > right.to ? 1 : 0),
  )
}
