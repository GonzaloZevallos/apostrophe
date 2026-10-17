/**
 * The forms, sheets and shared `Estados` states the phone walk visits beside the registry's
 * routes (plan, "Walkable states"). A state is a registry-shaped screen (a route, its steps,
 * whether it is walked signed out) plus the answers the page is given in place of the
 * backend's: a stubbed write (never one that reaches the server, invariant 6) or a stubbed
 * GET. The names are the ones `STATE_NAMES` (`src/mobile-standard/registry.ts`) lists; the
 * spec fails when the two differ. Each `states-*` subtask appends its own group below.
 */

import type { RegistryScreen } from '../../src/mobile-standard/registry.ts'
import type { ReadStub, WriteStub } from './network.js'

export interface WalkState {
  screen: RegistryScreen
  writes: readonly WriteStub[]
  reads: readonly ReadStub[]
}

function state(
  name: string,
  route: string,
  parts: {
    steps?: RegistryScreen['steps']
    signedOut: boolean
    writes?: readonly WriteStub[]
    reads?: readonly ReadStub[]
  },
): WalkState {
  return {
    screen: {
      screen: name,
      route,
      path: route,
      viewport: null,
      signedOut: parts.signedOut,
      theme: null,
      steps: parts.steps ?? [],
    },
    writes: parts.writes ?? [],
    reads: parts.reads ?? [],
  }
}

// What the screens say (`screens/authMessages.ts`, `components/ErrorGenerico.tsx`,
// `api/refusals.ts`, `screens/Invitacion.tsx`): the steps wait on these words, so a
// reworded state is an `unreachable` page rule, not a silent pass.
const BRAKE = '5 intentos fallidos · probá de nuevo en 15 minutos'
const INVITATION_DEAD = 'Esta invitación ya no sirve'
const LINK_DEAD = 'Este enlace ya no sirve. Pedile uno nuevo a quien te lo pasó.'
const RETRY = 'Algo falló. Probá de nuevo.'
const GONE_NOTICE = 'Eso ya no está. La lista ya está al día.'

/** A token no invitation or reset link was ever minted with: the backend answers it as gone. */
const UNKNOWN_TOKEN = 'no-such-token-0000000000000000'

/**
 * Getting in and the shared states. "Sin conexión" and the bare "Eso ya no está." are the
 * registry's own `EstadosSinConexion` and `EstadosGone`; the loading state is every
 * screen's held walk, so neither is repeated here.
 */
export const GETTING_IN_STATES: readonly WalkState[] = [
  state('EntrarFreno', '/entrar', {
    signedOut: true,
    steps: [
      { fill: { label: 'Email', value: '{email}' } },
      { fill: { label: 'Contraseña', value: 'equivocada123' } },
      { click: 'Entrá' },
      { wait: BRAKE },
    ],
    writes: [{ method: 'POST', path: /^\/auth\/login$/, status: 429, body: { code: 'account.login_locked' } }],
  }),
  state('InvitacionMuerta', `/invitation/${UNKNOWN_TOKEN}`, {
    signedOut: true,
    steps: [{ wait: INVITATION_DEAD }],
  }),
  state('ResetMuerto', `/reset/${UNKNOWN_TOKEN}`, {
    signedOut: true,
    steps: [{ wait: LINK_DEAD }],
  }),
  state('EstadosReintento', '/ventas', {
    signedOut: false,
    steps: [{ wait: RETRY }],
    reads: [{ path: /^\/sales$/, status: 500 }],
  }),
  state('EstadosGoneAviso', '/ventas/{owing_sale}', {
    signedOut: false,
    steps: [{ click: 'Borrar venta' }, { click: 'Sí, borrala' }, { wait: GONE_NOTICE }],
    writes: [{ method: 'DELETE', path: /^\/sales\/\d+$/, status: 404, body: { code: 'sale.not_found' } }],
  }),
]

/** Every state the walk visits, in order; a group per `states-*` subtask. */
export const STATES: readonly WalkState[] = [...GETTING_IN_STATES]
