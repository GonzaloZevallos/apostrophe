/**
 * The e2e check's one fixture file (ADR-0040, GH-152). Each Playwright worker owns its
 * own backend: its own uvicorn running `tests.e2e_app:create_e2e_app` (the real app with
 * `E2eTelegram` and no upkeep ticker), on its own free port, over its own throwaway SQLite
 * file — never `scripts/serve.sh`, which sources `.env`. So two workers never share an
 * installation, and a spec's `uniqueTag()`-built identities cannot collide with another
 * worker's.
 *
 * This is the only module that picks a port, starts a backend, or writes
 * `APOSTROPHE_E2E_WORKER_PORT`; `env.ts` reads that variable back for every other caller.
 * It is also the only e2e module allowed to import the values `test` and `expect` from
 * `@playwright/test` (`web/.oxlintrc.json`): every spec imports them from here, so a spec
 * can never run without its worker's server.
 */

import { spawn, type ChildProcess } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test as base } from '@playwright/test'
import { E2E_HOST, e2eBaseUrl, e2eDbPath, e2eEnv, e2ePort } from './env.js'
import { freePort } from './freePort.js'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const ATTEMPTS = 3
const READY_TIMEOUT_MS = 30_000
const TERM_GRACE_MS = 5_000

/** Matches the line uvicorn prints on stderr once it listens on this worker's port. */
function readyPattern(port: number): RegExp {
  return new RegExp(`Uvicorn running on http://${E2E_HOST.replace(/\./g, '\\.')}:${port}\\b`)
}

function removeDatabase(): void {
  const db = path.join(REPO_ROOT, e2eDbPath())
  for (const file of [db, `${db}-journal`, `${db}-wal`]) {
    rmSync(file, { force: true })
  }
}

function signalGroup(child: ChildProcess, signal: NodeJS.Signals): void {
  if (child.pid === undefined) return
  try {
    process.kill(-child.pid, signal)
  } catch {
    // The group is already gone.
  }
}

/** SIGTERM to the whole group, up to `TERM_GRACE_MS` for it to leave, then SIGKILL. */
async function stop(child: ChildProcess): Promise<void> {
  const exited = new Promise<void>((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) resolve()
    else child.once('exit', () => resolve())
  })
  signalGroup(child, 'SIGTERM')
  await Promise.race([exited, new Promise<void>((resolve) => setTimeout(resolve, TERM_GRACE_MS))])
  signalGroup(child, 'SIGKILL')
}

/** The child stayed silent for `READY_TIMEOUT_MS`: not a lost port race, so never retried. */
class ReadyTimeout extends Error {
  constructor() {
    super(`The e2e backend was not ready within ${READY_TIMEOUT_MS / 1000} s.`)
  }
}

/**
 * Starts one backend on a fresh port; resolves with the child once it announced itself on
 * stderr, rejects if it exits (a lost port race: the caller retries) or stays silent for
 * `READY_TIMEOUT_MS` (a `ReadyTimeout`, not retried). The child is stopped either way. No URL is polled: another checkout's server answering on this port must never
 * pass for this worker's own.
 */
async function startOnce(): Promise<ChildProcess> {
  const port = await freePort(E2E_HOST)
  process.env.APOSTROPHE_E2E_WORKER_PORT = String(port)
  mkdirSync(path.dirname(path.join(REPO_ROOT, e2eDbPath())), { recursive: true })
  removeDatabase()
  const child = spawn(
    'uv',
    [
      'run', '--no-project', 'uvicorn', 'tests.e2e_app:create_e2e_app', '--factory',
      '--host', E2E_HOST, '--port', String(e2ePort()), '--no-access-log',
    ],
    {
      cwd: REPO_ROOT,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...e2eEnv(), APOSTROPHE_E2E_PARENT_PID: String(process.pid) },
    },
  )
  const ready = readyPattern(port)
  try {
    await new Promise<void>((resolve, reject) => {
      let seen = ''
      const timer = setTimeout(() => reject(new ReadyTimeout()), READY_TIMEOUT_MS)
      child.stdout?.resume()
      child.stderr?.on('data', (chunk: Buffer) => {
        seen = (seen + chunk.toString()).slice(-4096)
        if (ready.test(seen)) {
          clearTimeout(timer)
          resolve()
        }
      })
      child.once('error', () => {
        clearTimeout(timer)
        reject(new Error('spawn'))
      })
      child.once('exit', () => {
        clearTimeout(timer)
        reject(new Error('exit'))
      })
    })
  } catch (error) {
    await stop(child)
    removeDatabase()
    throw error
  }
  return child
}

// The fixtures' second argument is called `provide`, not `use`: oxlint's rules-of-hooks
// reads any call to `use` as a React hook.
export interface WorkerServer {
  url: string
}

export const test = base.extend<object, { workerServer: WorkerServer }>({
  workerServer: [
    async ({ playwright }, provide) => {
      void playwright
      let child: ChildProcess | undefined
      for (let attempt = 1; child === undefined && attempt <= ATTEMPTS; attempt += 1) {
        try {
          child = await startOnce()
        } catch (error) {
          // A lost port race (the child exited): try again with a new port.
          if (error instanceof ReadyTimeout) throw error
        }
      }
      if (child === undefined) {
        throw new Error(`The e2e backend did not start after ${ATTEMPTS} attempts.`)
      }
      try {
        await provide({ url: e2eBaseUrl() })
      } finally {
        await stop(child)
        removeDatabase()
      }
    },
    { scope: 'worker', auto: true, timeout: 100_000 },
  ],
  baseURL: async ({ baseURL, workerServer }, provide) => {
    await provide(baseURL ?? workerServer.url)
  },
})

export { expect }
