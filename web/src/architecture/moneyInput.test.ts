/**
 * Every money input field takes its keyboard from `moneyInputMode` and its prefill from
 * `formatMoneyInput` (plan, invariant 7): a literal money `inputMode`, or a `String()`/`toString`
 * of an amount, in a screen or a component is a violation. Reads the source of `screens/` and
 * `components/`, and checks the rule itself on text it must reject.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'

const MONEY_WORD = /amount|price|cost|shipping|monto|money|balance/i

/** The violations in one source: a literal `inputMode` on a money input, a text prefill made by
 * `String()` or `toString()` of an amount. */
export function moneyInputViolations(source: string): string[] {
  const found: string[] = []
  for (const tag of source.match(/<(?:input|MoneyInput)\b[^>]*?\/>|<(?:input|MoneyInput)\b[\s\S]*?\n\s*\/>/g) ?? []) {
    if (/inputMode=(?:["']|\{["'])/.test(tag) && MONEY_WORD.test(/value=\{([^}]*)\}/.exec(tag)?.[1] ?? '')) found.push(`literal money inputMode: ${tag.split('\n')[0] ?? ''}`)
  }
  for (const line of source.split('\n')) {
    if (/String\([^)]*(?:amount|price|cost|shipping|balance)|(?:amount|price|cost|shipping|balance)\w*(?:\.\w+)*\.toString\(/i.test(line)) {
      found.push(`money prefill by String/toString: ${line.trim()}`)
    }
  }
  return found
}

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sources(path)
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}

describe('the money input rule', () => {
  test('rejects a literal inputMode on an amount field', () => {
    const bad = '<input\n  value={form.amount}\n  inputMode="numeric"\n/>'
    expect(moneyInputViolations(bad)).toEqual(['literal money inputMode: <input'])
  })

  test('rejects String() and toString() as a money prefill', () => {
    expect(moneyInputViolations('const a = String(target.amount)')).toEqual([
      'money prefill by String/toString: const a = String(target.amount)',
    ])
    expect(moneyInputViolations('const a = initial.total_cost.toString()')).toHaveLength(1)
    expect(moneyInputViolations('const a = price.toString()')).toEqual([
      'money prefill by String/toString: const a = price.toString()',
    ])
  })

  test('accepts a percentage field with a numeric keyboard and ids written with String()', () => {
    const fine = '<input\n  value={typed.indica}\n  inputMode="numeric"\n/>\nconst id = String(category.id)'
    expect(moneyInputViolations(fine)).toEqual([])
  })

  test.each(['src/screens', 'src/components'])('%s has no literal money inputMode and no String() money prefill', (dir) => {
    const violations = sources(dir).flatMap((file) =>
      moneyInputViolations(readFileSync(file, 'utf8')).map((violation) => `${file}: ${violation}`),
    )
    expect(violations).toEqual([])
  })
})
