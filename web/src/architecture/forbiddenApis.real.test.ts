/**
 * Runs `findForbiddenUsages` over the real tree (review finding, clipboard: the
 * fixture tests in `forbiddenApis.test.ts` prove the function's own logic, but
 * nothing wired it to the actual front sources, so another module naming
 * `navigator.clipboard` or `execCommand` — or calling `fetch` outside
 * `api/client.ts`, or any of the other forbidden APIs — would pass unnoticed).
 * `import.meta.glob` (Vite's own, not Node's `fs`, since `src/` is typed for the
 * browser, not Node) reads every `.ts`/`.tsx` file under `src/` plus the service
 * worker, the same way the rest of the app ships, so a real violation fails this
 * test, not only a hand-written fixture.
 */

import { expect, test } from 'vitest'
import { findForbiddenUsages, type SourceFile } from './forbiddenApis'

const modules = import.meta.glob(['/src/**/*.{ts,tsx}', '/public/sw.js'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

// `architecture/` is this guard's own home: its rules and its fixture tests name
// every forbidden API as a literal string on purpose, which is exactly what this
// scan would otherwise flag. The guard watches the rest of the app, not itself.
function isGuardsOwnFile(path: string): boolean {
  return path.includes('/architecture/')
}

// A test file legitimately stubs a forbidden global to drive the module that is
// allowed to call it (`clipboard.test.ts` stubs `navigator.clipboard` and
// `document.execCommand` to exercise `copyText`'s two branches); that is not a
// second module reaching the real API, so this scan leaves test files out.
function isTestFile(path: string): boolean {
  return /\.test\.tsx?$/.test(path)
}

// A doc comment is free to name an API in prose to say it must not be called
// (`api/client.ts`'s own header names `XMLHttpRequest` for exactly that reason);
// stripping block comments before scanning keeps this check about real calls.
function stripBlockComments(content: string): string {
  return content.replace(/\/\*[\s\S]*?\*\//g, '')
}

test('the real front sources carry none of the forbidden APIs', () => {
  const files: SourceFile[] = Object.entries(modules)
    .map(([rawPath, content]) => ({ path: rawPath.replace(/^\//, ''), content }))
    .filter(({ path }) => !isGuardsOwnFile(path) && !isTestFile(path))
    .map(({ path, content }) => ({ path, content: stripBlockComments(content) }))

  expect(files.length).toBeGreaterThan(10)
  expect(findForbiddenUsages(files)).toEqual([])
})
