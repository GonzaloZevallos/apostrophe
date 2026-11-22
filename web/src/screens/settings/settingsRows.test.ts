import { describe, expect, test } from 'vitest'
import { LIMITS, measure } from '../../copy/limits'
import { testT } from '../../i18n/testing'
import { ROUTE_REGISTRY } from '../../mobile-standard/registry'
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
import {
  NON_ROW_ROUTES,
  SETTINGS_GROUPS,
  SETTINGS_ROWS,
  SHARED_TO,
  unaccountedSettingsRoutes,
  type SettingsRow,
  type SettingsRowContext,
} from './settingsRows'

const PATHS = ROUTE_REGISTRY.map((route) => route.path)

const NO_CONTEXT: SettingsRowContext = { selectableLanguages: undefined, isCustomerTypesOn: undefined }

function row(rowKey: SettingsRow['key']): SettingsRow {
  const found = SETTINGS_ROWS.find((candidate) => candidate.key === rowKey)
  if (found === undefined) throw new Error(`no row ${rowKey}`)
  return found
}

describe('unaccountedSettingsRoutes', () => {
  test('returns nothing over the registered paths', () => {
    expect(unaccountedSettingsRoutes(PATHS, SETTINGS_ROWS, NON_ROW_ROUTES, SHARED_TO)).toEqual([])
  })

  test('reports an added settings path nobody accounts for', () => {
    expect(unaccountedSettingsRoutes([...PATHS, '/settings/x'], SETTINGS_ROWS, NON_ROW_ROUTES, SHARED_TO)).toEqual([
      { kind: 'unlisted', to: '/settings/x' },
    ])
  })

  test('reports an added settings path with a parameter', () => {
    expect(
      unaccountedSettingsRoutes([...PATHS, '/settings/x/:id'], SETTINGS_ROWS, NON_ROW_ROUTES, SHARED_TO),
    ).toEqual([{ kind: 'unlisted', to: '/settings/x/:id' }])
  })

  test('never reports the bare settings path or a path outside settings', () => {
    expect(
      unaccountedSettingsRoutes([...PATHS, '/settings', '/other'], SETTINGS_ROWS, NON_ROW_ROUTES, SHARED_TO),
    ).toEqual([])
  })

  test('reports a path that is a row to and also a non-row route', () => {
    const nonRows = [...NON_ROW_ROUTES, { to: SETTINGS_USERS, reason: 'tried twice' }]
    expect(unaccountedSettingsRoutes(PATHS, SETTINGS_ROWS, nonRows, SHARED_TO)).toEqual([
      { kind: 'both', to: SETTINGS_USERS },
    ])
  })

  test('reports a row to that is not exactly a path, trailing slash included', () => {
    const rows = SETTINGS_ROWS.map((candidate) =>
      candidate.key === 'users' ? { ...candidate, to: '/settings/users/' } : candidate,
    )
    expect(unaccountedSettingsRoutes(PATHS, rows, NON_ROW_ROUTES, SHARED_TO)).toEqual([
      { kind: 'unlisted', to: SETTINGS_USERS },
      { kind: 'notAPath', to: '/settings/users/' },
    ])
  })

  test('reports a second repeated to that the shared table does not name', () => {
    const rows = SETTINGS_ROWS.map((candidate) =>
      candidate.key === 'theme' ? { ...candidate, to: SETTINGS_ACCOUNT } : candidate,
    )
    expect(unaccountedSettingsRoutes(PATHS, rows, NON_ROW_ROUTES, SHARED_TO)).toEqual([
      { kind: 'unlisted', to: SETTINGS_APPEARANCE },
      { kind: 'sharedUnnamed', to: SETTINGS_ACCOUNT },
    ])
  })

  test('reports the shared to when its named keys are not the rows that repeat it', () => {
    const wrongNames = { [SETTINGS_BUSINESS]: ['businessName', 'users'] }
    expect(unaccountedSettingsRoutes(PATHS, SETTINGS_ROWS, NON_ROW_ROUTES, wrongNames)).toEqual([
      { kind: 'sharedUnnamed', to: SETTINGS_BUSINESS },
    ])
  })

  test('reports each problem once and sorts by kind, then by to', () => {
    const rows = SETTINGS_ROWS.map((candidate) =>
      candidate.key === 'users' ? { ...candidate, to: '/settings/users/' } : candidate,
    )
    const problems = unaccountedSettingsRoutes(
      [...PATHS, '/settings/z', '/settings/z', '/settings/a'],
      rows,
      NON_ROW_ROUTES,
      SHARED_TO,
    )
    expect(problems).toEqual([
      { kind: 'unlisted', to: '/settings/a' },
      { kind: 'unlisted', to: SETTINGS_USERS },
      { kind: 'unlisted', to: '/settings/z' },
      { kind: 'notAPath', to: '/settings/users/' },
    ])
  })

  test('accounts for the routes of the plan, one shared to only', () => {
    const accounted = new Map<string, string[]>()
    for (const candidate of SETTINGS_ROWS) {
      accounted.set(candidate.to, [...(accounted.get(candidate.to) ?? []), candidate.key])
    }
    expect(Object.fromEntries(accounted)).toEqual({
      [SETTINGS_BUSINESS]: ['businessName', 'language'],
      [SETTINGS_CURRENCY]: ['currency'],
      [SETTINGS_PRICES]: ['prices'],
      [SETTINGS_CUSTOMER_TYPES]: ['customerTypes'],
      [SETTINGS_PAYMENT_METHODS]: ['paymentMethods'],
      [EXPENSE_CATEGORIES]: ['expenseCategories'],
      [SETTINGS_WITHDRAWAL_REASONS]: ['withdrawalReasons'],
      [SETTINGS_INTEGRATIONS]: ['integrations'],
      [SETTINGS_CATALOG_MESSAGE]: ['catalogMessage'],
      [SETTINGS_USERS]: ['users'],
      [SETTINGS_APPEARANCE]: ['theme'],
      [SETTINGS_ACCOUNT]: ['account'],
    })
    expect(NON_ROW_ROUTES).toEqual([
      { to: SETTINGS_PAYMENTS, reason: 'reached only from the computer list' },
      { to: SETTINGS_PAYMENT_METHODS_ARCHIVED, reason: 'a sub-screen of Payment methods' },
    ])
  })
})

