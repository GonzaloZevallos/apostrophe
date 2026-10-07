/**
 * The fixed lines of Análisis (empty states and help lines), registered for
 * `copy/copyLimits.test.ts`. `Analisis.tsx` renders these same bindings.
 */

import type { LimitedCopy } from '../copy/limits'

export const NO_HISTORY_LINE = 'Todavía no hay nada para analizar.'
export const EMPTY_MONTH_LINE = 'No vendiste ni regalaste nada este mes.'
export const VARIETY_TOTAL_NOTE = 'La tabla de variedades suma las ventas del mes sin el envío.'
export const SINCE_FIRST_RECORD_LABEL =
  'Movido desde tu primer registro, no es la plata que tenés en caja'
export const PURCHASES_NOTE = 'Van aparte, se cargan en Stock'

export const LIMITED_COPY: readonly LimitedCopy[] = [
  { kind: 'emptyLine', text: NO_HISTORY_LINE },
  { kind: 'emptyLine', text: EMPTY_MONTH_LINE },
  { kind: 'help', text: VARIETY_TOTAL_NOTE },
  { kind: 'help', text: SINCE_FIRST_RECORD_LABEL },
  { kind: 'help', text: PURCHASES_NOTE },
]
export const LONG_REFUSALS: readonly string[] = []
