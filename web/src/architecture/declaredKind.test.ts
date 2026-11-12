/**
 * A screen's declared kind has one reader: `kindOf(screen, viewport)` in `routes.ts`. Gastos is a
 * card on the phone and a root on a computer, so a file that reads `declaredKind` itself would
 * answer for one viewport only. Writing the field in a `screen({ ... })` declaration is allowed
 * (a test builds screens that way); reading it, by property access or by destructuring, is not.
 * `routes.ts` is the scan's only exemption.
 *
 * The finder walks the sources it is handed, so a fixture that must fail is tested beside the
 * real tree.
 */

import { expect, test } from 'vitest'

interface Source {
  path: string
  content: string
}

const OWNER = 'src/routes.ts'

const READS: readonly { name: string; pattern: RegExp }[] = [
  { name: 'property access', pattern: /(?:\.|\?\.|\[['"])declaredKind\b/ },
  { name: 'destructuring', pattern: /\{[^{}]*\bdeclaredKind\b[^{}]*\}\s*=[^=>]/ },
]

function stripComments(content: string): string {
  return content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

/** `path: how` for each file other than `routes.ts` that reads a screen's `declaredKind`. */
function findReaders(files: readonly Source[]): string[] {
  const found: string[] = []
  for (const { path, content } of files) {
    if (path === OWNER) continue
    const code = stripComments(content)
    for (const { name, pattern } of READS) {
      if (pattern.test(code)) found.push(`${path}: ${name}`)
    }
  }
  return found
}

test('no file but routes.ts reads a screen\'s declaredKind: every reader calls kindOf', () => {
  const modules = import.meta.glob<string>('/src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true })
  const files = Object.entries(modules).map(([path, content]) => ({ path: path.replace(/^\//, ''), content }))

  expect(files.some(({ path }) => path === OWNER)).toBe(true)
  expect(findReaders(files)).toEqual([])
})

test('the finder refuses a read by property access or destructuring, and lets a declaration through', () => {
  expect(
    findReaders([
      { path: 'src/shell/a.ts', content: "const bar = entry.declaredKind !== 'form'" },
      { path: 'src/shell/b.ts', content: 'const { declaredKind } = entry' },
      { path: 'src/shell/c.ts', content: "const kind = entry?.declaredKind" },
      { path: 'src/shell/d.test.ts', content: "declare({ id: 'sale', path: '/x', declaredKind: 'card' })" },
      { path: 'src/shell/e.ts', content: '// entry.declaredKind is read in routes.ts only' },
      { path: 'src/routes.ts', content: 'return entry.declaredKind' },
    ]),
  ).toEqual(['src/shell/a.ts: property access', 'src/shell/b.ts: destructuring', 'src/shell/c.ts: property access'])
})
