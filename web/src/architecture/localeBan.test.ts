/**
 * The locale ban (ADR-0049, amendment GH-297): fixtures for what `findLocaleCalls` catches and
 * lets pass, the tokenizer's reading of strings, templates and comments, and a scan of every
 * non-test file under `web/src`. Every failing fixture asserts the exact lines; every passing
 * one asserts none and that the walk ended in code. Fixtures that are not about line 1 start
 * with a blank line, so a wrong line cannot pass as 1.
 */

import { describe, expect, test } from 'vitest'
import { DATE_LINE_EXCEPTION, endsInCode, findLocaleCalls } from './localeBan'

const sources = import.meta.glob<string>(['/src/**/*.{ts,tsx}', '!/src/**/*.test.{ts,tsx}'], {
  eager: true,
  query: '?raw',
  import: 'default',
})

/** A fixture on line 2, below one blank line. */
function onLine2(code: string): string {
  return `\n${code}`
}

function expectCaught(source: string, lines: number[]): void {
  expect(findLocaleCalls(source)).toEqual(lines)
}

function expectPasses(source: string): void {
  expect(findLocaleCalls(source)).toEqual([])
  expect(endsInCode(source)).toBe(true)
}

describe('the five banned forms', () => {
  test.each([
    ['1: a to-locale method with no argument', 'x.toLocaleString()'],
    ['1: a to-locale method with a locale', "x.toLocaleDateString('es-AR')"],
    ['2: the date formatter', 'new Intl.DateTimeFormat()'],
    ['3: the relative-time formatter', "new Intl.RelativeTimeFormat('es')"],
    ['4: the number formatter with no argument', 'Intl.NumberFormat()'],
    ['4: the number formatter with undefined', 'Intl.NumberFormat(undefined)'],
    ['4: the number formatter with a variable', 'new Intl.NumberFormat(loc)'],
    ['5: a compare with no second argument', 'a.localeCompare(b)'],
    ['5: a compare with an undefined second argument', 'a.localeCompare(b, undefined)'],
    ['5: a collator with no argument', 'new Intl.Collator()'],
  ])('%s is caught on its line', (_name, code) => {
    expectCaught(onLine2(code), [2])
  })
})

describe('argument shapes that are not one string literal', () => {
  test.each([
    ['a compare whose second argument is a variable after a call with a comma', 'a.localeCompare(fn(x, y), loc)'],
    ['a number formatter over several lines', 'new Intl.NumberFormat(\n  loc,\n)'],
    ['a concatenation', "Intl.NumberFormat('es-' + x)"],
    ['a template with a hole', 'Intl.NumberFormat(`${loc}`)'],
    ['a spread', 'Intl.NumberFormat(...args)'],
    ['a bare reference', 'const F = Intl.NumberFormat'],
    ['a destructuring', 'const { NumberFormat } = Intl'],
    ['an optional member', 'Intl?.DateTimeFormat'],
    ['an optional compare', 'a?.localeCompare(b)'],
    ['a compare by index', "a['localeCompare'](b)"],
    ['a global path', 'globalThis.Intl.DateTimeFormat'],
    ['a collator with a variable', 'new Intl.Collator(loc)'],
    ['a collator with undefined', 'new Intl.Collator(undefined, { numeric: true })'],
    ['a number formatter called with an optional call', 'Intl.NumberFormat?.(loc)'],
    ['a compare whose second argument is a string followed by more text', "a.localeCompare(b, 'es' + x)"],
  ])('%s is caught on line 2', (_name, code) => {
    expectCaught(onLine2(code), [2])
  })

  test('a multi-line call reports the line where the banned name starts, once', () => {
    expectCaught('\n\nconst F = new Intl.NumberFormat(\n  a,\n  loc,\n)\n', [3])
  })

  test('two uses on two lines give both lines, sorted, and two on one line give one', () => {
    expectCaught('\nx.toLocaleString(); y.toLocaleString()\n\na.localeCompare(b)\n', [2, 4])
  })

  test('other Intl members are not banned', () => {
    expectPasses('\nnew Intl.PluralRules("es").select(n)\n')
  })
})

