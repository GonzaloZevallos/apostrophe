/**
 * The deprecated copy of `common.ts` against its keys: while `COMMON_TEXT` and the two messages
 * stay, each must render what `locales/en/common.json` says (the mapping is checked against the
 * baseline by `baseline.real.test.ts`; this keeps the two live copies from drifting).
 */

import { describe, expect, test } from 'vitest'
import { loadBundle } from '../../scripts/i18n/loadBundle.ts'
import { parseMappings } from '../../scripts/i18n/baselineKeys.ts'
import { resolveKey, type Args } from '../i18n/resolve.ts'
import mappingRaw from './baselineKeys/common.json?raw'
import * as common from './common.ts'

const en = loadBundle('en')
const { mappings } = parseMappings('common.json', mappingRaw)

type Row = readonly (string | number)[]
type Text = string | ((...args: Row) => string)

/** The `BASELINE_ARGS` rows by baseline source path, kept only where they are rows of strings and numbers. */
const table = new Map<string, readonly Row[]>()
for (const [path, rows] of Object.entries(common.BASELINE_ARGS)) {
  if (!Array.isArray(rows)) continue
  table.set(path, rows.filter((row): row is Row => Array.isArray(row)))
}

const moved: Record<string, unknown> = {
  COMMON_TEXT: common.COMMON_TEXT,
  SIN_CONEXION_MENSAJE: common.SIN_CONEXION_MENSAJE,
  ERROR_GENERICO_MENSAJE: common.ERROR_GENERICO_MENSAJE,
}

/** Every string leaf and function of an export, by baseline source path. */
function leaves(path: string, value: unknown): [string, Text][] {
  if (typeof value === 'string') return [[path, value]]
  if (typeof value === 'function') return [[path, (...args: Row) => String(Reflect.apply(value, undefined, args))]]
  if (typeof value === 'object' && value !== null) return Object.entries(value).flatMap(([name, item]) => leaves(`${path}.${name}`, item))
  return []
}

describe('MOVED_TO_KEYS', () => {
  test('names the three exports that are kept for their readers', () => {
    expect([...common.MOVED_TO_KEYS]).toEqual(Object.getOwnPropertyNames(moved))
  })

  test('every moved leaf is mapped, and every mapping points at a moved leaf', () => {
    const found = Object.entries(moved).flatMap(([name, value]) => leaves(name, value).map(([path]) => `common.ts:${path}`))

    expect(Object.keys(mappings).sort()).toEqual(found.sort())
  })

  test.each(Object.entries(moved).flatMap(([name, value]) => leaves(name, value)))('%s renders what its key renders', (path, value) => {
    const mapping = mappings[`common.ts:${path}`]
    if (mapping === undefined) throw new Error(`${path}: not mapped`)
    if (typeof value === 'string') {
      // A fragment is checked through its fill; a plain text through the key alone.
      expect(value).toBe(resolveKey(en, mapping.key, mapping.fill))
      return
    }
    const rows = table.get(path) ?? []
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      const args: Record<string, string | number> = {}
      for (const [index, name] of (mapping.params ?? []).entries()) args[name] = row[index] ?? ''
      expect(value(...row)).toBe(resolveKey(en, mapping.key, args satisfies Args))
    }
  })
})
