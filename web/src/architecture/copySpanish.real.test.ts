/** The Spanish rule over the real sections of `web/src/copy/`: every section passes it, with
 * no way to be skipped. */

import { expect, test } from 'vitest'
import { spanishProblems, type Section } from './copySpanish'

const sections = import.meta.glob<Section>(['/src/copy/*.ts', '!/src/copy/{index,limits}.ts', '!/src/copy/*.test.ts'], {
  eager: true,
})

test('there are sections to read, each one sound', () => {
  expect(Object.keys(sections).length).toBeGreaterThanOrEqual(16)
  for (const [path, section] of Object.entries(sections)) {
    expect(spanishProblems(path, section)).toEqual([])
  }
})

test.each(Object.entries(sections))('%s exports no PENDING marker: no section is skipped', (_path, section) => {
  expect('PENDING' in section).toBe(false)
})
