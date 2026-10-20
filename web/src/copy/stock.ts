/** The fixed Spanish of the stock entry form and the entries list that is always on
 * screen: help lines, the preview line and the empty state. The screens render these
 * same bindings, and `LIMITED_COPY` lists them for `copy/copyLimits.test.ts`, which
 * measures each with `SAMPLES` (never fixture or API data). */

import { SAMPLES, type LimitedCopy } from './limits'
import { EMPTY_STATES } from './emptyStates'

export const EMPTY_STATE_TITLE = EMPTY_STATES.stockTitle
export const EMPTY_STATE_DETAIL = EMPTY_STATES.stockDetail

export const COST_REQUIRED_HELP = 'Obligatorio cuando es una compra'

/** The locked (Onboarding) form's line under the cost: the cost is optional and, left out,
 * the lot costs $ 0 (the entry is posted without `total_cost`). */
export const OPENING_COST_HINT = 'Opcional · si no lo cargás, el lote cuesta $ 0'

/** The refusal of a bad grams amount, shared by the price, stock entry and withdrawal forms. */
export const GRAMS_INVALID = 'Revisá los gramos cargados'

/** The grams on hand under the variety picker; `grams` is already formatted from what
 * the API answered (`formatGrams`), so the registry can measure it with `SAMPLES.grams`. */
export function onHandHelp(grams: string): string {
  return `Hoy tiene ${grams}`
}

/** The per-gram cost previewed while typing; `perGram` is the front's preview, already
 * formatted (`formatMoney`), so the registry can measure it with `SAMPLES.amount`. */
export function perGramPreview(perGram: string): string {
  return `Te queda en ${perGram} el gramo`
}

/** Checked by `copy/copyLimits.test.ts`: placeholders filled from `SAMPLES`. */
export const LIMITED_COPY: readonly LimitedCopy[] = [
  { kind: 'emptyTitle', text: EMPTY_STATE_TITLE },
  { kind: 'emptyLine', text: EMPTY_STATE_DETAIL },
  { kind: 'help', text: COST_REQUIRED_HELP },
  { kind: 'help', text: OPENING_COST_HINT },
  { kind: 'help', text: GRAMS_INVALID },
  { kind: 'help', text: onHandHelp(SAMPLES.grams) },
  { kind: 'help', text: perGramPreview(SAMPLES.amount) },
]
export const LONG_REFUSALS: readonly string[] = []

/** Every text a person reads in this area that is not a named message above, by key. */
export const STOCK_TEXT = {
  nuevaEntrada: 'Nueva entrada',
  editarEntrada: 'Editar entrada',
  descartasLaEntrada: '¿Descartás la entrada?',
  entradas: 'Entradas',
  sinCosto: 'Sin costo',
  borrar: 'Borrar',
  antesDeBorrar: 'Antes de borrar',
  borrasLaEntradaDel: (today: string | number, variety_id: string | number, grams: string | number) => `¿Borrás la entrada del ${today} de ${variety_id}, ${grams}? Esto no se puede deshacer.`,
  guardasLosCambios: '¿Guardás los cambios?',
  estoActualizaLaEntrada: 'Esto actualiza la entrada.',
  siGuardar: 'Sí, guardar',
  noSeguirEditando: 'No, seguir editando',
  stockInicial: 'Stock inicial',
  costoTotal: 'Costo total',
  origen: 'Origen',
  guardaLaEntrada: 'Guardá la entrada',
  borrarEntrada: 'Borrar entrada',
  retiro: 'Retiro',
  motivo: 'Motivo',
  variedadYGramos: 'Variedad y gramos',
  variedadYGramos0: (arg1: string | number) => `Variedad y gramos ${arg1}`,
  variedad0: (arg1: string | number) => `Variedad ${arg1}`,
  gramos0: (arg1: string | number) => `Gramos ${arg1}`,
  quitarVariedad0: (arg1: string | number) => `Quitar variedad ${arg1}`,
  guardaElRetiro: 'Guardá el retiro',
  estoActualizaElRetiro: 'Esto actualiza el retiro y los lotes que vienen después.',
  descartasElRetiro: '¿Descartás el retiro?',
  sePierdeLoQue: 'Se pierde lo que cambiaste: el retiro sigue como estaba.',
} as const
