/**
 * The fixed words the business, users, account and catalog-message groups share with their tests (no JSX).
 * Toasts are typed on `SuccessToast`, so an invented message fails `tsc`. The generic retry
 * is not here: its one home is `ERROR_GENERICO_MENSAJE` in `components/ErrorGenerico`.
 */

import { SAMPLES, type LimitedCopy } from './limits'
import { REFUSAL_TEXT } from './refusals'
import type { SuccessToast } from '../components/AvisoExito'

export const LANGUAGE: 'es' | 'en' = 'es'


export const RENAME_SUCCESS: SuccessToast = 'Negocio renombrado'
export const PASSWORD_CHANGED_SUCCESS: SuccessToast = 'Contraseña cambiada · cerramos tus otras sesiones'
export const BUSINESS_NAME_INVALID_MESSAGE = 'Ponele un nombre al negocio, sin espacios de más'
export const GENERIC_REFUSAL_MESSAGE = REFUSAL_TEXT.pinnedGeneric
export const CATALOG_SAVED: SuccessToast = 'Catálogo guardado'
export const PRICES_SAVED: SuccessToast = 'Precios guardados'
export const HEADER_TOO_LONG_MESSAGE = 'El encabezado es demasiado largo'
export const FOOTER_TOO_LONG_MESSAGE = 'El pie es demasiado largo'

/** The line under a fresh invitation link: one sentence, a help line (<= 80). `date` is `dd/mm`. */
export const inviteExpiry = (date: string): string => `Un link de un solo uso, vence el ${date}`

/** The line under the Onboarding's collapsed "Categoría" action (a help line, <= 80): true because
 * adding, renaming and removing each save at once, through the owner's own routes. */
export const CATEGORIES_SAVE_AT_ONCE = 'Agregar, renombrar o sacar una categoría se guarda al toque.'

/** Every always-visible help line of these groups, measured with `SAMPLES`; the screens
 * render `inviteExpiry` itself. Checked by `copy/copyLimits.test.ts`. */
const LIMITED_COPY_0: readonly LimitedCopy[] = [
  { kind: 'help', text: inviteExpiry(SAMPLES.date) },
  { kind: 'help', text: CATEGORIES_SAVE_AT_ONCE },
]
/**
 * The fixed words of Configuración → Integraciones, shared with its test (no JSX). The
 * always-visible lines are listed in `LIMITED_COPY`, the same bindings the screen
 * renders, so `copy/copyLimits.test.ts` measures what the seller reads. The longer "how" for
 * the own chat is `OWN_CHAT_INFO.more`, behind `MasInfo`: only the how, never a consequence or a
 * fix. It is an object, not a string export, so the registry check does not read it as a line.
 */


export const CHANNEL_CHAT_HELP = 'Es el @usuario o el enlace del canal donde se publica el catálogo.'
export const OWN_CHAT_HELP = 'Tocá Iniciar en tu bot; tu número lo ves con @userinfobot.'
/** Behind More info: the longer how, which the always-visible line above says in short. */
export const OWN_CHAT_INFO = {
  line: OWN_CHAT_HELP,
  more: 'Abrí tu bot en Telegram y tocá Iniciar. Después tocá Buscar mi chat y tu número aparece solo; o buscalo vos con @userinfobot y escribilo acá.',
} as const
export const LOAD_THE_TOKEN_FIRST = 'Cargá el token primero'
export const PREVIOUS_PIN_NOTICE =
  'El mensaje fijado anterior queda como está; desfijalo vos en Telegram.'

const LIMITED_COPY_1: readonly LimitedCopy[] = [
  { kind: 'help', text: CHANNEL_CHAT_HELP },
  { kind: 'help', text: OWN_CHAT_HELP },
  { kind: 'help', text: LOAD_THE_TOKEN_FIRST },
  { kind: 'notice', text: PREVIOUS_PIN_NOTICE },
]

export const LIMITED_COPY: readonly LimitedCopy[] = [...LIMITED_COPY_0, ...LIMITED_COPY_1]
export const LONG_REFUSALS: readonly string[] = []

/** Every text a person reads in this area that is not a named message above, by key. */
export const SETTINGS_TEXT = {
  cerrarSesion: 'Cerrar sesión',
  tema: 'Tema',
  encabezado: 'Encabezado',
  pie: 'Pie',
  nuevaCategoria: 'Nueva categoría',
  categoria: '+ Categoría',
  nombreDe0: (name: string | number) => `Nombre de ${name}`,
  renombrar: 'Renombrar',
  eliminar: 'Eliminar',
  borrasLaCategoria: '¿Borrás la categoría?',
  seBorra: 'Se borra “',
  estoNoSePuede: '”. Esto no se puede deshacer.',
  tokenDelBot: 'Token del bot',
  guardadoEl: 'Guardado el ',
  noSeMuestraMas: ' · no se muestra más',
  chatDelCanal: 'Chat del canal',
  tuChat: 'Tu chat',
  buscarMiChat: 'Buscar mi chat',
  probarlo: 'Probarlo',
  irAlCatalogo: 'Ir al catálogo',
  clientesVip: 'Clientes VIP',
  guardaLosPrecios: 'Guardá los precios',
  vos: 'vos',
  categoriaMontoYDetalle: 'Categoría, monto y detalle',
  promocionOConsumoPropio: 'Promoción o consumo propio',
  porMesYPor: 'Por mes y por categoría',
  variedadesSemanasMesesY: 'Variedades, semanas, meses y días',
  negocioUsuariosBotCatalogo: 'Negocio, usuarios, bot, catálogo, categorías, apariencia y tu cuenta',
  descartasLaContrasenaNueva: '¿Descartás la contraseña nueva?',
  claro: 'Claro',
  oscuro: 'Oscuro',
  descartasElTema: '¿Descartás el tema?',
  descartasElNombre: '¿Descartás el nombre?',
  guardaElMensaje: 'Guardá el mensaje',
  descartasElMensaje: '¿Descartás el mensaje?',
  noSePuedeBorrar: 'No se puede borrar: todavía tiene gastos. Podés renombrarla.',
  categoriaGuardada: 'Categoría guardada',
  categoriaEliminada: 'Categoría eliminada',
  descartasLaCategoria: '¿Descartás la categoría?',
  pruebaEnviada: 'Prueba enviada',
  lasVentasYaHechas: 'Las ventas ya hechas conservan el precio con el que se registraron. Apagar una opción no borra nada.',
  cadaVariedadNecesitaSu: 'Cada variedad necesita su precio VIP: sin él, un cliente VIP paga como cualquiera.',
  descartasLosPrecios: '¿Descartás los precios?',
  descartasLaInvitacion: '¿Descartás la invitación?',
} as const
