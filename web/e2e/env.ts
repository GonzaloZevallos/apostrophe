/**
 * The one throwaway environment the e2e check starts the backend with (plan,
 * "Shape"/"Old shapes kept": never `scripts/serve.sh` or `scripts/invite-business.sh`,
 * which source `.env` — this run sets its own variables explicitly, from here, so the
 * server (`playwright.config.ts`'s `webServer`) and the `invite-business` CLI call
 * (`newBusinessInvitationUrl` below) always agree on the same database and secret.
 */

export const E2E_PORT = 8799
export const E2E_BASE_URL = `http://127.0.0.1:${E2E_PORT}`
// Relative to the repository root (every command below runs with `cwd: '..'`).
export const E2E_DB_PATH = 'web/e2e/.tmp/e2e.db'
export const E2E_SECRET_KEY = 'e2e-secret-key-not-for-production'

export const E2E_ENV: Record<string, string> = {
  APOSTROPHE_SECRET_KEY: E2E_SECRET_KEY,
  APOSTROPHE_DATABASE_URL: `sqlite:///${E2E_DB_PATH}`,
  APOSTROPHE_PUBLIC_URL: E2E_BASE_URL,
  APOSTROPHE_WEB_DIST: 'web/dist',
}
