/**
 * The forms, sheets and confirmations of the records areas (customers, stock, prices,
 * varieties, the catalogue, expenses and Configuración) the phone walk visits beside the
 * registry's routes. A state is a unique name, a starting route, the steps that reach it
 * and one element that must be visible once there. No step saves: every write the app
 * could send is aborted by the walk, and these states stop before one.
 */

import type { WalkState } from './states.js'

/**
 * The first stock entry the sample app seeds (24K Gold, 120 g): entries are numbered in the
 * order `sample_app.seed` makes them, and a list row cannot be tapped on the phone today
 * (its neighbour's row overlaps it), so the walk opens the entry by its route.
 */
const ENTRY_ROUTE = '/mi-stock/entradas/1'

export const RECORDS_STATES: readonly WalkState[] = [
  {
    screen: 'ClientesBusqueda',
    route: '/clientes',
    steps: [{ fill: { label: 'Buscar cliente', value: 'Nico' } }],
    visible: 'Nico Parra',
  },
  { screen: 'ClienteNuevo', route: '/clientes/nuevo', steps: [], visible: 'Guardá y usá' },
  { screen: 'ClienteEditar', route: '/clientes/{debtor}/editar', steps: [], visible: 'Guardá y usá' },

  {
    screen: 'EntradaStockDesdeStock',
    route: '/mi-stock',
    steps: [{ activate: 'Nueva entrada' }],
    visible: 'Guardá la entrada',
  },
  {
    screen: 'EntradaStockEditar',
    route: ENTRY_ROUTE,
    steps: [],
    visible: 'Borrar entrada',
  },
  {
    screen: 'EntradaStockConfirmarCambios',
    route: ENTRY_ROUTE,
    steps: [{ wait: 'Borrar entrada' }, { click: 'Guardar' }],
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
    route: '/variedades/{low}',
    steps: [{ click: 'Nuevo precio' }],
    visible: 'Guardar precio',
  },
  {
    screen: 'PrecioConfirmarBorrado',
    route: '/variedades/{low}',
    steps: [{ click: 'Borrar' }],
    visible: 'Sí, borrala',
  },
  { screen: 'VariedadNuevaFormulario', route: '/variedades', steps: [{ click: '+' }], visible: 'Guardar' },
  {
    screen: 'VariedadRenombrar',
    route: '/variedades/{low}',
    steps: [{ click: 'Editar' }],
    visible: 'Guardar',
  },
  { screen: 'VariedadUmbral', route: '/variedades/{low}', steps: [], visible: 'Guardar aviso' },

  {
    screen: 'CatalogoAtributos',
    route: '/catalogo',
    steps: [{ click: 'Editar' }],
    visible: 'Se muestra en el catálogo',
  },

  {
    screen: 'GastoDesdeMas',
    route: '/more',
    steps: [{ click: '+ Cargar gasto' }],
    visible: 'Guardá el gasto',
  },
  {
    screen: 'GastoDesdeGastos',
    route: '/expenses',
    steps: [{ activate: 'Cargar gasto' }],
    visible: 'Guardá el gasto',
  },
  {
    screen: 'GastoEditar',
    route: '/expenses',
    steps: [{ activate: 'Bolsitas zip' }],
    visible: 'Borrar gasto',
  },
  {
    screen: 'GastoConfirmarBorrado',
    route: '/expenses',
    steps: [{ activate: 'Bolsitas zip' }, { activate: 'Borrar gasto' }],
    visible: '¿Borrás el gasto?',
  },

  {
    screen: 'ConfiguracionContrasena',
    route: '/settings/account',
    steps: [{ click: 'Cambiar contraseña' }],
    visible: 'Contraseña actual',
  },
]
