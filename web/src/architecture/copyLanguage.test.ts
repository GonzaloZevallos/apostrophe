/**
 * The language of the copy files (GH-53, ADR-0049): every file of `web/src/copy/` says which
 * language it is written in, `'es'` or `'en'`. The move marks all of them `'es'`; the
 * translation flips them one by one.
 */

import { describe, expect, test } from 'vitest'

type CopyFile = Record<string, unknown>

const files = import.meta.glob<CopyFile>(['/src/copy/*.ts', '!/src/copy/limits.ts', '!/src/copy/*.test.ts'], {
  eager: true,
})

/** The files that do not export `LANGUAGE` as 'es' or 'en'. */
function languageProblems(modules: Record<string, CopyFile>): string[] {
  return Object.entries(modules)
    .filter(([, mod]) => mod.LANGUAGE !== 'es' && mod.LANGUAGE !== 'en')
    .map(([path]) => `${path}: LANGUAGE is not 'es' or 'en'`)
}

describe('the copy files', () => {
  test('each exports LANGUAGE', () => {
    expect(Object.keys(files).length).toBeGreaterThan(15)
    expect(languageProblems(files)).toEqual([])
  })

  test('the check rejects a file with no LANGUAGE and one with another code', () => {
    const bad = { '/src/copy/a.ts': {}, '/src/copy/b.ts': { LANGUAGE: 'fr' }, '/src/copy/c.ts': { LANGUAGE: 'en' } }
    expect(languageProblems(bad)).toEqual([
      "/src/copy/a.ts: LANGUAGE is not 'es' or 'en'",
      "/src/copy/b.ts: LANGUAGE is not 'es' or 'en'",
    ])
  })
})