describe('the tokenizer', () => {
  test('a // inside a string does not start a comment', () => {
    expectCaught(onLine2("'a // b'; x.toLocaleString()"), [2])
  })

  test('a // between template holes does not start a comment', () => {
    expectCaught('\n`${a}//${b}`;\nx.toLocaleString()\n', [3])
  })

  test('a /* inside a string does not open a comment', () => {
    expectCaught(onLine2("'/*'; x.toLocaleString(); '*/'"), [2])
  })

  test('a banned name inside a multi-line block comment passes', () => {
    expectPasses('\n/*\n x.toLocaleString()\n new Intl.DateTimeFormat()\n*/\nconst a = 1\n')
  })

  test('the line after a block comment is counted', () => {
    expectCaught('\n/*\n one\n two\n*/\nx.toLocaleString()\n', [6])
  })

  test('a banned name inside a line comment passes', () => {
    expectPasses('\nconst a = 1 // x.toLocaleString()\n')
  })

  test('a banned name inside a string is caught', () => {
    expectCaught(onLine2("const s = 'x.toLocaleString()'"), [2])
  })

  test('a quote inside a regex does not open a string', () => {
    expectCaught("\nconst r = /['\"]/\nx.toLocaleString()\n", [3])
  })

  test('a slash inside a regex class does not end the regex', () => {
    expectCaught('\nconst r = /[/]\'/\nx.toLocaleString()\n', [3])
  })

  test('a division is not a regex', () => {
    expectCaught("\nconst r = a / b + c / d\nx.toLocaleString()\n", [3])
  })

  test('a brace in a template hole does not end the hole', () => {
    expectCaught('\n`${ {a: 1}.a }`; x.toLocaleString()\n', [2])
  })

  test('a template inside a hole is read', () => {
    expectCaught('\n`${ `${a}` }`; x.toLocaleString()\n', [2])
  })

  test('an escaped quote does not end a string', () => {
    expectCaught("\n'it\\'s // fine'; x.toLocaleString()\n", [2])
  })

  test('a file that ends in a line comment ends in code', () => {
    expect(endsInCode('const a = 1 // done')).toBe(true)
  })

  test('an open block comment, template or hole does not end in code', () => {
    expect(endsInCode('const a = 1 /* open')).toBe(false)
    expect(endsInCode('const a = `open')).toBe(false)
    expect(endsInCode('const a = `${open')).toBe(false)
    expect(endsInCode("const a = 'open")).toBe(false)
  })
})

describe('.tsx text', () => {
  test("an apostrophe in JSX text does not swallow the next line", () => {
    expectCaught("\n<p>Don't</p>\n{a.localeCompare(b)}\n", [3])
  })

  test('a URL in JSX text is not a comment', () => {
    expectCaught(onLine2('<a>http://x</a>{a.localeCompare(b)}'), [2])
  })

  test('a closing tag does not open a regex', () => {
    expectCaught('\n<div>{x}</div>\nx.toLocaleString()\n', [3])
  })
})

describe('what passes, each against a twin one token away that fails', () => {
  test.each([
    [
      "new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 })",
      'new Intl.NumberFormat(loc, { maximumFractionDigits: 0 })',
    ],
    ["a.localeCompare(b, 'es', { sensitivity: 'base' })", "a.localeCompare(b, loc, { sensitivity: 'base' })"],
    ["a.localeCompare(fn(x, y), 'es')", 'a.localeCompare(fn(x, y), loc)'],
    ["a.localeCompare(b, \"es\")", 'a.localeCompare(b, `${loc}`)'],
    ["new Intl.Collator('es')", 'new Intl.Collator(loc)'],
    ['new Intl.NumberFormat(`es-AR`)', 'new Intl.NumberFormat(`${loc}`)'],
    ['// x.toLocaleString()', "const s = '// x.toLocaleString()'"],
    ['<span>{"a"}</span>', '<span>{"a"}</span>{a.localeCompare(b)}'],
    ["const label = 'plain text'", "const label = 'plain text'; x.toLocaleString()"],
  ])('%s passes and its twin is caught', (passing, failing) => {
    expectPasses(onLine2(passing))
    expectCaught(onLine2(failing), [2])
  })

  test('a JSX line with a string child passes', () => {
    expectPasses('\n<span>{\'a\'}</span>\n')
  })
})

