/**
 * The only author of a route path in the front: no component, hook, test or
 * `navigate`/`Link`/`Navigate` call spells one out (an architecture test scans for it).
 * Today these are the Spanish paths; the `routes` subtask flips the values.
 */

type Id = string | number

export const paths = {
  home: () => '/',
  login: () => '/entrar',
  sales: () => '/ventas',
  newSale: () => '/ventas/nueva',
  sale: (id: Id) => `/ventas/${id}`,
  customers: () => '/clientes',
  newCustomer: () => '/clientes/nuevo',
  customer: (id: Id) => `/clientes/${id}`,
  editCustomer: (id: Id) => `/clientes/${id}/editar`,
  customersOwing: () => '/clientes/deben',
  varieties: () => '/variedades',
  variety: (id: Id) => `/variedades/${id}`,
  catalog: () => '/catalogo',
  entries: () => '/mi-stock',
  newEntry: () => '/mi-stock/nueva-entrada',
  entry: (id: Id) => `/mi-stock/entradas/${id}`,
  expenses: () => '/gastos',
  newExpense: () => '/gastos/nuevo',
  expenseCategories: () => '/gastos/categorias',
  analysis: () => '/analisis',
  more: () => '/mas',
  business: () => '/negocio',
  settingsBusiness: () => '/settings/business',
  settingsUsers: () => '/settings/users',
  settingsAccount: () => '/settings/account',
  invitation: (token: string) => `/invitation/${token}`,
  reset: (token: string) => `/reset/${token}`,
} as const
