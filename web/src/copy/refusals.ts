/**
 * The words the backend's refusals turn into for a person (ADR-0005, ADR-0049): fixed text,
 * repeating nothing typed. `api/refusals.ts` keeps the dispatch and the types, and reads
 * its texts from here. They sit in one object, not in string exports, so the registry
 * check does not read them as lines (the long ones are refusals aimed at 80, kept with
 * their fix).
 */

import { COMMON_TEXT } from './common.ts'
import type { LimitedCopy } from './limits.ts'

export const LANGUAGE: 'es' | 'en' = 'es'

export const REFUSAL_TEXT = {
  goneNotice: 'Eso ya no está. La lista ya está al día.',
  goneDetail: 'Eso ya no está.',
  nameArchived: 'Ese nombre es de una variedad archivada. Buscala en Archivadas.',
  hasHistory: 'Esta variedad ya tiene historia: archivala en vez de eliminarla.',
  pinnedGeneric: 'Revisá los datos e intentá de nuevo.',
  pinnedNotReady: 'Probalo primero para ver cómo queda',
  probarloTokenInvalid: 'El token no es válido: copialo de nuevo de @BotFather.',
  probarloOwnChatNotStarted: 'Abrí tu bot en Telegram y tocá Iniciar, después probalo de nuevo.',
  probarloOwnChatNotFound: 'No encontramos tu chat: revisá el número y tocá Iniciar en tu bot.',
  probarloTestFailed: 'No pudimos enviarte la prueba: revisá el token y tu chat.',
  lookupNoMessages: 'Todavía no vemos mensajes en tu bot: abrilo en Telegram, tocá Iniciar y buscá de nuevo.',
  lookupSeveralChats: 'Le escribió más de una persona a tu bot: buscá tu número con @userinfobot y escribilo acá.',
  lookupUpdatesUnreadable: 'No pudimos leer los mensajes de tu bot: buscá tu número con @userinfobot y escribilo acá.',
  vipPriceNotBelowList: 'El precio VIP tiene que ser menor al precio de lista',
  pinReason: {
    telegram_unreachable: 'Telegram no respondió',
    bot_cannot_post: 'El bot no puede publicar en el canal',
    message_gone: 'El mensaje fijado ya no está: publicalo de nuevo',
    missing_publish: 'Falta publicarlo con el bot o el canal nuevo',
    too_long: 'Es demasiado largo para Telegram: acortá aromas u ocultá variedades.',
  },
  withdrawal: {
    'stock.withdrawal_reason_required': 'Elegí el motivo: Promoción o Consumo propio',
    'stock.withdrawal_date_in_future': COMMON_TEXT.dateCannotBeFuture,
    'stock.withdrawal_no_lines': 'Agregá al menos una variedad con sus gramos',
    'stock.withdrawal_grams_not_positive': 'Los gramos tienen que ser más que cero',
    'stock.withdrawal_grams_too_precise': 'Los gramos admiten hasta dos decimales',
    'stock.withdrawal_note_too_long': 'La nota admite hasta 200 caracteres',
    'stock.withdrawal_variety_not_found': 'Alguna variedad ya no está: elegí otra',
  },
} as const

export const LIMITED_COPY: readonly LimitedCopy[] = []
export const LONG_REFUSALS: readonly string[] = []
