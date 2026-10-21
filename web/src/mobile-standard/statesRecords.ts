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
  STOCK,
  STOCK_ENTRY,
  VARIETIES,
  VARIETY,
} from '../routes.ts'
import { COMMON_TEXT } from '../copy/common.ts'
import { STOCK_TEXT } from '../copy/stock.ts'
import { VARIETIES_TEXT } from '../copy/varieties.ts'
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
    steps: [{ fill: { label: 'Buscar cliente', value: 'Nico' } }],
    visible: 'Nico Parra',
  },

  {
    screen: 'EntradasTodas',
    route: STOCK,
    steps: [],
    visible: COMMON_TEXT.allEntries,
  },
  {
    screen: 'EntradaStockConfirmarCambios',
    route: ENTRY_ROUTE,
    steps: [{ wait: STOCK_TEXT.editarEntrada }, { click: COMMON_TEXT.save }],
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
    steps: [{ click: COMMON_TEXT.newPrice }],
    visible: VARIETIES_TEXT.guardaElPrecio,
  },
  {
    screen: 'PrecioConfirmarBorrado',
    route: LOW_VARIETY,
    steps: [{ press: VARIETIES_TEXT.borrarEstePrecio }],
    visible: COMMON_TEXT.yesDelete,
  },
  { screen: 'VariedadNuevaFormulario', route: VARIETIES, steps: [{ click: COMMON_TEXT.newVariety }], visible: VARIETIES_TEXT.agregaLaVariedad },
  {
    screen: 'VariedadRenombrar',
    route: LOW_VARIETY,
    steps: [{ press: VARIETIES_TEXT.editarNombre }],
    visible: COMMON_TEXT.saveTheName,
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
    steps: [{ click: COMMON_TEXT.addExpense }],
    visible: 'Guardá el gasto',
  },
  {
    screen: 'GastoDesdeGastos',
    route: EXPENSES,
    steps: [{ activate: COMMON_TEXT.addExpense }],
    visible: 'Guardá el gasto',
  },
  {
    screen: 'GastoEditar',
    route: EXPENSES,
    steps: [{ activate: 'Bolsitas zip' }],
    visible: 'Editar gasto',
  },
  {
    screen: 'GastoConfirmarBorrado',
    route: EXPENSES,
    steps: [{ activate: 'Bolsitas zip' }, { activate: 'Borrar gasto' }],
    visible: '¿Borrás el gasto?',
  },

  {
    screen: 'ConfiguracionCategoriaRenombrar',
    route: EXPENSE_CATEGORIES,
    steps: [{ click: 'Renombrar' }],
    visible: COMMON_TEXT.save,
  },
  {
    screen: 'ConfiguracionCategoriaConfirmarBorrado',
    route: EXPENSE_CATEGORIES,
    steps: [{ click: 'Eliminar' }],
    visible: '¿Borrás la categoría?',
  },
  {
    screen: 'ConfiguracionContrasena',
    route: SETTINGS_ACCOUNT,
    steps: [{ click: COMMON_TEXT.changePassword }],
    visible: 'Contraseña actual',
  },
]
