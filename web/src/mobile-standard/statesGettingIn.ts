/**
 * Getting in and the shared `Estados` states. "No connection" and the bare "That's gone."
 * are the registry's own `EstadosSinConexion` and `EstadosGone`; the loading state is every
 * screen's held walk, so neither is repeated here. Each state waits on the words the screen
 * says (`screens/authMessages.ts`, `components/ErrorGenerico.tsx`, `api/refusals.ts`,
 * `screens/Invitacion.tsx`), so a reworded state is an `unreachable` page rule, not a
 * silent pass. Writes are stubbed, never sent (invariant 6).
 */

import { INVITATION, LOGIN, RESET, SALE, SALES } from '../routes.ts'
import * as auth from '../copy/auth.ts'
import { GONE_NOTICE, RETRY_MESSAGE, WORD_YES_DELETE_IT } from '../copy/common.ts'
import * as sales from '../copy/sales.ts'
import type { WalkState } from './states.ts'

/** A token no invitation or reset link was ever minted with: the backend answers it as gone. */
const NEVER_MINTED = 'no-such-link-0000000000000000'

export const GETTING_IN_STATES: readonly WalkState[] = [
  {
    screen: 'EntrarFreno',
    route: LOGIN,
    signedOut: true,
    steps: [
      { fill: { label: auth.EMAIL_LABEL, value: '{email}' } },
      { fill: { label: auth.PASSWORD_LABEL, value: 'equivocada123' } },
      { click: auth.SIGN_IN },
    ],
    visible: auth.BRAKE_MESSAGE,
    writes: [{ method: 'POST', path: /^\/auth\/login$/, status: 429, body: { code: 'account.login_locked' } }],
  },
  { screen: 'InvitacionMuerta', route: INVITATION.replace(':token', NEVER_MINTED), signedOut: true, steps: [], visible: auth.NOT_USABLE_TITLE },
  { screen: 'ResetMuerto', route: RESET.replace(':token', NEVER_MINTED), signedOut: true, steps: [], visible: auth.DEAD_LINK_MESSAGE },
  {
    screen: 'EstadosReintento',
    route: SALES,
    steps: [],
    visible: RETRY_MESSAGE,
    reads: [{ path: /^\/sales$/, status: 500 }],
  },
  {
    screen: 'EstadosGoneAviso',
    route: SALE.replace(':id', '{owing_sale}'),
    steps: [{ click: sales.DELETE_SALE }, { click: WORD_YES_DELETE_IT }],
    visible: GONE_NOTICE,
    writes: [{ method: 'DELETE', path: /^\/sales\/\d+$/, status: 404, body: { code: 'sale.not_found' } }],
  },
]
