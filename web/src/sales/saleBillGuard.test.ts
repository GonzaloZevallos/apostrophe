/**
 * The guard behind the plan's "no sale bill module holds a `g` literal or calls
 * `formatGrams`": the unit is read from the one keyed copy entry. It reads every
 * production `saleBill*` source and every `SaleBill*` screen source.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { describe, expect, test } from 'vitest'

const SRC = resolve(__dirname, '..')

/** The violations of the sources it is given, by file name. */
function violations(sources: Readonly<Record<string, string>>): string[] {
  const found: string[] = []
  for (const [file, code] of Object.entries(sources)) {
    if (/(['"`])g\1/.test(code)) found.push(`${file} holds a "g" literal`)
    if (/\bformatGrams\b/.test(code)) found.push(`${file} uses formatGrams`)
  }
  return found
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  )
}

function saleBillSources(): Record<string, string> {
  const files = walk(SRC).filter((path) => {
    const name = basename(path)
    const production = /\.tsx?$/.test(name) && !/\.test\./.test(name)
    const inSales = path.startsWith(join(SRC, 'sales')) && /^saleBill/.test(name)
    const inScreens = path.startsWith(join(SRC, 'screens')) && /^SaleBill/.test(name)
    return production && (inSales || inScreens)
  })
  return Object.fromEntries(files.map((path) => [path.slice(SRC.length + 1), readFileSync(path, 'utf8')]))
}

describe('the sale bill sources', () => {
  test('there is at least the renderer to read', () => {
    expect(Object.keys(saleBillSources())).toContain('sales/saleBill.ts')
  })

  test('none holds a "g" literal or calls formatGrams', () => {
    expect(violations(saleBillSources())).toEqual([])
  })

  test('the guard rejects a "g" literal in any quote and a formatGrams call', () => {
    expect(violations({ 'a.ts': "const unit = 'g'" })).toEqual(['a.ts holds a "g" literal'])
    expect(violations({ 'b.ts': 'const unit = "g"' })).toEqual(['b.ts holds a "g" literal'])
    expect(violations({ 'c.ts': 'const unit = `g`' })).toEqual(['c.ts holds a "g" literal'])
    expect(violations({ 'd.ts': 'formatGrams(3.5)' })).toEqual(['d.ts uses formatGrams'])
  })

  test('the guard accepts a word that only contains a g', () => {
    expect(violations({ 'e.ts': "const word = 'gift'; const key = 'grams'" })).toEqual([])
  })
})
