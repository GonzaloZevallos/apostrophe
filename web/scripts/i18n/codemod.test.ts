/**
 * The codemod at its two seams: the exported `run` over in-memory sources and a mappings map,
 * and the CLI's exit code and stderr. Every rewrite is one case; every refusal is one case
 * that asserts the error's file and line and that no file changes.
 */

import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import type { Mappings } from './baselineKeys.ts'
import { run, type SourceFile } from './codemod.ts'

const MAPPINGS: Mappings = {
  'common.ts:COMMON_TEXT.save': { key: 'common:save' },
  'common.ts:COMMON_TEXT.cancel': { key: 'common:cancel' },
  'common.ts:COMMON_TEXT.greet': { key: 'common:greet', params: ['name'] },
  'common.ts:COMMON_TEXT.between': { key: 'common:between', params: ['fromDate', 'toDate'] },
  'common.ts:COMMON_TEXT.nested.bye': { key: 'common:nested.bye' },
}

const IMPORT = "import { COMMON_TEXT } from '../copy/common'\n"
const HOOK_IMPORT = "import { useTranslation } from 'react-i18next'\n"
const file = (text: string, path = 'web/src/sales/View.tsx'): SourceFile => ({ path, text })

/** The rewritten text of the only file, failing the test when the run refused. */
function rewritten(text: string, mappings: Mappings = MAPPINGS): string {
  const result = run([file(text)], mappings)
  if ('errors' in result) throw new Error(`refused: ${JSON.stringify(result.errors)}`)
  return result.edits[0]?.text ?? text
}

describe('the rewrites', () => {
  test('a name becomes a t call and the component gets the hook', () => {
    const source = `${IMPORT}\nexport function View() {\n  return <b>{COMMON_TEXT.save}</b>\n}\n`
    expect(rewritten(source)).toBe(
      `${HOOK_IMPORT}\nexport function View() {\n  const { t } = useTranslation()\n  return <b>{t('common:save')}</b>\n}\n`,
    )
  })

  test('a nested name keeps its path', () => {
    const source = `${IMPORT}function View() {\n  return COMMON_TEXT.nested.bye\n}\n`
    expect(rewritten(source)).toContain("return t('common:nested.bye')")
  })

  test('a function call becomes a t call with the params named by the mapping', () => {
    const source = `${IMPORT}function View({ from, to }: { from: string; to: string }) {\n  return COMMON_TEXT.between(from, to.trim())\n}\n`
    expect(rewritten(source)).toContain("return t('common:between', { fromDate: from, toDate: to.trim() })")
  })

  test('an argument already named like its param is written as a shorthand', () => {
    const source = `${IMPORT}function View({ name }: { name: string }) {\n  return COMMON_TEXT.greet(name)\n}\n`
    expect(rewritten(source)).toContain("return t('common:greet', { name })")
  })

  test('a copy read inside an argument is rewritten too', () => {
    const source = `${IMPORT}function View() {\n  return COMMON_TEXT.greet(COMMON_TEXT.save)\n}\n`
    expect(rewritten(source)).toContain("return t('common:greet', { name: t('common:save') })")
  })

  test('a concise body becomes a block with the hook first', () => {
    const source = `${IMPORT}const View = () => COMMON_TEXT.save\n`
    expect(rewritten(source)).toBe(
      `${HOOK_IMPORT}const View = () => { const { t } = useTranslation(); return t('common:save') }\n`,
    )
  })

  test('the hook goes before an early return', () => {
    const source = `${IMPORT}function View({ ready }: { ready: boolean }) {\n  if (!ready) return null\n  return COMMON_TEXT.save\n}\n`
    const out = rewritten(source)
    expect(out.indexOf('useTranslation()')).toBeLessThan(out.indexOf('if (!ready)'))
  })

  test('memo takes the name of the variable and the hook goes in the inner function', () => {
    const source = `import { memo } from 'react'\n${IMPORT}const View = memo(() => {\n  return COMMON_TEXT.save\n})\n`
    const out = rewritten(source)
    expect(out).toContain("memo(() => {\n  const { t } = useTranslation()\n  return t('common:save')\n})")
  })

  test('forwardRef takes the name of its inner function expression', () => {
    const source = `import { forwardRef } from 'react'\n${IMPORT}export default forwardRef(function Field(_props, _ref) {\n  return COMMON_TEXT.save\n})\n`
    expect(rewritten(source)).toContain('function Field(_props, _ref) {\n  const { t } = useTranslation()')
  })

  test('a literal dependency array of useMemo gets t when it lacks it', () => {
    const source = `${IMPORT}function View({ n }: { n: number }) {\n  const label = useMemo(() => COMMON_TEXT.save + n, [n])\n  return label\n}\n`
    // a concatenation is refused, so the array case uses a plain read
    expect(run([file(source)], MAPPINGS)).toHaveProperty('errors')
    const plain = `${IMPORT}function View({ n }: { n: number }) {\n  const label = useMemo(() => [COMMON_TEXT.save, n], [n])\n  return label\n}\n`
    expect(rewritten(plain)).toContain("useMemo(() => [t('common:save'), n], [n, t])")
  })

  test('a dependency array that already holds t is left alone', () => {
    const source = `${IMPORT}function View() {\n  const go = useCallback(() => COMMON_TEXT.save, [t])\n  return go\n}\n`
    expect(rewritten(source)).toContain('[t])')
  })

  test('the copy import is dropped when no use remains, and only its specifier otherwise', () => {
    const both = `import { COMMON_TEXT, OTHER } from '../copy/common'\nfunction View() {\n  return [COMMON_TEXT.save, OTHER]\n}\n`
    expect(rewritten(both)).toContain("import { OTHER } from '../copy/common'")
    expect(rewritten(both)).not.toContain('COMMON_TEXT')
    expect(rewritten(`${IMPORT}function View() {\n  return COMMON_TEXT.save\n}\n`)).not.toContain('copy/common')
  })

  test('an existing hook at the top of the body is reused', () => {
    const source = `${HOOK_IMPORT}${IMPORT}function View() {\n  const { t } = useTranslation()\n  return [t('x'), COMMON_TEXT.save]\n}\n`
    const out = rewritten(source)
    expect(out.match(/useTranslation\(\)/g)).toHaveLength(1)
    expect(out.match(/import \{ useTranslation \}/g)).toHaveLength(1)
    expect(out).toContain("t('common:save')")
  })

  test('a hook body gets the hook and a callback inside a component reaches the same one', () => {
    const source = `${IMPORT}function useLabels(items: string[]) {\n  return items.map(() => COMMON_TEXT.save)\n}\n`
    const out = rewritten(source)
    expect(out.match(/useTranslation\(\)/g)).toHaveLength(1)
    expect(out).toContain("items.map(() => t('common:save'))")
  })

  test('an unmapped name of the object stays as it is, with its import', () => {
    const out = rewritten(`${IMPORT}function View() {\n  return [COMMON_TEXT.save, COMMON_TEXT.other]\n}\n`)
    expect(out).toContain('COMMON_TEXT.other')
    expect(out).toContain("from '../copy/common'")
  })

  test('a file with no copy read is not an edit', () => {
    const result = run([file('export const x = 1\n')], MAPPINGS)
    expect(result).toEqual({ edits: [] })
  })
})

