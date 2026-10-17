/**
 * Getting in and the shared `Estados` states. "Sin conexión" and the bare "Eso ya no está."
 * are the registry's own `EstadosSinConexion` and `EstadosGone`; the loading state is every
 * screen's held walk, so neither is repeated here. Each state waits on the words the screen
 * says (`screens/authMessages.ts`, `components/ErrorGenerico.tsx`, `api/refusals.ts`,
 * `screens/Invitacion.tsx`), so a reworded state is an `unreachable` page rule, not a
 * silent pass. Writes are stubbed, never sent (invariant 6).
 */

import type { WalkState } from './states.ts'

const BRAKE = '5 intentos fallidos · probá de nuevo en 15 minutos'
const INVITATION_DEAD = 'Esta invitación ya no sirve'
const LINK_DEAD = 'Este enlace ya no sirve. Pedile uno nuevo a quien te lo pasó.'
const RETRY = 'Algo falló. Probá de nuevo.'
const GONE_NOTICE = 'Eso ya no está. La lista ya está al día.'

/** A token no invitation or reset link was ever minted with: the backend answers it as gone. */
const NEVER_MINTED = 'no-such-link-0000000000000000'

export const GETTING_IN_STATES: readonly WalkState[] = [
  {
    screen: 'EntrarFreno',
    route: '/entrar',
    signedOut: true,
    steps: [
      { fill: { label: 'Email', value: '{email}' } },
      { fill: { label: 'Contraseña', value: 'equivocada123' } },
      { click: 'Entrá' },
    ],
    visible: BRAKE,
    writes: [{ method: 'POST', path: /^\/auth\/login$/, status: 429, body: { code: 'account.login_locked' } }],
  },
  { screen: 'InvitacionMuerta', route: `/invitation/${NEVER_MINTED}`, signedOut: true, steps: [], visible: INVITATION_DEAD },
  { screen: 'ResetMuerto', route: `/reset/${NEVER_MINTED}`, signedOut: true, steps: [], visible: LINK_DEAD },
  {
    screen: 'EstadosReintento',
    route: '/ventas',
    steps: [],
    visible: RETRY,
    reads: [{ path: /^\/sales$/, status: 500 }],
  },
  {
    screen: 'EstadosGoneAviso',
    route: '/ventas/{owing_sale}',
    steps: [{ click: 'Borrar venta' }, { click: 'Sí, borrala' }],
    visible: GONE_NOTICE,
    writes: [{ method: 'DELETE', path: /^\/sales\/\d+$/, status: 404, body: { code: 'sale.not_found' } }],
  },
]
