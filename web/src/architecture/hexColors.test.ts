import { expect, test } from 'vitest'
import { findHexColors } from './hexColors'

test('a literal hex color in a css or tsx outside tokens.css is refused', () => {
  const violations = findHexColors([
    { path: 'src/styles/app.css', content: '.a { color: #7A4A00; }' },
    { path: 'src/screens/Entrar.tsx', content: "const c = { background: '#fff' }" },
  ])
  expect(violations).toEqual([
    'src/styles/app.css: literal hex color #7A4A00, use a token',
    'src/screens/Entrar.tsx: literal hex color #fff, use a token',
  ])
})

test('tokens.css, a token reference and a non-style file are accepted', () => {
  expect(
    findHexColors([
      { path: 'src/styles/tokens.css', content: ':root { --papel: #FCFBF8; }' },
      { path: 'src/styles/app.css', content: '.a { color: var(--papel); }' },
      { path: 'src/screens/Entrar.tsx', content: '<a href="#main">saltar</a>' },
      { path: 'src/format/colors.ts', content: "const c = '#7A4A00'" },
    ]),
  ).toEqual([])
})
