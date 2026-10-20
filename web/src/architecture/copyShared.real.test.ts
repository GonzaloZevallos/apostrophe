/** Invariant 9 over the real sections of `web/src/copy/`: no word has two homes. */

import { expect, test } from 'vitest'
import { sharedProblems } from './copyShared'

const sources = import.meta.glob(['/src/copy/*.ts', '!/src/copy/{index,limits}.ts', '!/src/copy/*.test.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

test('each text the sections show is spelled out in one section only', () => {
  const files = Object.entries(sources).map(([path, source]) => ({ path: path.replace(/^\/src\//, ''), source }))
  expect(files.length).toBeGreaterThanOrEqual(16)
  expect(sharedProblems(files)).toEqual([])
})
