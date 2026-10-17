/** The Spanish rule over the real sections of `web/src/copy/`: a section that is not
 * `PENDING` must pass it. */

import { expect, test } from 'vitest'
import { spanishProblems, type Section } from './copySpanish'

const sections = import.meta.glob<Section>(['/src/copy/*.ts', '!/src/copy/{index,limits}.ts', '!/src/copy/*.test.ts'], {
  eager: true,
})

test('there are sections to read, each one PENDING or sound', () => {
  expect(Object.keys(sections).length).toBeGreaterThanOrEqual(16)
  for (const [path, section] of Object.entries(sections)) {
    expect(spanishProblems(path, section)).toEqual([])
  }
})

test.each(Object.entries(sections))('%s says PENDING = true, or says nothing once it is in English', (_path, section) => {
  expect([true, undefined]).toContain(section.PENDING)
})

test.each(['common', 'format'])('the %s section is in English: it has retired PENDING and passes the rule', (name) => {
  const entry = Object.entries(sections).find(([path]) => path === `/src/copy/${name}.ts`)
  expect(entry).toBeDefined()
  const [path, section] = entry ?? ['', {}]
  expect(section.PENDING).toBeUndefined()
  expect(spanishProblems(path, section)).toEqual([])
})
