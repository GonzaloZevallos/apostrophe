/**
 * The fixed words of Configuración → Integraciones, shared with its test (no JSX). The
 * always-visible lines are listed in `LIMITED_COPY`, the same bindings the screen
 * renders, so `copy/copyLimits.test.ts` measures what the seller reads. The longer "how" for
 * the own chat is `OWN_CHAT_INFO.more`, behind `MasInfo`: only the how, never a consequence or a
 * fix. It is an object, not a string export, so the registry check does not read it as a line.
 */

import type { LimitedCopy } from '../../copy/limits'

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

export const LIMITED_COPY: readonly LimitedCopy[] = [
  { kind: 'help', text: CHANNEL_CHAT_HELP },
  { kind: 'help', text: OWN_CHAT_HELP },
  { kind: 'help', text: LOAD_THE_TOKEN_FIRST },
  { kind: 'notice', text: PREVIOUS_PIN_NOTICE },
]
export const LONG_REFUSALS: readonly string[] = []
