/**
 * The only author of a route path in the front: no component, hook, test or
 * `navigate`/`Link`/`Navigate` call spells one out (an architecture test scans for it).
 * The values are the English paths of `scripts/design/screens.json`; the old Spanish
 * ones live only in `legacy.ts`.
 */

type Id = string | number

export const paths = {
  home: () => '/',
  login: () => '/login',
  sales: () => '/sales',
  newSale: () => '/sales/new',
  sale: (id: Id) => `/sales/${id}`,
  customers: () => '/customers',
  newCustomer: () => '/customers/new',
  customer: (id: Id) => `/customers/${id}`,
  editCustomer: (id: Id) => `/customers/${id}/edit`,
  customersOwing: () => '/customers/owing',
  varieties: () => '/varieties',
  variety: (id: Id) => `/varieties/${id}`,
  catalog: () => '/varieties/catalog',
  entries: () => '/varieties/entries',
  newEntry: () => '/varieties/entries/new',
  entry: (id: Id) => `/varieties/entries/${id}`,
  expenses: () => '/expenses',
  newExpense: () => '/expenses/new',
  expenseCategories: () => '/settings/expense-categories',
  analysis: () => '/analysis',
  more: () => '/more',
  settings: () => '/settings',
  settingsBusiness: () => '/settings/business',
  settingsUsers: () => '/settings/users',
  settingsAccount: () => '/settings/account',
  settingsIntegrations: () => '/settings/integrations',
  settingsCatalogMessage: () => '/settings/catalog-message',
  invitation: (token: string) => `/invitation/${token}`,
  reset: (token: string) => `/reset/${token}`,
} as const
