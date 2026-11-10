/**
 * The forms, sheets and confirmations of the records areas (customers, stock, prices,
 * varieties, the catalogue, expenses and Configuración) the phone walk visits beside the
 * registry's routes. A state is a unique name, a starting route, the steps that reach it
 * and one element that must be visible once there. No step saves: every write the app
 * could send is aborted by the walk, and these states stop before one.
 */

import {
  CUSTOMER,
  CUSTOMER_NEW,
  CUSTOMERS,
  EXPENSE_CATEGORIES,
  EXPENSE_NEW,
  EXPENSES,
  MORE,
  pathTo,
  SETTINGS_ACCOUNT,
  SETTINGS_WITHDRAWAL_REASONS,
  SETTINGS_CUSTOMER_TYPES,
  STOCK,
  STOCK_ENTRY,
  STOCK_ENTRY_NEW,
  VARIETIES,
  VARIETY,
  WITHDRAWAL_EDIT,
  WITHDRAWAL_NEW,
} from '../routes.ts'
import { AUTH_TEXT } from '../copy/auth.ts'
import { common, emptyState } from './copy.ts'
import { CUSTOMERS_TEXT } from '../copy/customers.ts'
import { EXPENSES_TEXT } from '../copy/expenses.ts'
import { SETTINGS_TEXT } from '../copy/settings.ts'
import { STOCK_TEXT } from '../copy/stock.ts'
import { VARIETIES_TEXT } from '../copy/varieties.ts'
import type { WalkState } from './states.ts'

/*
 * Configuración's other inner states are not walked, each for a reason: Usuarios' invite
 * panel and the Integrations token field exist only after a write the walk aborts (the
 * invitation is a POST), or never in this fixture (no bot token is saved, so the field is
 * already open and "Cambiar" is absent). The new-category field is always on its group's
 * route, which the registry walks.
 */

/**
 * The first stock entry the sample app seeds (24K Gold, 120 g): entries are numbered in the
 * order `sample_app.seed` makes them, and a list row cannot be tapped on the phone today
 * (its neighbour's row overlaps it), so the walk opens the entry by its route.
 */
const ENTRY_ROUTE = pathTo(STOCK_ENTRY, { id: 1 })

/** The variety the sample app seeds below its stock threshold, by the registry's placeholder. */
const LOW_VARIETY = VARIETY.replace(':id', '{low}')

const SAMPLE_TYPES = [
  { id: 1, name: 'Friends', icon: 'heart', is_vip: false },
  { id: 2, name: 'Wholesale', icon: 'star', is_vip: true },
]

const SAMPLE_TYPED_CUSTOMER = {
  id: 1,
  name: 'Ana Pérez',
  phone: null,
  vip: true,
  customer_type_id: 2,
  balance: 0,
  owing_since: null,
  standing: 'settled',
}

/**
 * Twelve listed Varieties, one with a 60-character name, so the Variety Selector's list shows
 * its search and its longest row. Seeded for this state's reads only, never the pinned fixture.
 */
const TWELVE_VARIETIES = Array.from({ length: 12 }, (_unused, index) => ({
  id: 100 + index,
  name: index === 11 ? 'Una variedad con un nombre larguísimo de sesenta caracteres!!' : `Variedad ${index + 1}`,
  archived: false,
  current_price: null,
}))

const LONG_NAME = 'Una variedad con un nombre larguísimo de sesenta caracteres!!'

/** Twelve Withdrawal reasons, one with a 60-character name, seeded for these states' reads only. */
const TWELVE_REASONS = Array.from({ length: 12 }, (_unused, index) => ({
  id: 200 + index,
  name: index === 11 ? LONG_NAME : `Motivo ${index + 1}`,
}))

/** Twelve Customer types, one with a 60-character name, seeded for the type list's state only. */
const TWELVE_TYPES = Array.from({ length: 12 }, (_unused, index) => ({
  id: 300 + index,
  name: index === 11 ? LONG_NAME : `Tipo ${index + 1}`,
  icon: 'star',
  is_vip: false,
}))

/** Entry 1 pointed at a Variety that is archived: no listed Variety has this id. */
const ARCHIVED_ENTRY = {
  id: 1,
  date: '2026-09-20',
  product_id: 9999,
  origin: 'harvest',
  quantity: 25,
  total_cost: null,
  cost_per_gram: null,
  note: null,
}
const ARCHIVED_ENTRY_READ = { path: /^\/stock\/entries\/1$/, status: 200, body: ARCHIVED_ENTRY }
const ARCHIVED_ONLY = /^\?archived=true$/

