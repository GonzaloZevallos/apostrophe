/**
 * The keyed copy module (ADR-0049): `es.snapshot.json` — the frozen `{key: Spanish value}`
 * of this move — still resolves key by key, so no word changed while the texts moved here.
 * The language of each file and the one home of each value are checked under `architecture/`.
 */

import { describe, expect, test } from 'vitest'
import snapshot from './es.snapshot.json'

type CopyFile = Record<string, unknown>

const files = import.meta.glob<CopyFile>(['/src/copy/*.ts', '!/src/copy/limits.ts', '!/src/copy/*.test.ts'], {
  eager: true,
})

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
  test('every snapshot key still resolves to its Spanish value', () => {
    const wrong = Object.entries(snapshot).filter(([key, value]) => resolve(files, key) !== value)
    expect(wrong).toEqual([])
  })

  test('resolving a key that is not there gives nothing', () => {
    expect(resolve(files, 'sales.SALES_TEXT.noSuchKey')).toBeUndefined()
    expect(resolve(files, 'nowhere.X.y')).toBeUndefined()
  })
})
