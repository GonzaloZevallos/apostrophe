/**
 * The one throwaway environment each e2e backend starts with (plan, "Shape"/"Old shapes
 * kept": never `scripts/serve.sh` or `scripts/invite-business.sh`, which source `.env` —
 * this run sets its own variables explicitly, from here, so the worker's server
 * (`fixtures.ts`'s `workerServer`) and the `invite-business` CLI call
 * (`newBusinessInvitationUrl`) always agree on the same database and secret).
 *
 * The port is decided only by `web/e2e/fixtures.ts` (ADR-0037): each Playwright worker
 * picks its own free port and writes it to `APOSTROPHE_E2E_WORKER_PORT` in its own
 * process. This module never reads the environment when it loads — only when `e2ePort()`,
 * `e2eBaseUrl()`, `e2eDbPath()` or `e2eEnv()` are called — so every caller in a worker
 * sees that worker's one port.
 */

const PORT_VARIABLE = 'APOSTROPHE_E2E_WORKER_PORT'

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

export function e2eEnv(): Record<string, string> {
  return {
    APOSTROPHE_SECRET_KEY: E2E_SECRET_KEY,
    APOSTROPHE_DATABASE_URL: `sqlite:///${e2eDbPath()}`,
    APOSTROPHE_PUBLIC_URL: e2eBaseUrl(),
    APOSTROPHE_WEB_DIST: 'web/dist',
  }
}
