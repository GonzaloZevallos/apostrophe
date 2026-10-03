/**
 * Every session boundary — login, accept, logout, a 401 on a gated call — clears
 * the whole query cache before it navigates (plan, "Session"): no screen of the
 * business just left stays warm in the cache for whoever signs in next. Login and
 * accept return nothing: the client never reads the token (plan, invariants); the
 * session lives only in the backend's cookie, which `api/client.ts` already sends
 * with `credentials: 'include'`.
 */

import type { QueryClient } from '@tanstack/react-query'
import { get, post } from './api/client'

export interface SessionActions {
  queryClient: QueryClient
  navigate: (path: string) => void
}

function boundary(actions: SessionActions, path: string): void {
  actions.queryClient.clear()
  actions.navigate(path)
}

export async function login(actions: SessionActions, email: string, password: string): Promise<void> {
  await post('/auth/login', { email, password })
  boundary(actions, '/')
}

export interface AcceptBody {
  email: string
  password: string
  // Required by a new-business invitation; ignored by a join invitation.
  business_name?: string
}

export async function acceptInvitation(
  actions: SessionActions,
  token: string,
  body: AcceptBody,
): Promise<void> {
  await post(`/invitations/${token}/accept`, body)
  boundary(actions, '/')
}

export async function logOut(actions: SessionActions): Promise<void> {
  await post('/auth/logout')
  boundary(actions, '/entrar')
}

export interface InvitationView {
  kind: 'new_business' | 'join_business'
  business_name: string | null
  expires_at: string
}

/**
 * Opening `/invitation/:token` must end any current session through the app's own
 * log-out first — never just by clearing client state (plan, "Session"; PM round 1)
 * — so acceptance always starts clean and the business the person ends up in is
 * always the one the link names. A user who opens their own business's join link is
 * logged out this same way, and logs in again.
 *
 * In that order: `POST /auth/logout` (drops the backend's cookie), then
 * `queryClient.clear()`, then the invitation lookup. No navigation here: the
 * invitation screen is already where the person is; it renders what this resolves
 * to.
 */
export async function openInvitation(
  actions: Pick<SessionActions, 'queryClient'>,
  token: string,
): Promise<InvitationView> {
  await post('/auth/logout')
  actions.queryClient.clear()
  return get<InvitationView>(`/invitations/${token}`)
}

const PUBLIC_PATH_PREFIXES = ['/entrar', '/invitation/']

function isPublicPath(path: string): boolean {
  return PUBLIC_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))
}

/** A 401 on a gated call clears the cache and sends the person back to Entrar
 * (plan, "Session") — unless the screen they are already on is public, where a 401
 * does nothing: an invitation lookup, for one, answers signed out on purpose. */
export function handleUnauthorized(actions: SessionActions, currentPath: string): void {
  if (isPublicPath(currentPath)) return
  boundary(actions, '/entrar')
}
