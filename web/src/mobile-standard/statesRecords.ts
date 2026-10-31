/**
 * The forms, sheets and confirmations of the records areas (customers, stock, prices,
 * varieties, the catalogue, expenses and Configuración) the phone walk visits beside the
 * registry's routes. A state is a unique name, a starting route, the steps that reach it
 * and one element that must be visible once there. No step saves: every write the app
 * could send is aborted by the walk, and these states stop before one.
 */

import {
  CUSTOMERS,
  EXPENSE_CATEGORIES,
  EXPENSES,
  MORE,
  pathTo,
  SETTINGS_ACCOUNT,
  SETTINGS_TIME_ZONE,
  STOCK,
  STOCK_ENTRY,
  VARIETIES,
  VARIETY,
} from '../routes.ts'
import { AUTH_TEXT } from '../copy/auth.ts'
import { common, refusal, timeZone } from './copy.ts'
import { REFUSAL_KEY } from '../api/refusals.ts'
import { CUSTOMERS_TEXT } from '../copy/customers.ts'
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

export const RECORDS_STATES: readonly WalkState[] = [
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
    screen: 'ConfiguracionContrasena',
    route: SETTINGS_ACCOUNT,
    steps: [{ click: common('common:changePassword') }],
    visible: AUTH_TEXT.currentPassword,
  },

  // The Time zone sheet: the search narrowing the list, the empty search, the fixed refusal
  // (the write is stubbed, never sent) and the open "More info".
  {
    screen: 'ZonaHorariaBusqueda',
    route: SETTINGS_TIME_ZONE,
    steps: [{ fill: { label: timeZone('timeZone:searchLabel'), value: 'tokyo' } }],
    visible: 'Asia/Tokyo',
  },
  {
    screen: 'ZonaHorariaSinResultados',
    route: SETTINGS_TIME_ZONE,
    steps: [{ fill: { label: timeZone('timeZone:searchLabel'), value: 'zzzz' } }],
    visible: timeZone('timeZone:empty', { query: 'zzzz' }),
  },
  {
    screen: 'ZonaHorariaRechazo',
    route: SETTINGS_TIME_ZONE,
    steps: [{ click: timeZone('timeZone:save') }],
    visible: refusal({ key: REFUSAL_KEY.unknown_time_zone }),
    writes: [{ method: 'PUT', path: /^\/business\/time-zone$/, status: 422, body: { code: 'unknown_time_zone' } }],
  },
  {
    screen: 'ZonaHorariaMasInfo',
    route: SETTINGS_TIME_ZONE,
    steps: [{ click: common('common:moreInfo') }],
    visible: timeZone('timeZone:moreInfoBody'),
  },
]
