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
const table = common.BASELINE_ARGS as Readonly<Record<string, readonly (readonly (string | number)[])[]>>

const moved: Record<string, unknown> = Object.fromEntries(common.MOVED_TO_KEYS.map((name) => [name, (common as Record<string, unknown>)[name]]))

/** Every string leaf and function of an export, by baseline source path. */
function leaves(path: string, value: unknown): [string, string | ((...args: (string | number)[]) => string)][] {
  if (typeof value === 'string' || typeof value === 'function') return [[path, value as string]]
  if (typeof value === 'object' && value !== null) return Object.entries(value).flatMap(([name, item]) => leaves(`${path}.${name}`, item))
  return []
}

describe('MOVED_TO_KEYS', () => {
  test('names the three exports that are kept for their readers', () => {
    expect([...common.MOVED_TO_KEYS]).toEqual(['COMMON_TEXT', 'SIN_CONEXION_MENSAJE', 'ERROR_GENERICO_MENSAJE'])
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
    const rows = table[path] ?? []
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      const args: Record<string, string | number> = {}
      for (const [index, name] of (mapping.params ?? []).entries()) args[name] = row[index] ?? ''
      expect(value(...row)).toBe(resolveKey(en, mapping.key, args satisfies Args))
    }
  })
})