interface Refusal {
  name: string
  source: string
  line: number
  message: string
  path?: string
}

const body = (statement: string): string => `${IMPORT}function View() {\n  ${statement}\n}\n`
const NOT_AT_TOP = 'useTranslation is not a plain const { t } = useTranslation() at the top of the body'

const REFUSALS: Refusal[] = [
  { name: 'an alias', source: body('const copy = COMMON_TEXT\n  return copy.save'), line: 3, message: 'COMMON_TEXT is aliased or passed as a value' },
  { name: 'a spread', source: body('return { ...COMMON_TEXT }'), line: 3, message: 'COMMON_TEXT is spread' },
  { name: 'a computed access', source: body("return COMMON_TEXT['save']"), line: 3, message: 'COMMON_TEXT is read by computed access' },
  { name: 'a use at module top level', source: `${IMPORT}export const TITLE = COMMON_TEXT.save\n`, line: 2, message: 'a copy read at module top level' },
  {
    name: 'a file under web/src/copy',
    source: `${IMPORT}\nexport const X = 1\n`,
    line: 1,
    path: 'web/src/copy/other.ts',
    message: 'a file under web/src/copy is never rewritten',
  },
  { name: 'a wrong argument count', source: body('return COMMON_TEXT.greet()'), line: 3, message: 'COMMON_TEXT.greet takes 1 arguments, called with 0' },
  { name: 'a call of a text', source: body('return COMMON_TEXT.save(1)'), line: 3, message: 'COMMON_TEXT.save takes 0 arguments, called with 1' },
  {
    name: 'a function read without a call',
    source: body('return [1].map(COMMON_TEXT.greet)'),
    line: 3,
    message: 'COMMON_TEXT.greet is a function and is read without a call',
  },
  { name: 'a spread argument', source: body('return COMMON_TEXT.greet(...[])'), line: 3, message: 'COMMON_TEXT.greet is called with a spread argument' },
  {
    name: 'a use inside a function that is neither a component nor a hook',
    source: `${IMPORT}function format() {\n  return COMMON_TEXT.save\n}\n`,
    line: 3,
    message: 'a copy read in format, which is neither a component nor a hook',
  },
  {
    name: 'an existing local named t',
    source: body("const t = 'x'\n  return [t, COMMON_TEXT.save]"),
    line: 3,
    message: 'a local named t already exists where the hook goes',
  },
  {
    name: 'a useTranslation after an early return',
    source: `${HOOK_IMPORT}${IMPORT}function View({ a }: { a: boolean }) {\n  if (a) return null\n  const { t } = useTranslation()\n  return [t, COMMON_TEXT.save]\n}\n`,
    line: 5,
    message: NOT_AT_TOP,
  },
  {
    name: 'a useTranslation after a copy read',
    source: `${HOOK_IMPORT}${IMPORT}function View() {\n  const before = COMMON_TEXT.cancel\n  const { t } = useTranslation()\n  return [before, t, COMMON_TEXT.save]\n}\n`,
    line: 5,
    message: NOT_AT_TOP,
  },
  {
    name: 'a type position',
    source: `${IMPORT}type Save = typeof COMMON_TEXT.save\nfunction View() {\n  return COMMON_TEXT.save\n}\n`,
    line: 2,
    message: 'COMMON_TEXT is read in a type position',
  },
  { name: 'a string concatenation', source: body("return COMMON_TEXT.save + '!'"), line: 3, message: 'COMMON_TEXT.save is concatenated into a string' },
  { name: 'a template literal', source: body('return `${COMMON_TEXT.save}!`'), line: 3, message: 'COMMON_TEXT.save is put in a template literal' },
  {
    name: 'a dependency list that is not an array literal',
    source: body('const deps = []\n  return useMemo(() => COMMON_TEXT.save, deps)'),
    line: 4,
    message: 'a dependency list that is not an array literal',
  },
  {
    name: 'an anonymous memo wrapper',
    source: `import { memo } from 'react'\n${IMPORT}export default memo(() => COMMON_TEXT.save)\n`,
    line: 3,
    message: 'an anonymous memo or forwardRef wrapper cannot take the hook',
  },
]

