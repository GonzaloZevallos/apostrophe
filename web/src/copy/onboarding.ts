/**
 * The step frame's two leave details, shared with its tests and registered in
 * `LIMITED_COPY` so `copy/copyLimits.test.ts` measures the very bindings the dialogs show.
 */

import type { LimitedCopy } from './limits'

export const LANGUAGE: 'es' | 'en' = 'es'

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
  cuandoQuierasPublicaloDesde: 'Cuando quieras, publicalo desde Variedades → Mandar catálogo',
  paraDespuesEn0: (later: string | number) => `Para después — en ${later}`,
  hecho0: (arg1: string | number) => `Hecho · ${arg1}`,
  seguiConLaConfiguracion: 'Seguí con la configuración',
  descartasLoQueEscribiste: '¿Descartás lo que escribiste?',
  noSeguiEscribiendo: 'No, seguí escribiendo',
  crearElLink: 'Crear el link',
  cargaTuPrimeraVariedad: 'Cargá tu primera variedad',
  paraVenderCadaVariedad: 'Para vender, cada variedad necesita un nombre y su precio de hoy.',
  sinStockNoSe: 'Sin stock no se puede vender: contanos cuántos gramos tenés de esta variedad.',
  comoSaleTuCatalogo: 'Cómo sale tu catálogo',
  elEncabezadoYEl: 'El encabezado y el pie van en cada catálogo que mandás. Ya tienen un texto: dejalo así o cambialo.',
  mensajeDelCatalogo: 'mensaje del catálogo',
  configuracionMensajeDelCatalogo: 'Configuración → Mensaje del catálogo',
  conectaTuBotDe: 'Conectá tu bot de Telegram',
  conElBotTu: 'Con el bot, tu catálogo se publica y se actualiza solo en tu canal.',
  botDeTelegram: 'bot de Telegram',
  configuracionIntegraciones: 'Configuración → Integraciones',
  envialeElLinkA: 'Enviale el link a tu socio',
  conElLinkTu: 'Con el link tu socio entra a este negocio y ve lo mismo que vos. No hace falta que se sume ahora.',
  configuracionUsuarios: 'Configuración → Usuarios',
  ordenanLoQueGastas: 'Ordenan lo que gastás. Ya tenés las más comunes: sumá, renombrá o sacá las que quieras.',
  categoriasDeGastos: 'categorías de gastos',
  configuracionCategoriasDeGastos: 'Configuración → Categorías de gastos',
  siLoSalteasLo: (later: string | number) => `Si lo salteás, lo hacés después en ${later}.`,
} as const
