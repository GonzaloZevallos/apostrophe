/**
 * `npm run i18n:baseline` runs this file through vitest (it needs `import.meta.glob`):
 * it writes `src/copy/en.baseline.json` when absent, otherwise checks it; with `--update`
 * it rewrites the texts of the entries whose export still exists. Without
 * `I18N_BASELINE` in the environment it is skipped, so the suite never writes the file.
 */

import { basename, join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { runBaseline, type Modules } from './baseline.ts'

const requested = process.env['I18N_BASELINE']

const found = import.meta.glob<Record<string, unknown>>(
  ['../../src/copy/*.ts', '!../../src/copy/baselineArgs.ts', '!../../src/copy/*.test.ts'],
  { eager: true },
)

describe.runIf(requested === 'default' || requested === 'update')('the English baseline script', () => {
  test('writes, checks or updates src/copy/en.baseline.json', () => {
    const modules: Modules = Object.fromEntries(Object.entries(found).map(([path, mod]) => [basename(path), mod]))
    const file = join(import.meta.dirname, '../../src/copy/en.baseline.json')
    const { action, problems } = runBaseline({ modules, file, mode: requested === 'update' ? 'update' : 'default' })
    console.log(`en.baseline.json: ${action}`)
    expect(problems).toEqual([])
  })
})
