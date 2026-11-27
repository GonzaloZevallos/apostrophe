/**
 * `SearchField`'s rules as `app.css` declares them, read as raw text by selector (the
 * Mobile check and the contrast check cannot see it: nothing renders the field yet).
 */

import { describe, expect, test } from 'vitest'
import css from '../styles/app.css?raw'

const STRIPPED = css.replace(/\/\*[\s\S]*?\*\//g, '')

/** Every declaration body written for exactly `selector`, in any order and any rule list, joined. */
export function bodiesOf(source: string, selector: string): string {
  const bodies: string[] = []
  for (const rule of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = (rule[1] ?? '').split(',').map((part) => part.trim())
    if (selectors.includes(selector)) bodies.push(rule[2] ?? '')
  }
  return bodies.join('\n')
}

/** What the four `.search-field*` rules fail to say, as a list of problems. */
export function fieldProblems(source: string): string[] {
  const problems: string[] = []
  const expectIn = (selector: string, pattern: RegExp, what: string) => {
    if (!pattern.test(bodiesOf(source, selector))) problems.push(`${selector}: ${what}`)
  }
  const root = bodiesOf(source, '.search-field')
  if (root === '') problems.push('.search-field: no rule')
  if (/(^|[\s;{-])border(-[a-z-]+)?\s*:/.test(root)) problems.push('.search-field: carries a border')
  expectIn('.search-field', /position:\s*relative/, 'is not position: relative')

  const input = '.search-field__input'
  expectIn(input, /box-sizing:\s*border-box/, 'is not border-box')
  expectIn(input, /(^|[\s;])height:\s*var\(--alto-tocable\)/, 'height is not var(--alto-tocable)')
  expectIn(input, /(^|[\s;])border:\s*1px solid var\(--linea\)/, 'has no 1px --linea border')
  expectIn(input, /border-radius:\s*var\(--radio-campo\)/, 'has no --radio-campo radius')
  expectIn(input, /background:\s*var\(--superficie\)/, 'has no --superficie background')
  expectIn(input, /color:\s*var\(--tinta\)/, 'text is not --tinta')
  expectIn(input, /font-size:\s*16px/, 'text is not 16px')
  expectIn(input, /padding-right:\s*var\(--alto-tocable\)/, 'padding-right is not Clear\'s width')
  expectIn(input, /(^|[\s;])appearance:\s*none/, 'has no appearance: none')

  expectIn(`${input}::placeholder`, /color:\s*var\(--tinta2\)/, 'placeholder is not --tinta2')
  expectIn(`${input}::placeholder`, /opacity:\s*1(?![\d.])/, 'placeholder opacity is not 1')
  expectIn(`${input}::placeholder`, /font-size:\s*16px/, 'placeholder is not 16px')
  expectIn(`${input}::-webkit-search-cancel-button`, /appearance:\s*none/, 'native cancel button is not hidden')
  expectIn(`${input}::-webkit-search-decoration`, /appearance:\s*none/, 'native decoration is not hidden')

  expectIn('.search-field__icon', /pointer-events:\s*none/, 'icon takes pointer events')

  const clear = '.search-field__clear'
  expectIn(clear, /(^|[\s;])width:\s*var\(--alto-tocable\)/, 'width is not 44px')
  expectIn(clear, /min-width:\s*var\(--alto-tocable\)/, 'min-width is not 44px')
  expectIn(clear, /(^|[\s;])top:\s*0/, 'is not pinned to the top')
  expectIn(clear, /(^|[\s;])bottom:\s*0/, 'is not pinned to the bottom (44px tall)')
  expectIn(clear, /(^|[\s;])right:\s*0/, 'is not over the input\'s right edge')
  expectIn(clear, /border-radius:\s*0 var\(--radio-campo\) var\(--radio-campo\) 0/, 'has not the input\'s right-hand radius')
  expectIn(clear, /(^|[\s;])user-select:\s*none/, 'has no user-select: none')
  expectIn(clear, /touch-action:\s*manipulation/, 'has no touch-action: manipulation')
  expectIn(clear, /-webkit-tap-highlight-color:\s*transparent/, 'has a tap highlight')
  if (bodiesOf(source, `${clear}:active`) !== '') problems.push(`${clear}: has its own :active rule`)

  const all = ['.search-field', input, `${input}::placeholder`, '.search-field__icon', clear]
    .map((selector) => bodiesOf(source, selector))
    .join('\n')
  if (/#[0-9a-fA-F]{3,8}\b/.test(all)) problems.push('a hex colour in the search-field rules')
  return problems
}

describe('SearchField CSS', () => {
  test('the shipped stylesheet declares the field as planned', () => {
    expect(fieldProblems(STRIPPED)).toEqual([])
  })

  test('refuses a field with a border on the wrapper, a 15px input and a native cancel button', () => {
    const bad = `
      .search-field { position: relative; border: 1px solid var(--linea); }
      .search-field__input { box-sizing: border-box; height: 40px; font-size: 15px; }
      .search-field__clear { width: 30px; }
      .search-field__clear:active { background: #ccc; }
    `
    const problems = fieldProblems(bad)
    expect(problems).toContain('.search-field: carries a border')
    expect(problems).toContain('.search-field__input: text is not 16px')
    expect(problems).toContain('.search-field__input: height is not var(--alto-tocable)')
    expect(problems).toContain('.search-field__input::-webkit-search-cancel-button: native cancel button is not hidden')
    expect(problems).toContain('.search-field__clear: width is not 44px')
    expect(problems).toContain('.search-field__clear: has its own :active rule')
  })

  test('finds a declaration in a selector list and out of order', () => {
    const source = `.a, .search-field__clear { top: 0 } .b { color: red } .search-field__clear { right: 0 }`
    expect(bodiesOf(source, '.search-field__clear')).toMatch(/top: 0[\s\S]*right: 0/)
  })
})