describe('the refusals', () => {
  test.each(REFUSALS)('$name is refused with its own problem, file and line', ({ source, line, message, path }) => {
    const target = file(source, path ?? 'web/src/sales/View.tsx')
    const result = run([target], MAPPINGS)
    if (!('errors' in result)) throw new Error('the codemod accepted a source it must refuse')
    expect(result.errors).toEqual([{ file: target.path, line, message }])
  })

  test('a failing file leaves every other file unwritten', () => {
    const good = file(`${IMPORT}function Good() {\n  return COMMON_TEXT.save\n}\n`, 'web/src/a/Good.tsx')
    const bad = file(body('const copy = COMMON_TEXT\n  return copy'), 'web/src/b/Bad.tsx')
    const other = file(`${IMPORT}function Other() {\n  return COMMON_TEXT.cancel\n}\n`, 'web/src/c/Other.tsx')
    const result = run([good, bad, other], MAPPINGS)
    expect(result).toEqual({ errors: [{ file: 'web/src/b/Bad.tsx', line: 3, message: expect.stringContaining('alias') }] })
  })

  test('every error of every file is reported', () => {
    const one = file(body('const copy = COMMON_TEXT\n  return copy'), 'web/src/a/One.tsx')
    const two = file(`${IMPORT}export const TITLE = COMMON_TEXT.save\n`, 'web/src/b/Two.tsx')
    const result = run([one, two], MAPPINGS)
    if (!('errors' in result)) throw new Error('the codemod accepted sources it must refuse')
    expect(result.errors.map(({ file: path, line }) => `${path}:${line}`)).toEqual(['web/src/a/One.tsx:3', 'web/src/b/Two.tsx:2'])
  })
})

describe('the CLI', () => {
  const script = join(import.meta.dirname, 'codemod.ts')
  function sandbox(source: string): { root: string; target: string; keys: string } {
    const root = mkdtempSync(join(tmpdir(), 'codemod-'))
    const keys = join(root, 'baselineKeys')
    mkdirSync(keys)
    writeFileSync(join(keys, 'common.json'), JSON.stringify(MAPPINGS))
    const target = join(root, 'src', 'View.tsx')
    mkdirSync(join(root, 'src'))
    writeFileSync(target, source)
    return { root, target, keys }
  }
  const cli = (args: string[], cwd: string) =>
    spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8' })

  test('a refused file exits non-zero, names file and line on stderr and stays byte-identical', () => {
    const source = body('const copy = COMMON_TEXT\n  return copy')
    const { root, target, keys } = sandbox(source)
    const result = cli(['--keys', keys, target], root)
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain(`${target}:3`)
    expect(readFileSync(target, 'utf8')).toBe(source)
  })

  test('an accepted file exits zero and is rewritten', () => {
    const { root, target, keys } = sandbox(`${IMPORT}function View() {\n  return COMMON_TEXT.save\n}\n`)
    const result = cli(['--keys', keys, target], root)
    expect(result.status).toBe(0)
    expect(readFileSync(target, 'utf8')).toContain("t('common:save')")
  })

  test('no file argument exits non-zero with a usage line', () => {
    const { root, keys } = sandbox('')
    const result = cli(['--keys', keys], root)
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('usage')
  })
})
