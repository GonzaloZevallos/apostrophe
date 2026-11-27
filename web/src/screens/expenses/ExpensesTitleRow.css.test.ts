/**
 * Expenses' title row, as `app.css` declares it (plan, GH-1053 part 5, invariant 5): the row is a
 * size container with a name, and exactly two `@container` rules use that name, each on a
 * `max-width` in `em`. No other selector repeats the name. The thresholds' values are not pinned:
 * only they may move after the e2e run; their number and order may not.
 */

import { expect, test } from 'vitest'
import css from '../../styles/app.css?raw'

const ROW = '.gastos__fila-titulo'

/** The `{ … }` body that follows `selector {` (the first rule declared for it). */
function ruleOf(source: string, selector: string): string {
  const start = source.indexOf(`${selector} {`)
  if (start < 0) return ''
  return source.slice(start, source.indexOf('}', start))
}

/** What the row's own block and the stylesheet say about the container, as a list of problems. */
export function containerProblems(source: string): string[] {
  const problems: string[] = []
  const row = ruleOf(source, ROW)
  if (!/container-type:\s*inline-size/.test(row)) problems.push('the row does not declare container-type: inline-size')
  const name = /container-name:\s*([\w-]+)/.exec(row)?.[1]
  if (name === undefined) {
    problems.push('the row does not declare a container-name')
    return problems
  }
  const rules = [...source.matchAll(/@container\s+([\w-]+)\s*\(([^)]*)\)/g)].filter((found) => found[1] === name)
  if (rules.length !== 2) problems.push(`${rules.length} @container rules use ${name}, expected exactly 2`)
  for (const rule of rules) {
    if (!/^max-width:\s*[\d.]+em$/.test((rule[2] ?? '').trim())) problems.push(`@container ${name} (${rule[2]}) is not a max-width in em`)
  }
  const word = new RegExp(`(?<![\\w-])${name}(?![\\w-])`)
  const named = source.split('\n').filter((line) => word.test(line) && !/container-name:|@container/.test(line))
  if (named.length > 0) problems.push(`another selector repeats ${name}: ${named.join(' | ')}`)
  const widths = rules.map((rule) => parseFloat(/[\d.]+/.exec(rule[2] ?? '')?.[0] ?? 'NaN'))
  if (widths.length === 2 && !(widths[0] !== undefined && widths[1] !== undefined && widths[0] > widths[1])) {
    problems.push('the pill step must come first and be wider than the back step')
  }
  return problems
}

test('the stylesheet declares the row as a named inline-size container with exactly two em thresholds', () => {
  expect(containerProblems(css)).toEqual([])
})

test('rejects a row with no container, a third rule, a px threshold and a repeated name', () => {
  const bare = `${ROW} {\n  display: flex;\n}\n`
  expect(containerProblems(bare)).toEqual([
    'the row does not declare container-type: inline-size',
    'the row does not declare a container-name',
  ])

  const base = `${ROW} {\n  container-type: inline-size;\n  container-name: fila;\n}\n`
  const three = `${base}@container fila (max-width: 24em) {}\n@container fila (max-width: 19em) {}\n@container fila (max-width: 10em) {}\n`
  expect(containerProblems(three)).toEqual(['3 @container rules use fila, expected exactly 2'])

  const px = `${base}@container fila (max-width: 384px) {}\n@container fila (max-width: 19em) {}\n`
  expect(containerProblems(px)).toEqual(['@container fila (max-width: 384px) is not a max-width in em'])

  const repeated = `${base}@container fila (max-width: 24em) {}\n@container fila (max-width: 19em) {}\n  .x { container: fila }\n`
  expect(containerProblems(repeated)).toEqual(['another selector repeats fila:   .x { container: fila }'])
})
