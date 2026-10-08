/**
 * The lint rule that keeps every e2e file on the worker's own backend (ADR-0037, GH-152):
 * under `e2e/`, only `fixtures.ts` may import the values `test` and `expect` from
 * `@playwright/test`. The real `.oxlintrc.json` is copied next to throwaway files, so the
 * rule is exercised on an input it must reject and on the inputs it must accept, without
 * touching `web/e2e/`.
 */

import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import * as path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// Vitest runs with `web/` as its root (`npm --prefix web test`).
const WEB_ROOT = process.cwd()
const OXLINT = path.join(WEB_ROOT, 'node_modules', '.bin', 'oxlint')

let workdir = ''

function lint(file: string): { status: number | null; output: string } {
  const result = spawnSync(OXLINT, ['-c', '.oxlintrc.json', '--deny-warnings', file], {
    cwd: workdir,
    encoding: 'utf-8',
  })
  return { status: result.status, output: `${result.stdout}${result.stderr}` }
}

describe('the e2e import rule', () => {
  beforeAll(() => {
    workdir = mkdtempSync(path.join(tmpdir(), 'oxlint-e2e-'))
    mkdirSync(path.join(workdir, 'e2e'))
    cpSync(path.join(WEB_ROOT, '.oxlintrc.json'), path.join(workdir, '.oxlintrc.json'))
    const valueImport = "import { expect, test } from '@playwright/test'\nexport const both = [expect, test]\n"
    writeFileSync(path.join(workdir, 'e2e', 'bad.spec.ts'), valueImport)
    writeFileSync(path.join(workdir, 'e2e', 'fixtures.ts'), valueImport)
    writeFileSync(
      path.join(workdir, 'e2e', 'types.ts'),
      "import type { Page } from '@playwright/test'\nexport type Shown = Page\n",
    )
  })

  afterAll(() => {
    rmSync(workdir, { recursive: true, force: true })
  })

  it('rejects a spec that imports test and expect from @playwright/test', () => {
    const { status, output } = lint('e2e/bad.spec.ts')
    expect(status).not.toBe(0)
    expect(output).toContain("'test' import from '@playwright/test' is restricted")
    expect(output).toContain("'expect' import from '@playwright/test' is restricted")
  })

  it('accepts a type-only import of @playwright/test', () => {
    expect(lint('e2e/types.ts').status).toBe(0)
  })

  it('accepts the value import in fixtures.ts alone', () => {
    expect(lint('e2e/fixtures.ts').status).toBe(0)
  })
})
