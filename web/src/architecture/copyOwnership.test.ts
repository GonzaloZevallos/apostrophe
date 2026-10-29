/**
 * One home per value (GH-53, ADR-0049, invariant 2): a string written as a literal in one
 * file of `web/src/copy/` is not written again in another; the second imports it. A value
 * two areas share lives in `common`.
 */

import { describe, expect, test } from 'vitest'

const sources = import.meta.glob<string>(['/src/copy/*.ts', '!/src/copy/baselineArgs.ts', '!/src/copy/*.test.ts'], {
  eager: true,
  query: '?raw',
  import: 'default',
})

/** The string values written as literals in more than one copy file. Reads the source, so an
 * alias that resolves to the same text at runtime is not a second definition. */
function duplicatedValues(modules: Record<string, string>): string[] {
  const homes = new Map<string, Set<string>>()
  for (const [path, source] of Object.entries(modules)) {
    const literals = [
      ...source.matchAll(/(?<!\bkind)[:=]\s*'((?:[^'\\\n]|\\.)+)'/g),
      ...source.matchAll(/(?:=>|[:=])\s*`([^`]+)`/g),
    ]
    for (const match of literals) {
      // A template is compared by its words: `${a}` and `${b}` are the same hole.
      const value = (match[1] ?? '').replace(/\$\{[^}]*\}/g, '${}')
      if (value === 'es' || value === 'en') continue
      homes.set(value, (homes.get(value) ?? new Set()).add(path))
    }
  }
  return [...homes].filter(([, paths]) => paths.size > 1).map(([value, paths]) => `${value}: ${[...paths].join(', ')}`)
}

describe('the copy files', () => {
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

  test('the check rejects a template spelled in two files, whatever its hole is called', () => {
    const bad = {
      '/src/copy/a.ts': 'export const A = { x: (grams: string) => `Avisame abajo de ${grams}` }',
      '/src/copy/b.ts': 'export const B = { y: (threshold: number) => `Avisame abajo de ${threshold}` }',
    }
    expect(duplicatedValues(bad)).toEqual(['Avisame abajo de ${}: /src/copy/a.ts, /src/copy/b.ts'])
  })
})
