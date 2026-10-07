/**
 * Never an emoji as an interface icon (GH-97, `icon-and-text-rule.md`): every icon
 * comes from `Icono`, drawn as an `<svg>`. The one place emoji may appear is the
 * seller's own catalog text, which is data, never source. So no non-test source file
 * under `src/` contains a character that draws as an emoji, in code, copy or comment: an
 * Emoji_Presentation code point, or an Extended_Pictographic one asked for as emoji with
 * U+FE0F. Plain text symbols that Unicode also files as pictographic (the `↔` that
 * comments use for "blue ↔ amber", `©`, `™`) are prose, not icons, and pass.
 *
 * `findEmoji` is the check; the second test feeds it input it must reject. The first
 * runs it over the real tree the way `forbiddenApis.real.test.ts` does.
 */

import { expect, test } from 'vitest'

interface Source {
  path: string
  content: string
}

const EMOJI = /\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F/u

function findEmoji(files: Source[]): string[] {
  return files.filter(({ content }) => EMOJI.test(content)).map(({ path }) => path)
}

const modules = import.meta.glob(['/src/**/*.{ts,tsx,css}'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

function isTestFile(path: string): boolean {
  return /\.test\.tsx?$/.test(path) || path.includes('/architecture/')
}

test('no non-test source under src/ contains an emoji', () => {
  const files = Object.entries(modules)
    .filter(([path]) => !isTestFile(path))
    .map(([path, content]) => ({ path, content }))
  expect(files.length).toBeGreaterThan(10)
  expect(findEmoji(files)).toEqual([])
})

test('an emoji in a source file is found, a plain symbol is not', () => {
  const files = [
    { path: 'a.tsx', content: 'const icono = "🗑️"' },
    { path: 'b.tsx', content: '// ✅ hecho' },
    { path: 'c.tsx', content: 'const volver = "‹ Ventas" // flecha ✓ y …' },
    { path: 'd.tsx', content: '// blue ↔ amber' },
    { path: 'e.tsx', content: 'const a = "\u2764\uFE0F"' },
  ]
  expect(findEmoji(files)).toEqual(['a.tsx', 'b.tsx', 'e.tsx'])
})
