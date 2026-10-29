/**
 * The language of the copy files (GH-53, ADR-0049): every file of `web/src/copy/` exports
 * `LANGUAGE`, and the app is in English, so every one of them is `'en'`. Every text of every
 * file is held to the no-Spanish-shape rule: no Spanish letter, no word of the back's frozen
 * denylist (`tests/fixtures/spanish_copy.json`), no vos imperative with its pronoun attached
 * ("descartala"). A text with holes is a function: it is read filled with a probe word.
 */

import { describe, expect, test } from 'vitest'
import denylistFile from '../../../tests/fixtures/spanish_copy.json'
import { textsOf } from '../design/copyTexts'

type CopyFile = Record<string, unknown>

const files = import.meta.glob<CopyFile>(['/src/copy/*.ts', '!/src/copy/limits.ts', '!/src/copy/baselineArgs.ts', '!/src/copy/emptyStates.ts', '!/src/copy/*.test.ts'], {
  eager: true,
})

/** The files that do not export `LANGUAGE` as 'en'. */
function languageProblems(modules: Record<string, CopyFile>): string[] {
  return Object.entries(modules)
    .filter(([, mod]) => mod.LANGUAGE !== 'en')
    .map(([path]) => `${path}: LANGUAGE is not 'en'`)
}

const SPANISH_LETTERS = /[áéíóúñ¿¡ÁÉÍÓÚÑ]/
/** A vos imperative with its pronoun attached: descartala, borralo, dejalo. */
const VOS_IMPERATIVE = /^[a-z]{3,}(?:ala|alo|ela|elo|ila|ilo)$/

const MINIMUM: number = denylistFile.min_word_length
const SHARED_IN_DENYLIST = new Set(Object.keys(denylistFile.shared_words))
const DENYLIST: ReadonlySet<string> = new Set(
  denylistFile.denylist.filter((word) => word.length >= MINIMUM && !SHARED_IN_DENYLIST.has(word)),
)

/** Why a text has a Spanish shape, or undefined when it has none. */
function spanishShape(text: string, denylist: ReadonlySet<string> = DENYLIST): string | undefined {
  if (SPANISH_LETTERS.test(text)) return 'a Spanish letter'
  for (const raw of text.match(/[^\W\d_]+/gu) ?? []) {
    const word = raw.toLowerCase()
    if (denylist.has(word)) return `the Spanish word "${word}"`
    if (VOS_IMPERATIVE.test(word)) return `the vos imperative "${word}"`
  }
  return undefined
}

const fileOf = (path: string): string => path.replace('/src/copy/', '').replace(/\.ts$/, '')

/** What is wrong with the texts of the copy files: each has a Spanish shape or not. */
function translationProblems(modules: Record<string, CopyFile>, denylist: ReadonlySet<string> = DENYLIST): string[] {
  const problems: string[] = []
  for (const [path, mod] of Object.entries(modules)) {
    for (const [key, text] of textsOf(fileOf(path), mod, 'x')) {
      const shape = spanishShape(text, denylist)
      if (shape !== undefined) problems.push(`${key}: has ${shape}`)
    }
  }
  return problems
}

describe('the copy files', () => {
  test('every file exports LANGUAGE as en', () => {
    expect(Object.keys(files).length).toBeGreaterThan(15)
    expect(languageProblems(files)).toEqual([])
  })

  test('the check rejects a file with no LANGUAGE, one marked es and one with another code', () => {
    const bad = {
      '/src/copy/a.ts': {},
      '/src/copy/b.ts': { LANGUAGE: 'fr' },
      '/src/copy/c.ts': { LANGUAGE: 'en' },
      '/src/copy/d.ts': { LANGUAGE: 'es' },
    }
    expect(languageProblems(bad)).toEqual([
      "/src/copy/a.ts: LANGUAGE is not 'en'",
      "/src/copy/b.ts: LANGUAGE is not 'en'",
      "/src/copy/d.ts: LANGUAGE is not 'en'",
    ])
  })
})

describe('the texts of the copy files', () => {
  const file = (text: CopyFile): Record<string, CopyFile> => ({ '/src/copy/a.ts': { LANGUAGE: 'en', A: text } })

  test('the real copy files hold no text with a Spanish shape', () => {
    expect(translationProblems(files)).toEqual([])
  })

  test('passes plain English', () => {
    expect(translationProblems(file({ save: 'Save', vip: 'VIP' }))).toEqual([])
  })

  test('rejects a Spanish shape: a denylisted word, an accent, a vos imperative', () => {
    const out = translationProblems(
      file({ save: 'Save', one: 'Guardar cambios', two: 'Edición', three: 'Cortala', four: () => 'Cargá x' }),
    )
    expect(out).toEqual([
      'a.A.one: has the Spanish word "guardar"',
      'a.A.two: has a Spanish letter',
      'a.A.three: has the vos imperative "cortala"',
      'a.A.four: has a Spanish letter',
    ])
  })
})
