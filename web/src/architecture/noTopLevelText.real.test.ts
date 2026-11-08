/**
 * Runs `findTopLevelText` over the real tree (GH-379): the fixture tests prove the rule's own
 * logic, this proves no file of `web/src/` resolves a text at load or imports a locale file
 * outside `i18n/`. It reads every non-test `.ts`/`.tsx` file, `i18n/`, `architecture/` and the
 * `.d.ts` files included, and prints each finding as `file:line: rule`.
 */

import { expect, test } from 'vitest'
import { findTopLevelText } from './noTopLevelText'

const modules = import.meta.glob('/src/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

function isTestFile(path: string): boolean {
  return /\.test\.tsx?$/.test(path)
}

test('no non-test source of the front resolves text at module scope or imports locales outside i18n/', () => {
  const files = Object.entries(modules).filter(([path]) => !isTestFile(path))
  expect(files.length).toBeGreaterThan(100)
  const findings = files.flatMap(([path, source]) =>
    findTopLevelText(path, source).map(({ line, rule }) => `${path.replace(/^\//, '')}:${line}: ${rule}`),
  )
  expect(findings).toEqual([])
})