describe('SETTINGS_ROWS', () => {
  test('keys are unique and icons are distinct', () => {
    const keys = SETTINGS_ROWS.map((candidate) => candidate.key)
    const icons = SETTINGS_ROWS.map((candidate) => candidate.icon)
    expect(new Set(keys).size).toBe(keys.length)
    expect(new Set(icons).size).toBe(icons.length)
  })

  test('the groups show in the order of the tuple and every row belongs to one', () => {
    expect(SETTINGS_GROUPS).toEqual(['business', 'catalog', 'paymentsAndStock', 'channels', 'teamAndApp'])
    for (const candidate of SETTINGS_ROWS) expect(SETTINGS_GROUPS).toContain(candidate.group)
    expect(SETTINGS_ROWS.map((candidate) => [candidate.key, candidate.group])).toEqual([
      ['businessName', 'business'],
      ['currency', 'business'],
      ['language', 'business'],
      ['prices', 'catalog'],
      ['customerTypes', 'catalog'],
      ['paymentMethods', 'paymentsAndStock'],
      ['expenseCategories', 'paymentsAndStock'],
      ['withdrawalReasons', 'paymentsAndStock'],
      ['integrations', 'channels'],
      ['catalogMessage', 'channels'],
      ['users', 'teamAndApp'],
      ['theme', 'teamAndApp'],
      ['account', 'teamAndApp'],
    ])
  })

  test('the language row shows only with more than one selectable language', () => {
    const { isShown } = row('language')
    const ctx = (selectableLanguages: readonly string[] | undefined): SettingsRowContext => ({
      ...NO_CONTEXT,
      selectableLanguages,
    })
    expect(isShown(ctx(undefined))).toBe(false)
    expect(isShown(ctx([]))).toBe(false)
    expect(isShown(ctx(['en']))).toBe(false)
    expect(isShown(ctx(['en', 'es']))).toBe(true)
  })

  test('the customer types row shows only while its switch is on', () => {
    const { isShown } = row('customerTypes')
    const ctx = (isCustomerTypesOn: boolean | undefined): SettingsRowContext => ({ ...NO_CONTEXT, isCustomerTypesOn })
    expect(isShown(ctx(undefined))).toBe(false)
    expect(isShown(ctx(false))).toBe(false)
    expect(isShown(ctx(true))).toBe(true)
  })

  test('every other row shows in every context', () => {
    const contexts: SettingsRowContext[] = [
      NO_CONTEXT,
      { selectableLanguages: [], isCustomerTypesOn: false },
      { selectableLanguages: ['en', 'es'], isCustomerTypesOn: true },
    ]
    for (const candidate of SETTINGS_ROWS) {
      if (candidate.key === 'language' || candidate.key === 'customerTypes') continue
      for (const ctx of contexts) expect(candidate.isShown(ctx)).toBe(true)
    }
  })
})

describe('settings copy', () => {
  test('every label and description resolves to text and a description fits the help limit', () => {
    for (const candidate of SETTINGS_ROWS) {
      const label = testT(candidate.labelKey)
      const description = testT(candidate.descriptionKey)
      expect(label).not.toBe(candidate.labelKey)
      expect(description).not.toBe(candidate.descriptionKey)
      expect(measure(description)).toBeLessThanOrEqual(LIMITS.help)
    }
  })

  test('the title and every group heading resolve', () => {
    expect(testT('settings:home.title')).toBe('Settings')
    expect(SETTINGS_GROUPS.map((group) => testT(`settings:groups.${group}`))).toEqual([
      'Business',
      'Catalog',
      'Payments and stock',
      'Channels',
      'Team and app',
    ])
  })

  test('the card counts one user and many users', () => {
    expect(testT('settings:card.users', { count: 1 })).toBe('1 user')
    expect(testT('settings:card.users', { count: 2 })).toBe('2 users')
  })
})
