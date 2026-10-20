/**
 * The step frame's two leave details, shared with its tests and registered in
 * `LIMITED_COPY` so `copy/copyLimits.test.ts` measures the very bindings the dialogs show.
 */

import type { LimitedCopy } from './limits'

export const DISCARD_DETAIL = 'Se pierde lo que escribiste: todavía no se guardó nada.'
/** For a step that has already saved part of its work: the variety is kept, the price typed is not. */
export const PARTLY_SAVED_DETAIL = 'La variedad ya quedó guardada; se pierde el precio que escribiste.'

export const LIMITED_COPY: readonly LimitedCopy[] = [
  { kind: 'help', text: DISCARD_DETAIL },
  { kind: 'help', text: PARTLY_SAVED_DETAIL },
]

export const LONG_REFUSALS: readonly string[] = []

/** Every text a person reads in this area that is not a named message above, by key. */
export const ONBOARDING_TEXT = {
  seguir: 'Seguir',
  dejarAsi: 'Dejar así',
  n0De1Pasos: (STEP_COUNT: string | number, STEP_COUNT_: string | number) => `${STEP_COUNT} de ${STEP_COUNT_} pasos`,
  listo: 'Listo',
  estoQuedoArmadoEn: 'Esto quedó armado en tu negocio.',
  cargarMiPrimeraVenta: 'Cargar mi primera venta',
  irAInicio: 'Ir a Inicio',
  falta0: (shortName: string | number) => `Falta: ${shortName}`,
  atras: 'Atrás',
  paso0De1: (slug: string | number, STEP_COUNT: string | number) => `Paso ${slug} de ${STEP_COUNT}`,
  saltar: 'Saltar',
  saltarElResto: 'Saltar el resto',
  tenesOtraParaCargar: '¿Tenés otra para cargar ahora? Cada una lleva su nombre, su precio y su stock inicial.',
  conPrecioDeHoy: 'Con precio de hoy y con su stock inicial',
  primeroCargaUnaVariedad: 'Primero cargá una variedad con su precio de hoy.',
  cargarUnaVariedad: 'Cargar una variedad',
  variedad0: (name: string | number) => `Variedad: ${name}`,
  guardaLaVariedad: 'Guardá la variedad',
} as const
