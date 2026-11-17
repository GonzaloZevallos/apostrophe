// @vitest-environment node
/** `findChromeLandmarks` over every file under `web/e2e/`: a spec that names the bottom chrome fails here. */

import { readdirSync, readFileSync } from 'node:fs'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import { CHROME_HELPER, findChromeLandmarks } from './e2eChromeLandmarks'

// Vitest runs with `web/` as its root (`npm --prefix web test`).
const E2E_DIR = path.join(process.cwd(), 'e2e')

// `e2e/.tmp` is the running suite's own git-ignored scratch (throwaway databases), not source.
const SCRATCH = '.tmp'

function filesUnder(directory: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name === SCRATCH) continue
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) found.push(...filesUnder(full))
    else found.push(full)
  }
  return found.sort()
}

const READ = filesUnder(E2E_DIR).map((file) => ({
  path: path.relative(E2E_DIR, file).split(path.sep).join(path.posix.sep),
  text: readFileSync(file, 'utf-8'),
}))

describe('the real web/e2e sources', () => {
  it('name the bottom bar and the New sale entry only in helpers/chrome.ts', () => {
    expect(findChromeLandmarks(READ)).toEqual([])
  })

  it('hold the helper module, so the walk is not vacuous', () => {
    expect(READ.map((file) => file.path)).toContain(CHROME_HELPER)
    expect(READ.length).toBeGreaterThan(10)
  })
})
