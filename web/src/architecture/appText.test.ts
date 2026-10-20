/** `findVisibleLiterals` on fixtures: each way a screen can write its own text is flagged,
 * and each context that shows nothing passes. */

import { describe, expect, test } from 'vitest'
import { findVisibleLiterals, isScanned } from './appText'

const fixtures = import.meta.glob('./fixtures/appText/*.txt', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

function fixture(name: string): string {
  const source = fixtures[`./fixtures/appText/${name}.txt`]
  if (source === undefined) throw new Error(`no fixture ${name}`)
  return source
}

describe('a visible literal is flagged', () => {
  test.each([
    ['flagged_variable', [{ line: 1, node: 'string' }]],
    ['flagged_ternary', [{ line: 2, node: 'string' }, { line: 2, node: 'string' }]],
    ['flagged_template', [{ line: 2, node: 'template' }, { line: 2, node: 'template' }]],
    ['flagged_helper_return', [{ line: 2, node: 'string' }]],
    ['flagged_document_title', [{ line: 2, node: 'string' }]],
    ['flagged_window_confirm', [{ line: 2, node: 'string' }]],
    ['flagged_jsx_text', [{ line: 2, node: 'jsx-text' }]],
    ['flagged_aria_label', [{ line: 2, node: 'string' }, { line: 2, node: 'string' }]],
    ['flagged_inner_element_in_prop', [{ line: 2, node: 'jsx-text' }]],
    [
      'flagged_look_alikes',
      [
        { line: 2, node: 'string' },
        { line: 5, node: 'string' },
        { line: 5, node: 'string' },
        { line: 8, node: 'string' },
        { line: 8, node: 'string' },
        { line: 8, node: 'string' },
        { line: 10, node: 'string' },
        { line: 10, node: 'jsx-text' },
        { line: 11, node: 'string' },
        { line: 11, node: 'string' },
      ],
    ],
  ])('%s', (name, expected) => {
    expect(findVisibleLiterals('fixture.tsx', fixture(name))).toEqual(expected)
  })
})

describe('what shows nothing passes', () => {
  test.each([
    'allowed_comparisons',
    'allowed_class_names',
    'allowed_props',
    'allowed_types_and_imports',
    'allowed_property_names',
    'allowed_intl_number_format',
    'allowed_formats_and_codes',
    'allowed_code_contexts',
  ])('%s', (name) => {
    expect(findVisibleLiterals('fixture.tsx', fixture(name))).toEqual([])
  })

  test('a literal with no letter is never text', () => {
    expect(findVisibleLiterals('fixture.ts', "export const A = '$ 1.000'\nexport const B = `${1}/${2}`")).toEqual([])
  })
})

describe('isScanned', () => {
  test.each([
    ['src/screens/Entrar.tsx', true],
    ['src/components/feedback.ts', true],
    ['src/api/client.ts', true],
    ['src/screens/Entrar.test.tsx', false],
    ['src/test-setup.ts', false],
    ['src/copy/auth.ts', false],
    ['src/architecture/appText.ts', false],
    ['src/test/contrast.ts', false],
    ['src/design/ae.test.ts', false],
    ['src/mobile-standard/states.ts', false],
    ['src/mobility/Walk.tsx', true],
    ['src/routes.ts', false],
    ['src/vite-env.d.ts', false],
    ['e2e/flow.spec.ts', false],
  ])('%s -> %s', (path, expected) => {
    expect(isScanned(path)).toBe(expected)
  })
})

describe('a table key is code, a label is text', () => {
  test('a `key` value is not flagged', () => {
    const source = "export const rows = [{ key: 'Shortfall', value: 1 }]\n"
    expect(findVisibleLiterals('src/screens/Rows.ts', source)).toEqual([])
  })

  test('a `label` value in the same table is flagged', () => {
    const source = "export const rows = [{ key: 'shortfall', label: 'Stock shortfall' }]\n"
    expect(findVisibleLiterals('src/screens/Rows.ts', source)).toEqual([{ line: 1, node: 'string' }])
  })
})
