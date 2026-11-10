import { describe, expect, test } from 'vitest'
import { isKeyShaped } from './keyShape'

const enFiles = import.meta.glob('../copy/locales/en/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>
const xaFiles = import.meta.glob('../copy/locales/en-XA/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>

function fileName(path: string): string {
  return /[^/]+$/.exec(path)?.[0] ?? path
}

// Every string leaf of a locale file, as `[key path, text]`, walking nested objects.
function leaves(node: unknown, prefix: string): [string, string][] {
  if (typeof node === 'string') return [[prefix, node]]
  if (node === null || typeof node !== 'object') return []
  return Object.entries(node).flatMap(([key, child]) =>
    leaves(child, prefix === '' ? key : `${prefix}.${key}`),
  )
}

function keyShapedLeaves(tag: string, files: Record<string, unknown>): string[] {
  return Object.entries(files).flatMap(([path, content]) =>
    leaves(content, '')
      .filter(([, text]) => isKeyShaped(text))
      .map(([keyPath]) => `${tag}/${fileName(path)}: ${keyPath}`),
  )
}

describe('isKeyShaped', () => {
  test.each(['common:close', 'comon:close', 'kg:5', 'common:a.b_c.D1'])(
    '%s is key-shaped',
    (text) => {
      expect(isKeyShaped(text)).toBe(true)
    },
  )

  test.each(['common:', 'Common:close', 'http://x', '', 'common:a..b', 'common:a.', 'a b:c', 'Close'])(
    '%j is not key-shaped',
    (text) => {
      expect(isKeyShaped(text)).toBe(false)
    },
  )
})

describe('no locale value is key-shaped', () => {
  test('each tag reads more than one file', () => {
    expect(Object.keys(enFiles).length).toBeGreaterThan(1)
    expect(Object.keys(xaFiles).length).toBeGreaterThan(1)
  })

  test('en has no key-shaped value', () => {
    expect(keyShapedLeaves('en', enFiles)).toEqual([])
  })

  test('en-XA has no key-shaped value', () => {
    expect(keyShapedLeaves('en-XA', xaFiles)).toEqual([])
  })
})
