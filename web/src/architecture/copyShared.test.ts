import { expect, test } from 'vitest'
import { sharedProblems, spelledOut } from './copyShared'

test('a word spelled out in two sections is reported, in any quote style', () => {
  const problems = sharedProblems([
    { path: 'copy/a.ts', source: "export const DISCARD = 'Yes, discard it'" },
    { path: 'copy/b.ts', source: 'export const YES = `Yes, discard it `' },
    { path: 'copy/c.ts', source: 'export const OTHER = "Something else"' },
  ])
  expect(problems).toEqual(['"Yes, discard it" is defined in copy/a.ts and copy/b.ts: import it from one owner'])
})

test('an import of the owner is not a second definition', () => {
  const problems = sharedProblems([
    { path: 'copy/common.ts', source: "export const SAVE = 'Save'" },
    { path: 'copy/a.ts', source: "import { SAVE } from './common'\nexport const SAVE_FORM = SAVE" },
  ])
  expect(problems).toEqual([])
})

test('property names, types and a reason are not words shown', () => {
  const source = "type T = 'Save'\nexport const x = { Save: 1, reason: 'Save', ['Save']: 2 }"
  expect([...spelledOut('copy/a.ts', source)]).toEqual([])
})

test('a word inside a function entry counts as spelled out', () => {
  expect([...spelledOut('copy/a.ts', 'export const f = (n: number) => (n ? "Save" : `Delete`)')].sort()).toEqual([
    'Delete',
    'Save',
  ])
})

test('the same word in another case is another text', () => {
  const problems = sharedProblems([
    { path: 'copy/a.ts', source: "export const PILL = 'hidden'" },
    { path: 'copy/b.ts', source: "export const TITLE = 'Hidden'" },
  ])
  expect(problems).toEqual([])
})
