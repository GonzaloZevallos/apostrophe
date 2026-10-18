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
    visible: 'Todas las entradas',
  },
  {
    screen: 'EntradaStockConfirmarCambios',
    route: ENTRY_ROUTE,
    steps: [{ wait: 'Editar entrada' }, { click: 'Guardar' }],
    visible: '¿Guardás los cambios?',
  },
  {
    screen: 'EntradaStockConfirmarBorrado',
    route: ENTRY_ROUTE,
    steps: [{ click: 'Borrar entrada' }],
    visible: 'Antes de borrar',
  },

  {
    screen: 'PrecioNuevoFormulario',
    route: LOW_VARIETY,
    steps: [{ click: 'Nuevo precio' }],
    visible: 'Guardá el precio',
  },
  {
    screen: 'PrecioConfirmarBorrado',
    route: LOW_VARIETY,
    steps: [{ press: 'Borrar este precio' }],
    visible: 'Sí, borrala',
  },
  { screen: 'VariedadNuevaFormulario', route: VARIETIES, steps: [{ click: 'Nueva variedad' }], visible: 'Agregá la variedad' },
  {
    screen: 'VariedadRenombrar',
    route: LOW_VARIETY,
    steps: [{ press: 'Editar nombre' }],
    visible: 'Guardá el nombre',
  },
  { screen: 'VariedadUmbral', route: LOW_VARIETY, steps: [{ press: 'Editar aviso' }], visible: 'Guardá el aviso' },

  {
    screen: 'CatalogoAtributos',
    route: LOW_VARIETY,
    steps: [{ press: 'Editar catálogo' }],
    visible: 'Guardá el catálogo',
  },

  {
    screen: 'GastoDesdeMas',
    route: MORE,
    steps: [{ click: 'Cargar gasto' }],
    visible: 'Guardá el gasto',
  },
  {
    screen: 'GastoDesdeGastos',
    route: EXPENSES,
    steps: [{ activate: 'Cargar gasto' }],
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
    visible: 'Guardar',
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
    steps: [{ click: 'Cambiar contraseña' }],
    visible: 'Contraseña actual',
  },
]
