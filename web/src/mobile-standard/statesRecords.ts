/**
 * The forms, sheets and confirmations of the records areas (customers, stock, prices,
 * varieties, the catalogue, expenses and Configuración) the phone walk visits beside the
 * registry's routes. A state is a unique name, a starting route, the steps that reach it
 * and one element that must be visible once there. No step saves: every write the app
 * could send is aborted by the walk, and these states stop before one.
 */

import * as auth from '../copy/auth.ts'
import { SAVE, WORD_YES_DELETE_IT } from '../copy/common.ts'
import * as customers from '../copy/customers.ts'
import * as expenses from '../copy/expenses.ts'
import * as settings from '../copy/settings.ts'
import * as stock from '../copy/stock.ts'
import * as varieties from '../copy/varieties.ts'
import {
  CUSTOMERS,
  EXPENSE_CATEGORIES,
  EXPENSES,
  MORE,
  pathTo,
  SETTINGS_ACCOUNT,
  STOCK,
  STOCK_ENTRY,
  VARIETIES,
  VARIETY,
} from '../routes.ts'
import type { WalkState } from './states.ts'

/*
 * Configuración's other inner states are not walked, each for a reason: Usuarios' invite
 * panel and the Integraciones token field exist only after a write the walk aborts (the
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
    steps: [{ fill: { label: customers.SEARCH_LABEL, value: 'Nico' } }],
    visible: 'Nico Parra',
  },

  {
    screen: 'EntradasTodas',
    route: STOCK,
    steps: [],
    visible: stock.ALL_ENTRIES_TITLE,
  },
  {
    screen: 'EntradaStockConfirmarCambios',
    route: ENTRY_ROUTE,
    steps: [{ wait: stock.EDIT_ENTRY_TITLE }, { click: SAVE }],
    visible: stock.SAVE_CHANGES_TITLE,
  },
  {
    screen: 'EntradaStockConfirmarBorrado',
    route: ENTRY_ROUTE,
    steps: [{ click: stock.DELETE_ENTRY }],
    visible: stock.BEFORE_DELETING,
  },

  {
    screen: 'PrecioNuevoFormulario',
    route: LOW_VARIETY,
    steps: [{ click: varieties.NEW_PRICE }],
    visible: varieties.SAVE_PRICE,
  },
  {
    screen: 'PrecioConfirmarBorrado',
    route: LOW_VARIETY,
    steps: [{ press: varieties.DELETE_PRICE }],
    visible: WORD_YES_DELETE_IT,
  },
  { screen: 'VariedadNuevaFormulario', route: VARIETIES, steps: [{ click: varieties.NEW_VARIETY }], visible: varieties.ADD_VARIETY },
  {
    screen: 'VariedadRenombrar',
    route: LOW_VARIETY,
    steps: [{ press: varieties.EDIT_NAME }],
    visible: SAVE,
  },
  { screen: 'VariedadUmbral', route: LOW_VARIETY, steps: [{ press: varieties.EDIT_WARNING }], visible: SAVE },

  {
    screen: 'CatalogoAtributos',
    route: LOW_VARIETY,
    steps: [{ press: varieties.EDIT_CATALOG }],
    visible: SAVE,
  },

  {
    screen: 'GastoDesdeMas',
    route: MORE,
    steps: [{ click: expenses.ADD_EXPENSE }],
    visible: expenses.SAVE_EXPENSE,
  },
  {
    screen: 'GastoDesdeGastos',
    route: EXPENSES,
    steps: [{ activate: expenses.ADD_EXPENSE }],
    visible: expenses.SAVE_EXPENSE,
  },
  {
    screen: 'GastoEditar',
    route: EXPENSES,
    steps: [{ activate: 'Bolsitas zip' }],
    visible: expenses.FORM_TITLE_EDIT,
  },
  {
    screen: 'GastoConfirmarBorrado',
    route: EXPENSES,
    steps: [{ activate: 'Bolsitas zip' }, { activate: expenses.DELETE_EXPENSE }],
    visible: expenses.DELETE_TITLE,
  },

  {
    screen: 'ConfiguracionCategoriaRenombrar',
    route: EXPENSE_CATEGORIES,
    steps: [{ click: settings.RENAME }],
    visible: SAVE,
  },
  {
    screen: 'ConfiguracionCategoriaConfirmarBorrado',
    route: EXPENSE_CATEGORIES,
    steps: [{ click: settings.DELETE }],
    visible: settings.DELETE_CATEGORY_QUESTION,
  },
  {
    screen: 'ConfiguracionContrasena',
    route: SETTINGS_ACCOUNT,
    steps: [{ click: auth.CHANGE_PASSWORD }],
    visible: auth.CURRENT_PASSWORD_LABEL,
  },
]
