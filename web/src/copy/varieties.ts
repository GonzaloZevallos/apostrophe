/** The fixed English of the varieties list, Archivadas and the whole price history that is
 * always on screen: the empty states and the one help line. Each is a binding the screen
 * renders, listed in `LIMITED_COPY` with its kind (`copy/copyLimits.test.ts` measures it). */

import { baselineArgs, FIXTURE } from './baselineArgs.ts'
import type * as Self from './varieties.ts'
import { type LimitedCopy } from './limits.ts'
import type { RefusalCode } from '../api/refusals.ts'
import { COMMON_TEXT } from './common.ts'

export const LANGUAGE: 'es' | 'en' = 'en'


export const EMPTY_TITLE = 'No varieties yet'
export const EMPTY_DETAIL = 'Add the first one with its price so you can sell and send your catalog.'
export const NO_ARCHIVED_MESSAGE = 'You have no archived varieties'
export const PRICE_HISTORY_HELP = 'Each sale uses the price in force that day, even if you change it later.'
/** Why "Mandar catálogo" is disabled, only while the first-run checklist shows and nothing qualifies. */
export const CATALOG_DISABLED_REASON = 'Add a variety with a price and its stock'

const LIMITED_COPY_0: readonly LimitedCopy[] = [
  { kind: 'emptyTitle', text: EMPTY_TITLE },
  { kind: 'emptyLine', text: EMPTY_DETAIL },
  { kind: 'emptyTitle', text: NO_ARCHIVED_MESSAGE },
  { kind: 'help', text: PRICE_HISTORY_HELP },
  { kind: 'help', text: CATALOG_DISABLED_REASON },
]
/** The fixed help lines under the price form's fields and the new-variety form's name,
 * always on screen, and the toast after a price is saved (`PRICE_SAVED`, which `AvisoExito`
 * types on). The screens render these same bindings; `LIMITED_COPY` lists them
 * for `copy/copyLimits.test.ts`. */


export const PRICE_PER_GRAM_HELP = 'Per gram, in whole pesos'
export const PRICE_DISCOUNT_HELP = 'Optional · below the list price'
export const PRICE_FROM_GRAMS_HELP = 'From how many grams it applies'
export const VARIETY_NAME_HELP = 'Up to 60 characters · cannot repeat another variety\'s name'

/** A toast, not always-visible copy, so it is not in `LIMITED_COPY`. */
export const PRICE_SAVED = 'Price saved'

const LIMITED_COPY_1: readonly LimitedCopy[] = [
  { kind: 'help', text: PRICE_PER_GRAM_HELP },
  { kind: 'help', text: PRICE_DISCOUNT_HELP },
  { kind: 'help', text: PRICE_FROM_GRAMS_HELP },
  { kind: 'help', text: VARIETY_NAME_HELP },
]
/** The fixed English of the low-stock warning's form and switch, and the one table from a
 * refusal of `PUT /stock/products/{id}/threshold` to its message. */


export const THRESHOLD_INVALID_MESSAGE = 'Check the threshold entered'
export const THRESHOLD_SAVED = 'Warning saved'

export const THRESHOLD_OVERRIDES: Partial<Record<RefusalCode, string>> = {
  'stock.threshold_invalid': THRESHOLD_INVALID_MESSAGE,
}

/** No always-visible help line or notice lives here yet. Checked by `copy/copyLimits.test.ts`. */
const LIMITED_COPY_2: readonly LimitedCopy[] = []

export const LIMITED_COPY: readonly LimitedCopy[] = [...LIMITED_COPY_0, ...LIMITED_COPY_1, ...LIMITED_COPY_2]
export const LONG_REFUSALS: readonly string[] = []


const { date: D, grams: G } = FIXTURE

/** The fixture arguments of this file's functions, for `en.baseline.json` (`./baselineArgs.ts`). */
export const BASELINE_ARGS = baselineArgs<typeof Self>()({
  'VARIETIES_TEXT.borrasElPrecioDesde': [[D]],
  'VARIETIES_TEXT.n01Dias': [[G, '12']],
  'VARIETIES_TEXT.siLaArchivas0': [['the rest goes to Archived.']],
  'VARIETIES_TEXT.tieneUnFaltanteDe': [[G, 'the rest goes to Archived.']],
  'VARIETIES_TEXT.teQuedan0Si': [[G, 'the rest goes to Archived.']],
})

