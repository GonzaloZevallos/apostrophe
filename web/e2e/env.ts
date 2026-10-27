/**
 * The one throwaway environment each e2e backend starts with (plan, "Shape"/"Old shapes
 * kept": never `scripts/serve.sh` or `scripts/invite-business.sh`, which source `.env` —
 * this run sets its own variables explicitly, from here, so the worker's server
 * (`fixtures.ts`'s `workerServer`) and the `invite-business` CLI call
 * (`newBusinessInvitationUrl`) always agree on the same database and secret).
 *
 * The port is decided only by `web/e2e/fixtures.ts` (ADR-0040): each Playwright worker
 * picks its own free port and writes it to `APOSTROPHE_E2E_WORKER_PORT` in its own
 * process. This module never reads the environment when it loads — only when `e2ePort()`,
 * `e2eBaseUrl()`, `e2eDbPath()` or `e2eEnv()` are called — so every caller in a worker
 * sees that worker's one port.
 */

const PORT_VARIABLE = 'APOSTROPHE_E2E_WORKER_PORT'
const CLOCK_OFFSET_VARIABLE = 'APOSTROPHE_E2E_CLOCK_OFFSET'

export const E2E_HOST = '127.0.0.1'
export const E2E_SECRET_KEY = 'e2e-secret-key-not-for-production'

/**
 * Reads and validates `APOSTROPHE_E2E_WORKER_PORT`: digits only, from 1 to 65535. Throws a
 * fixed error naming only the variable and the rule — never a port picked here:
 * only `fixtures.ts` picks one.
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

/**
 * `fixtures.ts` writes the clock offset once per worker, before its backend starts; this
 * passes it on to every child (the server and the CLI calls), so they share one anchored
 * clock (ADR-0043). Only `tests/e2e_app.py` reads it. No offset set, nothing passed.
 */
export function e2eEnv(): Record<string, string> {
  const offset = process.env[CLOCK_OFFSET_VARIABLE]
  return {
    ...(offset === undefined ? {} : { [CLOCK_OFFSET_VARIABLE]: offset }),
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

const LANGUAGE_VARIABLE = 'APOSTROPHE_FORCED_LANGUAGE'

/**
 * The language the phone check runs in: the one `playwright.config.ts` passes the backend as
 * `APOSTROPHE_FORCED_LANGUAGE`, mirroring `app/settings.py` `_forced_language`. Unset or empty
 * is `en`; exactly `en-XA` is `en-XA`; anything else (`en` and whitespace included, nothing
 * is trimmed) throws an error naming the variable and never its value.
 */
export function mobileLanguage(): 'en' | 'en-XA' {
  const raw = process.env[LANGUAGE_VARIABLE]
  if (raw === undefined || raw === '') return 'en'
  if (raw === 'en-XA') return 'en-XA'
  throw new Error(`${LANGUAGE_VARIABLE} must be unset, empty or exactly en-XA.`)
}

export function mobileEnv(): Record<string, string> {
  return {
    ...(mobileLanguage() === 'en-XA' ? { [LANGUAGE_VARIABLE]: 'en-XA' } : {}),
    APOSTROPHE_SECRET_KEY: E2E_SECRET_KEY,
    APOSTROPHE_DATABASE_URL: `sqlite:///${mobileDbPath()}`,
    APOSTROPHE_PUBLIC_URL: mobileBaseUrl(),
    APOSTROPHE_WEB_DIST: 'web/dist',
  }
}

// Where the seed leaves what the mobile walk reads (relative to `web/`, the cwd of a run).
export const MOBILE_STATE_FILE = 'e2e/.tmp/mobile-state.json'
export const MOBILE_FACTS_FILE = 'e2e/.tmp/mobile-facts.json'
