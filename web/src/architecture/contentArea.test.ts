/**
 * Every content element of the app is a `ContentArea` (CODING_STANDARDS §10 item 7): no source in
 * `web/src`, test hosts included, renders an intrinsic `<main>` of its own. The content area is the
 * element `components/ContentArea.tsx` names with the one selector in `mobile-standard/contentArea.ts`
 * and marks busy; a bare `<main>` would be a screen the phone probe and the loading count cannot see.
 * `ContentArea.tsx` is the scan's only exemption.
 *
 * The finder walks the sources it is handed, so a fixture that must fail is tested beside the real
 * tree. It reads each source as TSX, so a `<main` in a comment or a `'main'` string is not a hit.
 */

import ts from 'typescript'
import { expect, test } from 'vitest'

interface Source {
  path: string
  content: string
}

const OWNER = 'src/components/ContentArea.tsx'

/** `path:line` for each intrinsic `<main>` element in the tsx sources other than the owner. */
function findRawMain(files: readonly Source[]): string[] {
  const found: string[] = []
  for (const { path, content } of files) {
    if (path === OWNER || !path.endsWith('.tsx')) continue
    const file = ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    function visit(node: ts.Node): void {
      if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && ts.isIdentifier(node.tagName)) {
        if (node.tagName.text === 'main') {
          found.push(`${path}:${file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1}`)
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(file)
  }
  return found
}

test('a raw <main> is flagged with its line, opening or self-closing, test hosts included', () => {
  expect(
    findRawMain([
      { path: 'src/screens/A.tsx', content: 'export const A = () => (\n  <main className="pantalla">x</main>\n)' },
      { path: 'src/screens/B.tsx', content: 'export const B = () => <main />' },
      { path: 'src/screens/C.test.tsx', content: 'const host = <main>{children}</main>' },
    ]),
  ).toEqual(['src/screens/A.tsx:2', 'src/screens/B.tsx:1', 'src/screens/C.test.tsx:1'])
})

test('a comment, a string, a ContentArea and the owner itself are left alone', () => {
  expect(
    findRawMain([
      { path: 'src/screens/D.tsx', content: '// the page\'s <main> is drawn below\nexport const D = () => <ContentArea as="main" />' },
      { path: 'src/screens/E.tsx', content: "/* <main> */ export const tag = 'main'; export const html = '<main>'" },
      { path: 'src/components/ContentArea.tsx', content: 'export const A = () => <main />' },
      { path: 'src/other/ContentArea.tsx', content: 'export const A = () => <main />' },
    ]),
  ).toEqual(['src/other/ContentArea.tsx:1'])
})

test('every <main> in web/src is rendered by ContentArea', () => {
  const modules = import.meta.glob<string>('/src/**/*.tsx', { query: '?raw', import: 'default', eager: true })
  const files = Object.entries(modules).map(([path, content]) => ({ path: path.replace(/^\//, ''), content }))

  expect(files.length).toBeGreaterThan(50)
  expect(files.some(({ path }) => path === OWNER)).toBe(true)
  // The scan reads real content: a known screen is in the set and turns up once it holds a bare main.
  const inicio = files.find(({ path }) => path === 'src/screens/Inicio.tsx')
  expect(inicio?.content).toContain('ContentArea')
  expect(findRawMain([{ path: 'src/screens/Inicio.tsx', content: `${inicio?.content ?? ''}\nconst x = <main />` }])).toHaveLength(1)
  expect(findRawMain(files)).toEqual([])
})
