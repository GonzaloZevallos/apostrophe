/**
 * The page's scroll has one owner (navigation.md, "Scroll on a change of screen"; ADR-0069):
 * `shell/ScrollSync.tsx` is the only non-test source in `web/src` that calls `scrollTo`,
 * `scrollBy` or `.scroll(`, assigns `scrollTop` or touches `history.scrollRestoration`, and
 * nothing uses react-router's `ScrollRestoration` (it keeps offsets in `sessionStorage`,
 * ADR-0026). `ScrollSync.tsx` is the scan's only exemption.
 *
 * The finder walks the sources it is handed, so a fixture that must fail is tested beside the
 * real tree.
 */

import { expect, test } from 'vitest'

interface Source {
  path: string
  content: string
}

const OWNER = 'src/shell/ScrollSync.tsx'

const RULES: readonly { name: string; pattern: RegExp }[] = [
  { name: 'scrollTo', pattern: /\bscrollTo\s*\(/ },
  { name: 'scrollBy', pattern: /\bscrollBy\s*\(/ },
  { name: 'scroll', pattern: /\.scroll\s*\(/ },
  { name: 'scrollTop', pattern: /\bscrollTop\s*(?:[+\-*/]?=(?!=)|\+\+|--)/ },
  { name: 'scrollRestoration', pattern: /\bscrollRestoration\b/ },
  { name: 'ScrollRestoration', pattern: /\bScrollRestoration\b/ },
]

function stripComments(content: string): string {
  return content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

function isTestFile(path: string): boolean {
  return /\.test\.tsx?$/.test(path)
}

/** `path: rule` for each non-test source other than the owner that scrolls the page. */
function findScrollers(files: readonly Source[]): string[] {
  const found: string[] = []
  for (const { path, content } of files) {
    if (path === OWNER || isTestFile(path)) continue
    const code = stripComments(content)
    for (const rule of RULES) if (rule.pattern.test(code)) found.push(`${path}: ${rule.name}`)
  }
  return found
}

test('a source other than ScrollSync that scrolls the page is flagged, rule by rule', () => {
  expect(
    findScrollers([
      { path: 'src/screens/A.tsx', content: 'window.scrollTo({ top: 0 })' },
      { path: 'src/screens/B.tsx', content: 'window.scrollBy(0, 40)' },
      { path: 'src/screens/C.tsx', content: 'document.documentElement.scroll(0, 0)' },
      { path: 'src/screens/D.tsx', content: 'document.body.scrollTop = 0' },
      { path: 'src/screens/E.tsx', content: 'history.scrollRestoration = "auto"' },
      { path: 'src/router.tsx', content: 'import { ScrollRestoration } from "react-router"' },
    ]),
  ).toEqual([
    'src/screens/A.tsx: scrollTo',
    'src/screens/B.tsx: scrollBy',
    'src/screens/C.tsx: scroll',
    'src/screens/D.tsx: scrollTop',
    'src/screens/E.tsx: scrollRestoration',
    'src/router.tsx: ScrollRestoration',
  ])
})

test('ScrollSync is the only exemption, and tests, comments and reads are left alone', () => {
  expect(
    findScrollers([
      { path: 'src/shell/ScrollSync.tsx', content: 'window.scrollTo({ top }); history.scrollRestoration = "manual"' },
      { path: 'src/shell/ScrollSync.test.tsx', content: 'window.scrollTo = () => undefined' },
      { path: 'src/screens/F.tsx', content: '/* it never calls scrollTo( itself */ // nor scrollBy(\nconst y = window.scrollY' },
      { path: 'src/screens/G.tsx', content: 'if (node.scrollTop === 0) return; const top = node.scrollTop' },
      { path: 'src/shell/Other.tsx', content: 'window.scrollTo(0, 0)' },
    ]),
  ).toEqual(['src/shell/Other.tsx: scrollTo'])
})

test('no non-test source of web/src scrolls the page but ScrollSync', () => {
  const modules = import.meta.glob<string>('/src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true })
  const files = Object.entries(modules).map(([path, content]) => ({ path: path.replace(/^\//, ''), content }))

  expect(files.length).toBeGreaterThan(50)
  expect(files.some(({ path }) => path === OWNER)).toBe(true)
  // A known non-owner source is in the scanned set with its real content, so the scan cannot
  // pass by reading nothing.
  const routes = files.find(({ path }) => path === 'src/routes.ts')
  expect(routes?.content).toContain('SCREENS')
  expect(findScrollers([{ path: 'src/routes.ts', content: `${routes?.content ?? ''}\nwindow.scrollTo(0, 0)` }])).toEqual([
    'src/routes.ts: scrollTo',
  ])
  expect(findScrollers(files)).toEqual([])
})
