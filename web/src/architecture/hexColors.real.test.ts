/** `findHexColors` over the real tree: a hex color slipped into any component or stylesheet fails here. */

import { expect, test } from 'vitest'
import { findHexColors } from './hexColors'

const modules = import.meta.glob(['/src/**/*.css', '/src/**/*.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

test('no .css or .tsx under src carries a hex color, except styles/tokens.css', () => {
  const files = Object.entries(modules).map(([path, content]) => ({
    path: path.replace(/^\//, ''),
    content,
  }))
  expect(files.some(({ path }) => path === 'src/styles/tokens.css')).toBe(true)
  expect(findHexColors(files)).toEqual([])
})
