/**
 * The one step this check does from outside the front: printing a fresh
 * new-business invitation link, the same way `scripts/invite-business.sh` does for a
 * real seller — a CLI command, never `curl` (PRD, M1: "no `curl` at any point" rules
 * out the HTTP shortcut, not the install step every business already needs once).
 * Everything after this runs through the browser alone.
 */

import { execFileSync } from 'node:child_process'
import { E2E_ENV } from './env.js'

export function newBusinessInvitationUrl(): string {
  const output = execFileSync(
    'uv',
    ['run', '--no-project', 'python', '-m', 'app.accounts.adapters.cli', 'invite-business'],
    { cwd: '..', env: { ...process.env, ...E2E_ENV }, encoding: 'utf-8' },
  )
  const firstLine = output.split('\n')[0]
  if (firstLine === undefined || !firstLine.startsWith('http')) {
    throw new Error(`invite-business printed no link: ${output}`)
  }
  return firstLine
}

/** Prints a fresh reset link for `email`, the same way `scripts/reset-password.sh`
 * does for a seller who forgot their password — a CLI command, never `curl`
 * (PRD, "No curl"). */
export function resetLink(email: string): string {
  const output = execFileSync(
    'uv',
    ['run', '--no-project', 'python', '-m', 'app.accounts.adapters.cli', 'reset-password', email],
    { cwd: '..', env: { ...process.env, ...E2E_ENV }, encoding: 'utf-8' },
  )
  const firstLine = output.split('\n')[0]
  if (firstLine === undefined || !firstLine.startsWith('http')) {
    throw new Error(`reset-password printed no link: ${output}`)
  }
  return firstLine
}
