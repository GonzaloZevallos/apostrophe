/**
 * The keyed copy module (ADR-0049): every file of `web/src/copy/` says its language, and
 * `es.snapshot.json` — the frozen `{key: Spanish value}` of this move — still resolves
 * key by key, so no word changed while the texts moved here.
 */

import { describe, expect, test } from 'vitest'
import snapshot from './es.snapshot.json'

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

const sources = import.meta.glob<string>(['/src/copy/*.ts', '!/src/copy/*.test.ts'], {
  eager: true,
  query: '?raw',
  import: 'default',
})

/** The string values written as literals in more than one copy file (ADR-0049: a value has
 * one home; the others import it). Reads the source, so an alias that resolves to the same
 * text at runtime is not a second definition. */
function duplicatedValues(modules: Record<string, string>): string[] {
  const homes = new Map<string, Set<string>>()
  for (const [path, source] of Object.entries(modules)) {
    for (const match of source.matchAll(/(?<!\bkind)[:=]\s*'((?:[^'\\\n]|\\.)+)'/g)) {
      const value = match[1] ?? ''
      if (value === 'es' || value === 'en') continue
      homes.set(value, (homes.get(value) ?? new Set()).add(path))
    }
  }
  return [...homes].filter(([, paths]) => paths.size > 1).map(([value, paths]) => `${value}: ${[...paths].join(', ')}`)
}

/** Walks `parts` down `value`, trying the longest joined key first: a refusal code such
 * as `stock.threshold_invalid` is one key that holds a dot. */
function descend(value: unknown, parts: string[]): unknown {
  if (parts.length === 0) return value
  if (typeof value !== 'object' || value === null) return undefined
  const record = value as Record<string, unknown>
  for (let size = parts.length; size >= 1; size -= 1) {
    const key = parts.slice(0, size).join('.')
    if (key in record) {
      const found = descend(record[key], parts.slice(size))
      if (found !== undefined) return found
    }
  }
  return undefined
}

/** `file.EXPORT.key.path` → the string it holds, or undefined when it resolves to none. */
function resolve(modules: Record<string, CopyFile>, key: string): string | undefined {
  const [file, name, ...path] = key.split('.')
  const found = descend(modules[`/src/copy/${file}.ts`]?.[name ?? ''], path)
  return typeof found === 'string' ? found : undefined
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

  test('no value is written as a literal in two copy files', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(15)
    expect(duplicatedValues(sources)).toEqual([])
  })

  test('the check rejects a value spelled in two files and lets an alias pass', () => {
    const bad = {
      '/src/copy/a.ts': "export const A = { x: 'Guardar' }",
      '/src/copy/b.ts': "export const B = { y: 'Guardar', z: A.x }",
      '/src/copy/c.ts': "export const C = { w: 'Otra' }",
    }
    expect(duplicatedValues(bad)).toEqual(['Guardar: /src/copy/a.ts, /src/copy/b.ts'])
  })

  test('every snapshot key still resolves to its Spanish value', () => {
    const wrong = Object.entries(snapshot).filter(([key, value]) => resolve(files, key) !== value)
    expect(wrong).toEqual([])
  })

  test('resolving a key that is not there gives nothing', () => {
    expect(resolve(files, 'sales.SALES_TEXT.noSuchKey')).toBeUndefined()
    expect(resolve(files, 'nowhere.X.y')).toBeUndefined()
  })
})
