/** The payments words that are not a named message. */

import type { LimitedCopy } from './limits'

export const LANGUAGE: 'es' | 'en' = 'es'

export const LIMITED_COPY: readonly LimitedCopy[] = []
export const LONG_REFUSALS: readonly string[] = []

/** Every text a person reads in this area that is not a named message above, by key. */
export const PAYMENTS_TEXT = {
  teDebe0Desde: (balance: string | number, owing_since: string | number) => ` · te debe ${balance} desde el ${owing_since}`,
  todo: 'Todo: ',
  metodo: 'Método',
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  seDescuentaDeLa: 'Se descuenta de la deuda más vieja',
  aLaVentaDel: ' a la venta del ',
  leQuedaDebiendo: 'Le queda debiendo ',
  descartasElCobro: '¿Descartás el cobro?',
  elMontoSuperaLo: 'El monto supera lo que te debe.',
  laFechaNoPuede: 'La fecha no puede ser futura.',
  ingresaUnMontoValido: 'Ingresá un monto válido.',
  elegiEfectivoOTransferencia: 'Elegí efectivo o transferencia.',
  cobroGuardadoQuedaDebiendo: (balance: string): `Cobro guardado · queda debiendo ${string}` => `Cobro guardado · queda debiendo ${balance}`,
  cobroGuardado: 'Cobro guardado',
} as const