describe('the date line exception (GH-748)', () => {
  const DATES = '/src/format/dates.ts'
  const CALL =
    "new Intl.DateTimeFormat(tag, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })"
  const inFile = (code: string, path = DATES) => findLocaleCalls(onLine2(code), path)

  test('names one file and one form', () => {
    expect(DATE_LINE_EXCEPTION.file).toBe('src/format/dates.ts')
    expect(DATE_LINE_EXCEPTION.form).toBe('DateTimeFormat')
  })

  test('the one correct call in dates.ts passes, whatever the path form', () => {
    expect(inFile(`const f = ${CALL}`)).toEqual([])
    expect(inFile(`const f = ${CALL}`, 'src/format/dates.ts')).toEqual([])
    expect(inFile(`const f = ${CALL}`, 'web/src/format/dates.ts')).toEqual([])
    expect(endsInCode(onLine2(`const f = ${CALL}`))).toBe(true)
  })

  test('the same correct call in any other file is caught', () => {
    expect(inFile(`const f = ${CALL}`, '/src/format/money.ts')).toEqual([2])
    expect(inFile(`const f = ${CALL}`, '/src/other/dates.ts')).toEqual([2])
    expect(findLocaleCalls(onLine2(`const f = ${CALL}`))).toEqual([2])
  })

  test('a second formatter in dates.ts makes both caught', () => {
    expect(findLocaleCalls(`\n${CALL}\n${CALL}\n`, DATES)).toEqual([2, 3])
  })

  test.each([
    ['without timeZone UTC', "new Intl.DateTimeFormat(tag, { weekday: 'long' })"],
    ['with another zone', "new Intl.DateTimeFormat(tag, { timeZone: 'America/Argentina/Buenos_Aires' })"],
    ['with no locale argument', "new Intl.DateTimeFormat(undefined, { timeZone: 'UTC' })"],
    ['with no arguments at all', 'new Intl.DateTimeFormat()'],
    ['with a literal locale', "new Intl.DateTimeFormat('es', { timeZone: 'UTC' })"],
    ['with an empty list as locale', "new Intl.DateTimeFormat([], { timeZone: 'UTC' })"],
    ['with options in a variable', 'new Intl.DateTimeFormat(tag, options)'],
    ['with a spread in the options', "new Intl.DateTimeFormat(tag, { ...base, timeZone: 'UTC' })"],
    ['with no options', 'new Intl.DateTimeFormat(tag)'],
    ['through an optional member', "new Intl?.DateTimeFormat(tag, { timeZone: 'UTC' })"],
    ['through a global path', "new globalThis.Intl.DateTimeFormat(tag, { timeZone: 'UTC' })"],
    ['with a UTC that is not the zone', "new Intl.DateTimeFormat(tag, { nested: { timeZone: 'UTC' } })"],
  ])('the call %s is caught in dates.ts', (_name, code) => {
    expect(inFile(`const f = ${code}`)).toEqual([2])
  })

  test('a to-locale call in dates.ts is caught next to the correct call', () => {
    expect(findLocaleCalls(`\n${CALL}\nx.toLocaleString()\n`, DATES)).toEqual([3])
  })

  test('a non-literal number formatter in dates.ts is caught next to the correct call', () => {
    expect(findLocaleCalls(`\n${CALL}\nnew Intl.NumberFormat(tag)\n`, DATES)).toEqual([3])
  })

  test('a relative-time formatter and a collator in dates.ts stay caught', () => {
    expect(findLocaleCalls(`\n${CALL}\nnew Intl.RelativeTimeFormat('es')\nnew Intl.Collator(tag)\n`, DATES)).toEqual([
      3, 4,
    ])
  })
})

describe('every non-test file under web/src', () => {
  test('uses none of the banned forms and ends in code', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(200)
    const hits = Object.entries(sources).flatMap(([path, source]) =>
      findLocaleCalls(source, path).map((line) => `${path}:${line}`),
    )
    expect(hits).toEqual([])
    const open = Object.entries(sources)
      .filter(([, source]) => !endsInCode(source))
      .map(([path]) => path)
    expect(open).toEqual([])
  })

  test('the guard file itself is among the files it scans', () => {
    expect(Object.keys(sources)).toContain('/src/architecture/localeBan.ts')
  })
})
