/**
 * The language of the copy files (GH-53, ADR-0049): every file of `web/src/copy/` says which
 * language it is written in, `'es'` or `'en'`. The move marked all of them `'es'`; the
 * translation flips them one by one, and a file marked `'en'` is held to the two rules of
 * `translationProblems`:
 *
 * - a key `es.snapshot.json` has must hold another text than its Spanish one, unless the key
 *   is in `copy/shared_words.json` (shrink-only: a word that is the same in both languages,
 *   with its reason; an entry that no longer holds the snapshot's text fails as stale);
 * - any text of the file, snapshot key or not, has no Spanish shape: no Spanish letter, no
 *   word of the back's frozen denylist (`tests/fixtures/spanish_copy.json`), no vos
 *   imperative with its pronoun attached ("descartala").
 *
 * A text with holes is a function: it is read filled with a probe word.
 */

import { describe, expect, test } from 'vitest'
import denylistFile from '../../../tests/fixtures/spanish_copy.json'
import snapshot from '../copy/es.snapshot.json'
import sharedWordsFile from '../copy/shared_words.json'
import { textsOf } from '../design/copyTexts'

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

/** What is wrong with the files marked 'en'. `shared` is `{key: reason}`. */
function translationProblems(
  modules: Record<string, CopyFile>,
  spanish: Record<string, string>,
  shared: Record<string, string>,
  denylist: ReadonlySet<string> = DENYLIST,
): string[] {
  const problems: string[] = []
  const english = Object.entries(modules).filter(([, mod]) => mod.LANGUAGE === 'en')
  const held = new Map<string, string>()
  for (const [path, mod] of english) {
    for (const [key, text] of textsOf(fileOf(path), mod, 'x')) {
      held.set(key, text)
      const original = spanish[key]
      if (original !== undefined && text === original && !(key in shared)) {
        problems.push(`${key}: still holds its Spanish text`)
      }
      const shape = spanishShape(text, denylist)
      if (shape !== undefined) problems.push(`${key}: has ${shape}`)
    }
  }
  for (const [key, reason] of Object.entries(shared)) {
    if (!(key in spanish)) problems.push(`${key}: shared_words names a key the snapshot does not have`)
    else if (reason.trim() === '') problems.push(`${key}: shared_words has no reason`)
    else if (held.has(key) && held.get(key) !== spanish[key]) problems.push(`${key}: shared_words entry is stale`)
  }
  return problems
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

describe('a file marked en', () => {
  const spanish = { 'a.A.save': 'Guardar', 'a.A.vip': 'VIP' }
  const file = (text: CopyFile): Record<string, CopyFile> => ({ '/src/copy/a.ts': { LANGUAGE: 'en', A: text } })

  test('the real copy files hold no Spanish text and no unexplained shared one', () => {
    expect(Object.values(files).some((mod) => mod.LANGUAGE === 'en')).toBe(true)
    expect(translationProblems(files, snapshot, sharedWordsFile)).toEqual([])
  })

  test('passes when every snapshot key changed and a shared word is listed', () => {
    expect(translationProblems(file({ save: 'Save', vip: 'VIP' }), { 'a.A.save': 'Guardar', 'a.A.vip': 'VIP' }, { 'a.A.vip': 'same word' })).toEqual([])
  })

  test('rejects a snapshot key left unchanged and not listed as shared', () => {
    expect(translationProblems(file({ save: 'Guardar', vip: 'VIP' }), spanish, { 'a.A.vip': 'same word' })).toEqual([
      'a.A.save: still holds its Spanish text',
      'a.A.save: has the Spanish word "guardar"',
    ])
    expect(translationProblems(file({ save: 'Save', vip: 'VIP' }), spanish, {})).toEqual([
      'a.A.vip: still holds its Spanish text',
    ])
  })

  test('rejects a new key with a Spanish shape: a denylisted phrase, an accent, a vos imperative', () => {
    const out = translationProblems(
      file({ save: 'Save', vip: 'VIP', one: 'Guardar cambios', two: 'Edición', three: 'Cortala', four: () => 'Cargá x' }),
      spanish,
      { 'a.A.vip': 'same word' },
    )
    expect(out).toEqual([
      'a.A.one: has the Spanish word "guardar"',
      'a.A.two: has a Spanish letter',
      'a.A.three: has the vos imperative "cortala"',
      'a.A.four: has a Spanish letter',
    ])
  })

  test('rejects a shared entry with no reason, a key the snapshot lacks, and a stale one', () => {
    const out = translationProblems(file({ save: 'Save', vip: 'Special' }), spanish, {
      'a.A.vip': 'same word',
      'a.A.nowhere': 'x',
    })
    expect(out).toEqual([
      'a.A.vip: shared_words entry is stale',
      'a.A.nowhere: shared_words names a key the snapshot does not have',
    ])
    expect(translationProblems(file({ save: 'Save' }), spanish, { 'a.A.vip': ' ' })).toEqual([
      'a.A.vip: shared_words has no reason',
    ])
  })

  test('leaves a file still marked es alone', () => {
    const es = { '/src/copy/a.ts': { LANGUAGE: 'es', A: { save: 'Guardar' } } }
    expect(translationProblems(es, spanish, {})).toEqual([])
  })
})
