// @vitest-environment node
/** `findInexactLabels` over every file under `web/e2e/`: an inexact `getByLabel` fails here. */

import { readdirSync, readFileSync } from 'node:fs'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import { findInexactLabels } from './e2eExactLabel'

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

const FILES = filesUnder(E2E_DIR)
const READ = FILES.map((file) => ({ name: path.relative(E2E_DIR, file), source: readFileSync(file, 'utf-8') }))

describe('the real web/e2e sources', () => {
  it('have no getByLabel that is not exact', () => {
    const offenders = READ.flatMap(({ name, source }) =>
      findInexactLabels(source).map((found) => `${name}:${found.line} ${found.reason}`),
    )
    expect(offenders).toEqual([])
  })

  it('are only .ts files, the extension the walker was checked against', () => {
    expect([...new Set(FILES.map((file) => path.extname(file)))].sort()).toEqual(['.ts'])
  })

  it('hold getByLabel calls, so the walk is not vacuous', () => {
    const calls = READ.reduce((count, { source }) => count + (source.match(/getByLabel\(/g)?.length ?? 0), 0)
    expect(calls).toBeGreaterThan(0)
  })
})