export const RECORDS_STATES: readonly WalkState[] = [
  {
    // Twelve reasons, one of 60 characters: the phone list is open and its search shows.
    screen: 'withdrawal/reason-selector-open',
    route: WITHDRAWAL_NEW,
    steps: [{ press: STOCK_TEXT.motivo }],
    visible: 'Motivo 1',
    reads: [{ path: /^\/api\/withdrawal-reasons$/, status: 200, body: TWELVE_REASONS }],
  },
  {
    // The business has no Expense categories: the open Category list shows the empty-set line.
    screen: 'expense/category-selector-empty',
    route: EXPENSE_NEW,
    steps: [{ press: `${common('common:category')} ${EXPENSES_TEXT.pickACategory}` }],
    visible: emptyState('emptyStates:selectorNoCategories'),
    reads: [{ path: /^\/expense-categories$/, status: 200, body: [] }],
  },
  {
    // A stored line on a Variety archived since: its 60-character name shows with the mark.
    screen: 'withdrawal/line-archived-variety',
    route: pathTo(WITHDRAWAL_EDIT, { id: 1 }),
    steps: [],
    visible: common('common:noLongerAvailable'),
    reads: [
      {
        path: /^\/stock\/withdrawals\/1$/,
        status: 200,
        body: {
          id: 1,
          reason_id: 200,
          reason_name: 'Motivo 1',
          date: '2026-10-02',
          note: null,
          total_quantity: 5.5,
          lines: [{ product_id: 9999, product_name: LONG_NAME, quantity: 5.5 }],
        },
      },
      { path: /^\/api\/withdrawal-reasons$/, status: 200, body: TWELVE_REASONS },
      { path: /^\/api\/products$/, status: 200, body: TWELVE_VARIETIES },
    ],
  },
  {
    screen: 'stock-entry/edit-archived-variety',
    route: ENTRY_ROUTE,
    steps: [{ wait: STOCK_TEXT.editarEntrada }],
    visible: 'Variedad antigua',
    reads: [
      ARCHIVED_ENTRY_READ,
      {
        path: /^\/api\/products$/,
        query: ARCHIVED_ONLY,
        status: 200,
        body: [{ id: 9999, name: 'Variedad antigua', archived: true, current_price: null }],
      },
    ],
  },
  {
    screen: 'stock-entry/edit-archived-variety-failed',
    route: ENTRY_ROUTE,
    steps: [{ wait: STOCK_TEXT.editarEntrada }],
    visible: common('common:genericError'),
    reads: [ARCHIVED_ENTRY_READ, { path: /^\/api\/products$/, query: ARCHIVED_ONLY, status: 500 }],
  },
  {
    screen: 'stock-entry/variety-selector-open',
    route: STOCK_ENTRY_NEW,
    steps: [{ press: common('common:variety') }],
    visible: 'Variedad 1',
    reads: [{ path: /^\/api\/products$/, status: 200, body: TWELVE_VARIETIES }],
  },
  {
    // The sample Business has no customer types, so the form's type field is the notice.
    screen: 'ClienteNuevoSinTipos',
    route: CUSTOMER_NEW,
    steps: [],
    visible: CUSTOMERS_TEXT.typeNotice,
    reads: [{ path: /^\/api\/customer-types$/, status: 200, body: [] }],
  },
  {
    // Types are answered by a stub (the sample has none), so the select itself is walked.
    screen: 'ClienteNuevoConTipos',
    route: CUSTOMER_NEW,
    steps: [],
    visible: CUSTOMERS_TEXT.typeLabel,
    reads: [{ path: /^\/api\/customer-types$/, status: 200, body: SAMPLE_TYPES }],
  },
  {
    // Twelve types, one of 60 characters: the phone list is open and its search shows.
    screen: 'customer/type-selector-open',
    route: CUSTOMER_NEW,
    steps: [{ press: `${CUSTOMERS_TEXT.typeLabel} ${common('common:noType')}` }],
    visible: 'Tipo 1',
    reads: [{ path: /^\/api\/customer-types$/, status: 200, body: TWELVE_TYPES }],
  },
  {
    // A customer in a type, answered by a stub, so the detail page's type line is walked.
    screen: 'ClienteFichaConTipo',
    route: CUSTOMER.replace(':id', '{debtor}'),
    steps: [],
    visible: 'Wholesale',
    reads: [
      { path: /^\/api\/customer-types$/, status: 200, body: SAMPLE_TYPES },
      { path: /^\/customers\/\d+$/, status: 200, body: SAMPLE_TYPED_CUSTOMER },
      { path: /^\/customers\/\d+\/account$/, status: 200, body: { balance: 0, owing_since: null, standing: 'settled', rows: [] } },
    ],
  },
  {
    screen: 'ClientesBusqueda',
    route: CUSTOMERS,
    steps: [{ fill: { label: CUSTOMERS_TEXT.searchCustomer, value: 'Nico' } }],
    visible: 'Nico Parra',
  },

  {
    screen: 'EntradasTodas',
    route: STOCK,
    steps: [],
    visible: common('common:allEntries'),
  },
  {
    screen: 'EntradaStockConfirmarCambios',
    route: ENTRY_ROUTE,
    steps: [{ wait: STOCK_TEXT.editarEntrada }, { click: common('common:save') }],
    visible: STOCK_TEXT.guardasLosCambios,
  },
  {
    screen: 'EntradaStockConfirmarBorrado',
    route: ENTRY_ROUTE,
    steps: [{ click: STOCK_TEXT.borrarEntrada }],
    visible: STOCK_TEXT.antesDeBorrar,
  },

  {
    screen: 'PrecioNuevoFormulario',
    route: LOW_VARIETY,
    steps: [{ click: common('common:newPrice') }],
    visible: VARIETIES_TEXT.guardaElPrecio,
  },
  {
    screen: 'PrecioConfirmarBorrado',
    route: LOW_VARIETY,
    steps: [{ press: VARIETIES_TEXT.borrarEstePrecio }],
    visible: common('common:yesDelete'),
  },
  { screen: 'VariedadNuevaFormulario', route: VARIETIES, steps: [{ click: common('common:newVariety') }], visible: VARIETIES_TEXT.agregaLaVariedad },
  {
    screen: 'VariedadRenombrar',
    route: LOW_VARIETY,
    steps: [{ press: VARIETIES_TEXT.editarNombre }],
    visible: common('common:saveTheName'),
  },
  { screen: 'VariedadUmbral', route: LOW_VARIETY, steps: [{ press: VARIETIES_TEXT.editarAviso }], visible: VARIETIES_TEXT.guardaElAviso },

  {
    screen: 'CatalogoAtributos',
    route: LOW_VARIETY,
    steps: [{ press: VARIETIES_TEXT.editarCatalogo }],
    visible: VARIETIES_TEXT.guardaElCatalogo,
  },

  {
    screen: 'GastoDesdeMas',
    route: MORE,
    steps: [{ click: common('common:addExpense') }],
    visible: 'Save the expense',
  },
  {
    screen: 'GastoDesdeGastos',
    route: EXPENSES,
    steps: [{ activate: common('common:addExpense') }],
    visible: 'Save the expense',
  },
  {
    screen: 'GastoEditar',
    route: EXPENSES,
    steps: [{ activate: 'Bolsitas zip' }],
    visible: 'Edit expense',
  },
  {
    screen: 'GastoConfirmarBorrado',
    route: EXPENSES,
    steps: [{ activate: 'Bolsitas zip' }, { activate: 'Delete expense' }],
    visible: 'Delete the expense?',
  },

  {
    screen: 'ConfiguracionCategoriaRenombrar',
    route: EXPENSE_CATEGORIES,
    steps: [{ click: 'Rename' }],
    visible: common('common:save'),
  },
  {
    screen: 'ConfiguracionCategoriaConfirmarBorrado',
    route: EXPENSE_CATEGORIES,
    steps: [{ click: 'Delete' }],
    visible: 'Delete the category?',
  },
  {
    screen: 'ConfiguracionMotivos',
    route: SETTINGS_WITHDRAWAL_REASONS,
    steps: [],
    visible: SETTINGS_TEXT.addWithdrawalReason,
  },
  {
    screen: 'ConfiguracionMotivoNuevo',
    route: SETTINGS_WITHDRAWAL_REASONS,
    steps: [{ click: SETTINGS_TEXT.addWithdrawalReason }],
    visible: common('common:save'),
  },
  {
    screen: 'ConfiguracionMotivoRenombrar',
    route: SETTINGS_WITHDRAWAL_REASONS,
    steps: [{ click: SETTINGS_TEXT.rename }],
    visible: SETTINGS_TEXT.renameReasonTitle,
  },
  {
    screen: 'ConfiguracionMotivoConfirmarBorrado',
    route: SETTINGS_WITHDRAWAL_REASONS,
    steps: [{ click: SETTINGS_TEXT.delete }],
    visible: common('common:cancel'),
  },
  {
    screen: 'ConfiguracionTipoClienteNuevo',
    route: SETTINGS_CUSTOMER_TYPES,
    steps: [{ click: '+ Customer type' }],
    visible: 'New customer type',
  },
  {
    screen: 'ConfiguracionTipoClienteEnUso',
    route: SETTINGS_CUSTOMER_TYPES,
    steps: [{ click: 'Delete Regulars' }],
    visible: '3 customers are in this type. Move them to another type first.',
    reads: [
      {
        path: /^\/api\/customer-types$/,
        status: 200,
        body: [{ id: 1, name: 'Regulars', icon: 'circle', is_vip: false }],
      },
    ],
    writes: [
      { method: 'DELETE', path: /^\/api\/customer-types\/\d+$/, status: 409, body: { code: 'customer_type.in_use', count: 3 } },
    ],
  },
  {
    screen: 'ConfiguracionTipoClienteLista',
    route: SETTINGS_CUSTOMER_TYPES,
    steps: [],
    visible: 'Customer types',
  },
  {
    screen: 'ConfiguracionContrasena',
    route: SETTINGS_ACCOUNT,
    steps: [{ click: common('common:changePassword') }],
    visible: AUTH_TEXT.currentPassword,
  },
]
