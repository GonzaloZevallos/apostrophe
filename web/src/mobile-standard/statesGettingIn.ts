/**
 * Getting in and the shared `Estados` states. "Sin conexión" and the bare "Eso ya no está."
 * are the registry's own `EstadosSinConexion` and `EstadosGone`; the loading state is every
 * screen's held walk, so neither is repeated here. Each state waits on the words the screen
 * says (`copy/auth.ts`, `components/ErrorGenerico.tsx`, `api/refusals.ts`,
 * `screens/Invitacion.tsx`), so a reworded state is an `unreachable` page rule, not a
 * silent pass. Writes are stubbed, never sent (invariant 6).
 */

import { COMMON_TEXT, ERROR_GENERICO_MENSAJE } from '../copy/common.ts'
import { SALES_TEXT } from '../copy/sales.ts'
import { REFUSAL_TEXT } from '../copy/refusals.ts'
import { INVITATION, LOGIN, RESET, SALE, SALES } from '../routes.ts'
import type { WalkState } from './states.ts'

const BRAKE = '5 intentos fallidos · probá de nuevo en 15 minutos'
const INVITATION_DEAD = 'Esta invitación ya no sirve'
const LINK_DEAD = 'Este enlace ya no sirve. Pedile uno nuevo a quien te lo pasó.'
const RETRY = ERROR_GENERICO_MENSAJE
const GONE_NOTICE = REFUSAL_TEXT.goneNotice

/** A token no invitation or reset link was ever minted with: the backend answers it as gone. */
const NEVER_MINTED = 'no-such-link-0000000000000000'

export const GETTING_IN_STATES: readonly WalkState[] = [
  {
    screen: 'EntrarFreno',
    route: LOGIN,
    signedOut: true,
    steps: [
      { fill: { label: 'Email', value: '{email}' } },
      { fill: { label: 'Contraseña', value: 'equivocada123' } },
      { click: 'Entrá' },
    ],
    visible: BRAKE,
    writes: [{ method: 'POST', path: /^\/auth\/login$/, status: 429, body: { code: 'account.login_locked' } }],
  },
  { screen: 'InvitacionMuerta', route: INVITATION.replace(':token', NEVER_MINTED), signedOut: true, steps: [], visible: INVITATION_DEAD },
  { screen: 'ResetMuerto', route: RESET.replace(':token', NEVER_MINTED), signedOut: true, steps: [], visible: LINK_DEAD },
  {
    screen: 'EstadosReintento',
    route: SALES,
    steps: [],
    visible: RETRY,
    reads: [{ path: /^\/sales$/, status: 500 }],
  },
  {
    screen: 'EstadosGoneAviso',
    route: SALE.replace(':id', '{owing_sale}'),
    steps: [{ click: SALES_TEXT.deleteSale }, { click: COMMON_TEXT.yesDelete }],
    visible: GONE_NOTICE,
    writes: [{ method: 'DELETE', path: /^\/sales\/\d+$/, status: 404, body: { code: 'sale.not_found' } }],
  },
]
