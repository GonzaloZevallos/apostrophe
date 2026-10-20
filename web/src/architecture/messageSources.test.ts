/**
 * One source per shared message (varieties.md, criterion 18): "Check the grams you entered"
 * lives in `copy/stock.ts` and "Price saved" in
 * `copy/varieties.ts`; every other module imports the constant. The scan
 * is fed a list of sources, so the fixture below can seed a second copy and must fail.
 */

import { expect, test } from 'vitest'
import { blankComments, findMessageCopies, type SourceFile } from './messageSources'

const GRAMS = 'Check the grams you entered'
const SAVED = 'Price saved'
const GRAMS_OWNER = 'src/copy/stock.ts'
const SAVED_OWNER = 'src/copy/varieties.ts'

test('a second copy of a message outside its owner is reported, in any quote style', () => {
  const files: SourceFile[] = [
    { path: GRAMS_OWNER, content: `export const GRAMS_INVALID = '${GRAMS}'` },
    { path: 'src/screens/StockEntryForm.tsx', content: `const GRAMS_INVALID = '${GRAMS}'` },
    { path: 'src/screens/Other.tsx', content: `const m = \`${GRAMS}\`` },
  ]
  expect(findMessageCopies(files, GRAMS, GRAMS_OWNER)).toEqual([
    `src/screens/StockEntryForm.tsx: "${GRAMS}" is defined outside ${GRAMS_OWNER}`,
    `src/screens/Other.tsx: "${GRAMS}" is defined outside ${GRAMS_OWNER}`,
  ])
})

test('the owner must define the message, or the scan has lost it', () => {
  const files: SourceFile[] = [{ path: 'src/screens/Other.tsx', content: 'const a = 1' }]
  expect(findMessageCopies(files, SAVED, SAVED_OWNER)).toEqual([
    `${SAVED_OWNER}: "${SAVED}" is not defined in its owner`,
  ])
})

test('comments do not count as copies, and a toast typed as a literal does', () => {
  const files: SourceFile[] = [
    { path: SAVED_OWNER, content: `export const PRICE_SAVED = '${SAVED}'` },
    { path: 'src/a.ts', content: `// ${SAVED}\n/** ${SAVED}\n */\nconst x = 1` },
    { path: 'src/b.tsx', content: `onDone('${SAVED}')` },
  ]
  expect(findMessageCopies(files, SAVED, SAVED_OWNER)).toEqual([
    `src/b.tsx: "${SAVED}" is defined outside ${SAVED_OWNER}`,
  ])
})

test('blanking a comment keeps its newlines', () => {
  expect(blankComments('a // x\n/* y\nz */b')).toBe('a     \n    \n    b')
})

const modules = import.meta.glob(['/src/**/*.ts', '/src/**/*.tsx', '!/src/**/*.test.{ts,tsx}'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

test('each shared message is defined in exactly its one module across web/src', () => {
  const files = Object.entries(modules).map(([path, content]) => ({
    path: path.replace(/^\//, ''),
    content,
  }))
  expect(files.some(({ path }) => path === GRAMS_OWNER)).toBe(true)
  expect(findMessageCopies(files, GRAMS, GRAMS_OWNER)).toEqual([])
  expect(findMessageCopies(files, SAVED, SAVED_OWNER)).toEqual([])
})
