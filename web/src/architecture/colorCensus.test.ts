/** The color census reader over made-up CSS: which rules use a state color, and how the checker fails. */

import { expect, test } from 'vitest'
import { checkColorCensus, stateColorRules, type CensusEntry } from './colorCensus'

const entry = (selector: string, over: Partial<CensusEntry> = {}): CensusEntry => ({
  selector,
  component: 'Widget',
  carries: 'Owes you',
  tests: ['src/Widget.test.tsx'],
  ...over,
})
const tests = ['src/Widget.test.tsx']

test('a rule using a state color in var() is returned by its selector list', () => {
  expect(stateColorRules('.a { color: var(--deuda); }  .b { color: red; }')).toEqual(['.a'])
})

test('a grouped selector is one normalised key', () => {
  expect(stateColorRules('.a,\n  .b   > .c {\n background: var(--negativo)\n}')).toEqual(['.a, .b > .c'])
})

test('a rule nested in @media or @supports is flattened and counted', () => {
  const css = '@media (min-width: 1px) { @supports (display: grid) { .m { color: var(--positivo) } } }'
  expect(stateColorRules(css)).toEqual(['.m'])
})

test('a token in a fallback, a color-mix or a shorthand counts', () => {
  const css = [
    '.f { color: var(--x, var(--critico)); }',
    '.g { background: color-mix(in srgb, var(--serie3) 20%, transparent); }',
    '.h { border: 1px solid var(--deuda-linea); }',
    '.i { color: var(--acento-calido-texto); }',
  ].join('\n')
  expect(stateColorRules(css)).toEqual(['.f', '.g', '.h', '.i'])
})

test('a token inside a comment is not counted', () => {
  expect(stateColorRules('/* .x { color: var(--deuda) } */ .y { color: blue; /* var(--negativo) */ }')).toEqual([])
})

test('a class named like a state color is not a use of the token', () => {
  expect(stateColorRules('.boton--critico { color: blue }')).toEqual([])
})

test('the same selector in two rules is listed once', () => {
  expect(stateColorRules('.d { color: var(--deuda) } @media (x) { .d { color: var(--deuda2) } }')).toEqual(['.d'])
})

test('a listed rule with its component, carries and test passes', () => {
  expect(checkColorCensus('.a { color: var(--deuda) }', [entry('.a')], tests)).toEqual([])
})

test('an unlisted rule fails and names its selector', () => {
  expect(checkColorCensus('.a { color: var(--positivo) }', [], tests)).toEqual([
    '.a: uses a state color and is not listed in the color census',
  ])
})

test('a listed selector no rule uses any more fails', () => {
  expect(checkColorCensus('.a { color: blue }', [entry('.a')], tests)).toEqual([
    '.a: listed in the color census but no rule with that selector uses a state color',
  ])
})

test('an entry whose test is not a Testing Library test under src fails', () => {
  const bad = entry('.a', { tests: ['src/Gone.test.tsx'] })
  expect(checkColorCensus('.a { color: var(--deuda) }', [bad], tests)).toEqual([
    '.a: test src/Gone.test.tsx is not a src/**/*.test.tsx file',
  ])
})

test('an entry naming no test fails', () => {
  expect(checkColorCensus('.a { color: var(--deuda) }', [entry('.a', { tests: [] })], tests)).toEqual([
    '.a: names no test',
  ])
})

test('an entry with no component or no carries fails', () => {
  const css = '.a { color: var(--deuda) }'
  expect(checkColorCensus(css, [entry('.a', { component: ' ' })], tests)).toEqual([
    '.a: names no component',
  ])
  expect(checkColorCensus(css, [entry('.a', { carries: '' })], tests)).toEqual([
    '.a: names no word, sign, arrow or shape it carries',
  ])
})

test('decorative needs a reason, and a state color is never decorative on --positivo or --negativo', () => {
  const css = '.a { color: var(--deuda) }'
  expect(checkColorCensus(css, [entry('.a', { carries: 'decorative' })], tests)).toEqual([
    '.a: decorative needs a reason after "decorative: "',
  ])
  expect(checkColorCensus(css, [entry('.a', { carries: 'decorative: a rule line' })], tests)).toEqual([])
  expect(
    checkColorCensus('.g { color: var(--positivo) }', [entry('.g', { carries: 'decorative: nice' })], tests),
  ).toEqual(['.g: a --positivo or --negativo rule cannot be decorative'])
})

test('two entries with the same selector fail', () => {
  expect(checkColorCensus('.a { color: var(--deuda) }', [entry('.a'), entry('.a')], tests)).toEqual([
    '.a: listed twice in the color census',
  ])
})
