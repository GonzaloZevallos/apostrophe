/** The locale ban: each banned call is found in a fixture, the real tree has none. */

import { expect, test } from 'vitest'
import { findLocaleCalls } from './localeBan'

test.each([
  'day.toLocaleDateString("es-AR")',
  'n.toLocaleString()',
  'x.toLocaleTimeString()',
  'new Intl.DateTimeFormat("en")',
  'new Intl.RelativeTimeFormat("en")',
  'Intl . DateTimeFormat',
])('%s is a locale call', (source) => {
  expect(findLocaleCalls(source)).toEqual([1])
})

test('reports the line, and ignores a comment and Intl.NumberFormat', () => {
  const source = '// toLocaleString is banned\n/* Intl.DateTimeFormat */\nconst a = new Intl.NumberFormat("en-US")\nconst b = d.toLocaleDateString()'
  expect(findLocaleCalls(source)).toEqual([4])
})

const sources = import.meta.glob(['/src/**/*.ts', '/src/**/*.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

test('no non-test file under web/src calls toLocale*, Intl.DateTimeFormat or Intl.RelativeTimeFormat', () => {
  const files = Object.entries(sources)
    .map(([path, source]) => ({ path: path.replace(/^\//, ''), source }))
    .filter(({ path }) => /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path) && !/^src\/test-[\w-]+\.ts$/.test(path))
  expect(files.length).toBeGreaterThan(100)
  const found = files.filter(({ source }) => findLocaleCalls(source).length > 0).map(({ path }) => path)
  expect(found).toEqual([])
})
