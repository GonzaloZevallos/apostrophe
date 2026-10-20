/**
 * The fixed help line of Gastos, registered for `copy/copyLimits.test.ts`. `Gastos.tsx`
 * renders this same binding.
 */

import type { LimitedCopy } from './limits'

export const FLOWER_NOTICE = 'Las compras de flores no van acá: se cargan en Stock.'

export const LIMITED_COPY: readonly LimitedCopy[] = [{ kind: 'help', text: FLOWER_NOTICE }]
export const LONG_REFUSALS: readonly string[] = []

/** Every text a person reads in this area that is not a named message above, by key. */
export const EXPENSES_TEXT = {
  borrasElGasto: '¿Borrás el gasto?',
  estoNoSePuede: ' Esto no se puede deshacer.',
  cargarGasto: 'Cargar gasto',
  gastasteEnElMes: 'Gastaste en el mes',
  porCategoria: 'Por categoría',
  ultimos: 'Últimos',
  categorias: 'Categorías',
  sePierdeLoQue: 'Se pierde lo que cambiaste: el gasto sigue como estaba.',
  siDescartalos: 'Sí, descartalos',
  editarGasto: 'Editar gasto',
  elegiUnaCategoria: 'Elegí una categoría',
  nombreDeLaCategoria: 'Nombre de la categoría nueva',
  crearCategoria: 'Crear categoría',
  crearUnaCategoriaNueva: 'Crear una categoría nueva',
  detalle: 'Detalle',
  guardaElGasto: 'Guardá el gasto',
  borrarGasto: 'Borrar gasto',
  descartasElGasto: '¿Descartás el gasto?',
  pantallaMas: 'Pantalla Más',
  cargarGastoDesdeMas: 'Cargar gasto desde Más',
} as const
