/** The fixed English of the stock entry form and the entries list that is always on
 * screen: help lines, the preview line and the empty state. The screens render these
 * same bindings, and `LIMITED_COPY` lists them for `copy/copyLimits.test.ts`, which
 * measures each with `SAMPLES` (never fixture or API data). */

import { SAMPLES, type LimitedCopy } from './limits.ts'
import { COMMON_TEXT } from './common.ts'

export const LANGUAGE: 'es' | 'en' = 'en'

export const EMPTY_STATE_TITLE = 'No stock entries'
export const EMPTY_STATE_DETAIL = 'Enter your initial stock or a purchase'

export const COST_REQUIRED_HELP = 'Required for a purchase'

/** The locked (Onboarding) form's line under the cost: the cost is optional and, left out,
 * the lot costs $ 0 (the entry is posted without `total_cost`). */
export const OPENING_COST_HINT = 'Optional · if you leave it out, the lot costs $ 0'

/** The refusal of a bad grams amount, shared by the price, stock entry and withdrawal forms. */
export const GRAMS_INVALID = 'Check the grams entered'

/** The grams on hand under the variety picker; `grams` is already formatted from what
 * the API answered (`formatGrams`), so the registry can measure it with `SAMPLES.grams`. */
export function onHandHelp(grams: string): string {
  return `It has ${grams} today`
}

/** The per-gram cost previewed while typing; `perGram` is the front's preview, already
 * formatted (`formatMoney`), so the registry can measure it with `SAMPLES.amount`. */
export function perGramPreview(perGram: string): string {
  return `It comes to ${perGram} per gram`
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
  statusNoEntries: 'no entries',
  statusSoldOut: 'sold out',
  statusSoldOutMany: 'sold out',
  statusLow: 'low',
  statusLowMany: 'low',
  statusOk: 'ok',
  varietyOne: 'variety',
  varietyMany: 'varieties',
  allOkSuffix: ' · all ok',
  firstEntry: 'Add its first entry',
  noGrams: 'No grams',
  noGramsSince: (date: string) => `No grams since ${date}`,
  warnBelowThreshold: 'You are warned below the threshold',
  warnBelow: (grams: string) => `You are warned below ${grams}`,
  atPace: 'At the pace of the last 30 days',
  daysLeft: (days: number) => `${days} days`,
  warningLow: (grams: string) => `Warning: ${grams} left`,
  warnMeBelow: (grams: string) => `Warn me below ${grams}`,
  nuevaEntrada: 'New entry',
  editarEntrada: 'Edit entry',
  descartasLaEntrada: 'Discard the entry?',
  sinCosto: 'No cost',
  borrar: 'Delete',
  antesDeBorrar: 'Before deleting',
  borrasLaEntradaDel: (today: string | number, variety_id: string | number, grams: string | number) => `Delete the ${today} entry of ${variety_id}, ${grams}? ${COMMON_TEXT.cannotUndo}`,
  guardasLosCambios: 'Save the changes?',
  estoActualizaLaEntrada: 'This updates the entry.',
  siGuardar: 'Yes, save',
  noSeguirEditando: COMMON_TEXT.noKeepEditing,
  costoTotal: 'Total cost',
  origen: 'Origin',
  guardaLaEntrada: 'Save the entry',
  borrarEntrada: 'Delete entry',
  motivo: 'Reason',
  variedadYGramos: 'Variety and grams',
  variedadYGramos0: (arg1: string | number) => `Variety and grams ${arg1}`,
  variedad0: (arg1: string | number) => `Variety ${arg1}`,
  gramos0: (arg1: string | number) => `Grams ${arg1}`,
  quitarVariedad0: (arg1: string | number) => `Remove variety ${arg1}`,
  guardaElRetiro: 'Save the withdrawal',
  estoActualizaElRetiro: 'This updates the withdrawal and the lots after it.',
  descartasElRetiro: 'Discard the withdrawal?',
  sePierdeLoQue: 'What you changed is lost: the withdrawal stays as it was.',
  unaCompraNecesitaUn: 'A purchase needs a total cost',
  unAjusteNegativoNo: 'A negative adjustment carries no cost',
  retiroEliminado: 'Withdrawal deleted',
  borrasLaPromocionDel: (date: string | number, total_grams: string | number) => `Delete the promotion from ${date}? ${total_grams} go back to stock.`,
  borrasElConsumoPropio: (date: string | number, total_grams: string | number) => `Delete the own use from ${date}? ${total_grams} go back to stock.`,
  retiroGuardado: 'Withdrawal saved',
} as const
