/**
 * The one throwaway environment the e2e check starts the backend with (plan,
 * "Shape"/"Old shapes kept": never `scripts/serve.sh` or `scripts/invite-business.sh`,
 * which source `.env` — this run sets its own variables explicitly, from here, so the
 * server (`playwright.config.ts`'s `webServer`) and the `invite-business` CLI call
 * (`newBusinessInvitationUrl` below) always agree on the same database and secret.
 *
 * The port is decided only in `playwright.config.ts` (plan, "Shape": it reads
 * `APOSTROPHE_E2E_PORT` or picks a free one with `freePort.ts` and writes it back).
 * This module never reads the environment when it loads — only when `e2ePort()`,
 * `e2eBaseUrl()`, `e2eDbPath()` or `e2eEnv()` are called — so every caller sees the
 * one port the config already settled on.
 */

const PORT_VARIABLE = 'APOSTROPHE_E2E_PORT'

export const E2E_HOST = '127.0.0.1'
export const E2E_SECRET_KEY = 'e2e-secret-key-not-for-production'

/**
 * Reads and validates `APOSTROPHE_E2E_PORT`: digits only, from 1 to 65535. Throws a
 * fixed error naming only the variable and the rule — never a port picked here, by
 * decision (plan, "Shape": "It never picks a port").
 */
export function e2ePort(): number {
  const raw = process.env[PORT_VARIABLE]
  const isValid = raw !== undefined && /^[0-9]+$/.test(raw) && Number(raw) >= 1 && Number(raw) <= 65535
  if (!isValid) {
    throw new Error(`${PORT_VARIABLE} must be set to a port number from 1 to 65535.`)
  }
  return Number(raw)
}

export function e2eBaseUrl(): string {
  return `http://${E2E_HOST}:${e2ePort()}`
}

// Relative to the repository root (every command below runs with `cwd: '..'`).
export function e2eDbPath(): string {
  return `web/e2e/.tmp/e2e-${e2ePort()}.db`
}

export function e2eEnv(): Record<string, string> {
  return {
    APOSTROPHE_SECRET_KEY: E2E_SECRET_KEY,
    APOSTROPHE_DATABASE_URL: `sqlite:///${e2eDbPath()}`,
    APOSTROPHE_PUBLIC_URL: e2eBaseUrl(),
    APOSTROPHE_WEB_DIST: 'web/dist',
  }
}

// The phone check's own server (GH-80, invariant 7): the same composition behind its own
// port and its own throwaway database, with its clock pinned
// (`tests/e2e_app.py::create_mobile_e2e_app`). The port is decided in
// `playwright.config.ts` exactly like the first server's, and read back here.
const MOBILE_PORT_VARIABLE = 'APOSTROPHE_E2E_MOBILE_PORT'

export function mobilePort(): number {
  const raw = process.env[MOBILE_PORT_VARIABLE]
  const isValid = raw !== undefined && /^[0-9]+$/.test(raw) && Number(raw) >= 1 && Number(raw) <= 65535
  if (!isValid) {
    throw new Error(`${MOBILE_PORT_VARIABLE} must be set to a port number from 1 to 65535.`)
  }
  return Number(raw)
}

export function mobileBaseUrl(): string {
  return `http://${E2E_HOST}:${mobilePort()}`
}

export function mobileDbPath(): string {
  return `web/e2e/.tmp/e2e-mobile-${mobilePort()}.db`
}

export function mobileEnv(): Record<string, string> {
  return {
    APOSTROPHE_SECRET_KEY: E2E_SECRET_KEY,
    APOSTROPHE_DATABASE_URL: `sqlite:///${mobileDbPath()}`,
    APOSTROPHE_PUBLIC_URL: mobileBaseUrl(),
    APOSTROPHE_WEB_DIST: 'web/dist',
  }
}

// Where the seed leaves what the mobile walk reads (relative to `web/`, the cwd of a run).
export const MOBILE_STATE_FILE = 'e2e/.tmp/mobile-state.json'
export const MOBILE_FACTS_FILE = 'e2e/.tmp/mobile-facts.json'