/** Every text a person reads in this area that is not a named message above, by key. */
export const VARIETIES_TEXT = {
  mandarCatalogo: 'Send catalog',
  entradaDeStock: '+ Stock entry',
  oculta: 'Hidden',
  archivadas: 'Archived (',
  archivada: COMMON_TEXT.archived,
  restaurar: 'Restore',
  enElCatalogo: 'In the catalog',
  mostrarEnElCatalogo: 'Show in the catalog',
  emoji: 'Emoji',
  indica: '% indica',
  aromaSabor: 'Aroma/flavor',
  guardaElCatalogo: 'Save the catalog',
  precioDeLista: 'List price',
  minimoEnGramos: 'Minimum in grams',
  precioVip: 'VIP price',
  rigeDesde: 'Effective from',
  guardaElPrecio: 'Save the price',
  descartasElPrecio: 'Discard the price?',
  rigeDesde2: 'Effective from ',
  vigenteHoy: 'In force today',
  desde: 'From ',
  precioVip2: 'VIP price · ',
  borrarEstePrecio: 'Delete this price',
  borrasElPrecioDesde: (effective_from: string | number) => `Delete the price from ${effective_from}?`,
  renombrarVariedad: 'Rename variety',
  avisoDeStockBajo: 'Low stock warning',
  avisarConMenosDe: 'Warn when below',
  guardaElAviso: 'Save the warning',
  seMuestra: 'Shown',
  noSeMuestra: 'Not shown',
  editarCatalogo: 'Edit catalog',
  nombreDeLaVariedad: 'Variety name',
  agregaLaVariedad: 'Add the variety',
  descartasLaVariedad: 'Discard the variety?',
  editarNombre: 'Edit name',
  dias: ' days',
  entrada: '+ Entry',
  entrada2: 'Entry',
  verTodas: 'See all',
  eliminarVariedad: 'Delete variety',
  archivarVariedad: 'Archive variety',
  eliminasEstaVariedad: 'Delete this variety?',
  archivasEstaVariedad: 'Archive this variety?',
  noTieneVentasNi: `It has no sales or entries. It is deleted for good, with its prices. ${COMMON_TEXT.cannotUndo}`,
  siEliminala: COMMON_TEXT.yesDelete,
  siArchivala: 'Yes, archive it',
  stockYEntradas: 'Stock and entries',
  elGramo: ' per gram',
  editarAviso: 'Edit warning',
  avisarCuandoQuedePoco: 'Warn when running low',
  pantallaVariedades: 'Varieties screen',
  paginaDeLaVariedad: 'Variety page',
  verTodosLosPrecios: 'See all prices',
  pantallaArchivadas: 'Archived screen',
  variedadGuardada: 'Variety saved',
  sinPrecioNoSe: 'No price: cannot be sold',
  yaExisteUnaVariedad: 'A variety with that name already exists',
  poneleUnNombreA: 'Give the variety a name, without extra spaces',
  n01Dias: (grams: string | number, days_left: string | number) => `${grams} · ${days_left} days`,
  precioEliminado: 'Price deleted',
  dejanDeVerseEn: `they stop showing on ${COMMON_TEXT.home} and in the lists, but the stock is kept.`,
  siLaArchivas0: (tail: string | number) => `If you archive it, ${tail}`,
  tieneUnFaltanteDe: (grams: string | number, tail: string | number) => `It has a shortfall of ${grams}. If you archive it, ${tail}`,
  teQuedan0Si: (grams: string | number, tail: string | number) => `You have ${grams} left. If you archive it, ${tail}`,
  variedadEliminada: 'Variety deleted',
  variedadArchivada: 'Variety archived',
  poneExactamenteUnEmoji: 'Enter exactly one emoji',
  elPorcentajeDeIndica: 'The indica percentage goes from 0 to 100',
  elAromaEsDemasiado: 'The aroma is too long',
  yaCargasteUnPrecio: 'You already entered a price with that date',
  revisaLosPreciosCargados: 'Check the prices entered',
  variedadRestaurada: 'Variety restored',
} as const
