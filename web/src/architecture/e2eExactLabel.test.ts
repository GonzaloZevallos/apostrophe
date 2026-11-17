// @vitest-environment node
/** `findInexactLabels` on small sources: what it must reject and what it must accept. */

import { describe, expect, it } from 'vitest'
import { findInexactLabels } from './e2eExactLabel'

const lines = (source: string): number[] => findInexactLabels(source).map((found) => found.line)

describe('findInexactLabels, on inputs it must reject', () => {
  it('rejects a bare string literal, naming the line and the reason', () => {
    expect(findInexactLabels("\nawait page.getByLabel('Name').fill('x')")).toEqual([
      {
        line: 2,
        reason:
          "getByLabel's first argument is not a regex literal and its second is not an object literal with `exact: true`",
      },
    ])
  })

  it('rejects exact: false', () => {
    expect(lines("await page.getByLabel('Name', { exact: false }).fill('x')")).toEqual([1])
  })

  it('rejects an identifier without options', () => {
    expect(lines('await page.getByLabel(label).fill(value)')).toEqual([1])
  })

  it('rejects exact taken from a variable', () => {
    expect(lines("await page.getByLabel('Name', { exact: strict }).fill('x')")).toEqual([1])
    expect(lines("await page.getByLabel('Name', { exact }).fill('x')")).toEqual([1])
  })

  it('rejects a spread in the options, even beside exact: true', () => {
    expect(lines("await page.getByLabel('Name', { ...options }).fill('x')")).toEqual([1])
    expect(lines("await page.getByLabel('Name', { exact: true, ...options }).fill('x')")).toEqual([1])
  })

  it('rejects options passed as a variable or a call', () => {
    expect(lines("await page.getByLabel('Name', options).fill('x')")).toEqual([1])
    expect(lines("await page.getByLabel('Name', makeOptions()).fill('x')")).toEqual([1])
  })

  it('rejects a chained locator.getByLabel and one inside or()', () => {
    expect(lines("await row.locator('div').getByLabel('Name').fill('x')")).toEqual([1])
    expect(lines("const box = page.getByRole('button', { name }).or(page.getByLabel(name)).first()")).toEqual([1])
  })

  it('rejects a last exact that is not true', () => {
    expect(lines("await page.getByLabel('Name', { exact: true, exact: false })")).toEqual([1])
  })

  it('reports each offending call on its own line, in order', () => {
    const source = ["page.getByLabel('A')", "page.getByLabel('B', { exact: true })", "page.getByLabel('C')"].join('\n')
    expect(lines(source)).toEqual([1, 3])
  })
})

describe('findInexactLabels, on inputs it must accept', () => {
  it('accepts a literal with exact: true', () => {
    expect(lines("await page.getByLabel('Name', { exact: true }).fill('x')")).toEqual([])
  })

  it('accepts a regex literal, with or without options', () => {
    expect(lines('await page.getByLabel(/^Name/).fill(x)')).toEqual([])
    expect(lines('await page.getByLabel(/name/i, { exact: false }).fill(x)')).toEqual([])
  })

  it('accepts an identifier or a template with exact: true', () => {
    expect(lines('await page.getByLabel(label, { exact: true }).fill(x)')).toEqual([])
    expect(lines('await page.getByLabel(`Price ${kind}`, { exact: true }).fill(x)')).toEqual([])
  })

  it('accepts exact: true beside other options, inside or(), and on a chained locator', () => {
    expect(lines("page.getByLabel('Name', { exact: true, includeHidden: true })")).toEqual([])
    expect(lines('page.getByRole("button", { name }).or(page.getByLabel(name, { exact: true }))')).toEqual([])
    expect(lines("row.locator('div').getByLabel('Name', { exact: true })")).toEqual([])
  })

  it('ignores calls that are not getByLabel and mentions in strings', () => {
    expect(lines("page.getByText('Name'); const note = \"getByLabel('Name')\"")).toEqual([])
  })
})
