/**
 * The fixed words of Configuración → Integraciones, shared with its test (no JSX). The
 * always-visible lines are listed in `LIMITED_COPY`, the same bindings the screen
 * renders, so `copy/copyLimits.test.ts` measures what the seller reads. A longer "how"
 * for the own chat waits for `MasInfo` (`info-notice-copy`); until then the line says the
 * two things the seller needs and nothing else.
 */

import type { LimitedCopy } from '../../copy/limits'

export const CHANNEL_CHAT_HELP = 'Es el @usuario o el enlace del canal donde se publica el catálogo.'
export const OWN_CHAT_HELP = 'Tocá Iniciar en tu bot; tu número lo ves con @userinfobot.'
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
