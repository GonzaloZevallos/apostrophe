/**
 * The fixed always-visible words of the Clientes screens (no JSX): their empty states, the
 * same bindings the screens render. Registered in `LIMITED_COPY` so
 * `copy/copyLimits.test.ts` measures them against the limit of the icon and text rule
 * (docs/product/icon-and-text-rule.md).
 */

import type { LimitedCopy } from './limits'
import { EMPTY_STATES } from './emptyStates'

export const LANGUAGE: 'es' | 'en' = 'es'

/** Clientes' empty list. */
export const EMPTY_CUSTOMERS = EMPTY_STATES.customersList
/** Heads everyone A–Z, under "Te deben" (`Clientes.dc.html`). */
export const EVERYONE = 'Todos · A–Z'
/** "Te deben" with nobody owing. */
export const NOBODY_OWES = EMPTY_STATES.homeNobodyOwes

export const LIMITED_COPY: readonly LimitedCopy[] = [
  { kind: 'emptyTitle', text: EMPTY_CUSTOMERS },
  { kind: 'emptyTitle', text: NOBODY_OWES },
]
export const LONG_REFUSALS: readonly string[] = []

/** Every text a person reads in this area that is not a named message above, by key. */
export const CUSTOMERS_TEXT = {
  cobroEliminado: 'Cobro eliminado',
  teDebe: 'Te debe ',
  desdeEl: 'desde el ',
  aFavor: 'A favor ',
  aFavorLabel: 'A favor',
  telefono: 'Teléfono',
  si: 'Sí',
  no: 'No',
  borrarCobro: 'Borrar cobro',
  nuevaVentaA: 'Nueva venta a ',
  teDebeDesde: 'te debe desde ',
  guardaYUsa: 'Guardá y usá',
  descartasElCliente: '¿Descartás el cliente?',
  n0Clientes: (arg1: string | number) => `${arg1} clientes`,
  pagadaPorEfectivo: 'Pagada por efectivo',
  pagadaPorTransferencia: 'Pagada por transferencia',
  quedoDebiendo: 'Quedó debiendo',
  borrasElCobroDe: (amount: string | number, arg2: string | number, paid_on: string | number) => `¿Borrás el cobro de ${amount} (${arg2}) del ${paid_on}?`,
  cobro0ACuenta: (arg1: string | number, sale_date: string | number) => `Cobro · ${arg1} · A cuenta de la venta del ${sale_date}`,
  aFavor0: (running_balance: string | number) => `A favor ${running_balance}`,
  poneleUnNombre: 'Ponele un nombre',
  esoNoPareceUn: 'Eso no parece un teléfono con su código de área',
  eseTelefonoYaEs: 'Ese teléfono ya es de otro cliente',
  buscarCliente: 'Buscar cliente',
  buscando: 'Buscando…',
} as const
