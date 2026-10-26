/**
 * The keyed copy-limit check over the real folders: every module of `src/copy/` that exports
 * `NAMESPACE` is checked against every real language folder on disk. The counts expected come
 * from `readdirSync` listings (the module files read as text, the locale folders), never from
 * the glob or loader under test; a folder with nothing keyed yet counts zero on both sides.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { copyProblems, type CopyModule } from '../../src/copy/limits.ts'
import { loadBundle, LOCALES_ROOT } from './loadBundle.ts'

const COPY = join(import.meta.dirname, '../../src/copy')

const found = import.meta.glob<CopyModule>(
  ['../../src/copy/*.ts', '!../../src/copy/limits.ts', '!../../src/copy/emptyStates.ts', '!../../src/copy/baselineArgs.ts', '!../../src/copy/*.test.ts'],
  { eager: true },
)

describe('the keyed copy modules and the real language folders', () => {
  const tags = existsSync(LOCALES_ROOT) ? readdirSync(LOCALES_ROOT, { withFileTypes: true }).filter((item) => item.isDirectory()).map((item) => item.name) : []
  const locales = Object.fromEntries(tags.map((tag) => [tag, loadBundle(tag)]))

  test('every language folder on disk is loaded', () => {
    expect(Object.keys(locales).sort()).toEqual([...tags].sort())
  })

  test('every module that exports NAMESPACE is checked, with no problem', () => {
    const keyed = Object.entries(found).filter(([, mod]) => typeof mod.NAMESPACE === 'string')
    const listed = readdirSync(COPY).filter(
      (name) => name.endsWith('.ts') && !name.endsWith('.test.ts') && /^export const NAMESPACE\b/m.test(readFileSync(join(COPY, name), 'utf8')),
    )

    expect(keyed).toHaveLength(listed.length)
    expect(keyed.flatMap(([path, mod]) => copyProblems(path, mod, locales))).toEqual([])
  })
})
