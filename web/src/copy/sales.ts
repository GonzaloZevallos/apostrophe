/** The fixed Spanish of the sale screens that is always on screen: the empty list of
 * Ventas, the hint under the disabled Debiendo and the line that has no price for its
 * date. Each binding is the one its screen renders (`pricing.ts` builds the message
 * from `noPriceMessage`), registered here and measured with `SAMPLES` by
 * `copy/copyLimits.test.ts`, never with fixture or API data. */

import { SAMPLES, type LimitedCopy } from './limits'
import { EMPTY_STATES } from './emptyStates'

export const LANGUAGE: 'es' | 'en' = 'es'

export const EMPTY_LIST = EMPTY_STATES.salesList
export const GRAMS_HELP = 'Coma, hasta dos decimales'
export const OWING_HINT = 'Para dejar debiendo elegí un cliente'

/** The line of a variety with no price on the sale's date. */
export function noPriceMessage(varietyName: string): string {
  return `${varietyName} no tiene precio para esa fecha`
}

export const LIMITED_COPY: readonly LimitedCopy[] = [
  { kind: 'emptyLine', text: EMPTY_LIST },
  { kind: 'help', text: OWING_HINT },
  { kind: 'help', text: GRAMS_HELP },
  { kind: 'help', text: noPriceMessage(SAMPLES.name) },
]

/** Nothing here is over 80 characters. */
export const LONG_REFUSALS: readonly string[] = []

/** Every text a person reads in this area that is not a named message above, by key. */
export const SALES_TEXT = {
  hoy0: (date: string | number) => `Hoy ${date}`,
  elegirCliente: 'Elegir cliente',
  envioCobrado: 'Envío cobrado',
  envio: 'Envío',
  total: 'Total',
  n0DeRegalo: (arg1: string | number) => ` · ${arg1} de regalo`,
  guardaLaVenta: 'Guardá la venta',
  descartasLaVenta: '¿Descartás la venta?',
  noVasAPoder: 'No vas a poder recuperar lo que cargaste.',
  siDescartala: 'Sí, descartala',
  buscar: 'Buscar',
  telefonoONombre: 'Teléfono o nombre',
  sinCliente: 'Sin cliente',
  crearCliente: 'Crear cliente',
  linea01: (n: string | number, displayName: string | number) => `Línea ${n}: ${displayName}`,
  g: ' g',
  variedadLinea0: (n: string | number) => `Variedad línea ${n}`,
  gramosLinea0: (n: string | number) => `Gramos línea ${n}`,
  regaloLinea0: (n: string | number) => `Regalo línea ${n}`,
  regalo: 'Regalo',
  precioEspecialLinea0: (n: string | number) => `Precio especial línea ${n}`,
  precioEspecial: 'Precio especial',
  quitarLinea0: (n: string | number) => `Quitar línea ${n}`,
  ventaDel0: (date: string | number) => `Venta del ${date}`,
  deshacer: 'Deshacer',
  lineas: 'Líneas',
  porGramo: ' por gramo',
  clienteAsignado: 'Cliente asignado',
  asignarCliente: 'Asignar cliente',
  borrarVenta: 'Borrar venta',
  desde: 'Desde',
  hasta: 'Hasta',
  teDebe: 'te debe',
  cargaAlMenosUna: 'Cargá al menos una variedad.',
  elegiComoSePago: 'Elegí cómo se pagó, o dejá la venta debiendo',
  elPrecioEspecialTiene: 'El precio especial tiene que ser mayor a $0',
  cargaLosGramosComa: 'Cargá los gramos: coma, hasta dos decimales',
  elegiUnaVariedad: 'Elegí una variedad',
  elEnvioNoPuede: 'El envío no puede ser negativo',
  laNotaEsDemasiado: 'La nota es demasiado larga',
  sinVariedad: 'Sin variedad',
  estaVentaYaTiene: 'Esta venta ya tiene cliente.',
  quedoDebiendo: 'quedó debiendo',
  borrasLaVentaDe: (money: string | number, day: string | number, grams: string | number) => `¿Borrás la venta de ${money} del ${day}? Vuelven ${grams} al stock.`,
  fechas: 'Fechas',
} as const
