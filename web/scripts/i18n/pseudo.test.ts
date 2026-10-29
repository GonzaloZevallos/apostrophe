import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  PSEUDO_COMMAND,
  PSEUDO_DIR,
  generatePseudo,
  pseudoProblems,
  pseudoText,
  writePseudo,
} from './pseudo.ts'
import { ENGLISH_DIR } from './resourceTypes.ts'

const WRITE = process.env['I18N_PSEUDO_WRITE'] === '1'

const shared: readonly { english: string; pseudo: string }[] = JSON.parse(
  readFileSync(join(import.meta.dirname, '..', '..', '..', 'tests', 'fixtures', 'pseudo_shared.json'), 'utf8'),
)

/** Letters and digits only: the placeholders and the filler removed, as the back counts. */
function plainLength(text: string): number {
  return [...text.replace(/\{\{[^{}]*\}\}|\$t\([^)]*\)|<\/?[A-Za-z0-9]+\s*\/?>/g, '')].length
}

function folder(files: Record<string, unknown>): string {
  const dir = mkdtempSync(join(tmpdir(), 'pseudo-'))
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), JSON.stringify(content))
  }
  return dir
}

describe('the pseudo-localise function', () => {
  it.each(shared)('gives the pair both generators share for "$english"', ({ english, pseudo }) => {
    expect(pseudoText(english)).toBe(pseudo)
  })

  it('keeps every i18next placeholder as it is and never accents it', () => {
    const text = 'Hello {{name}}, $t(common:ok, {"count": 1}) <0>bold</0> <b>x</b> <br/>'
    const value = pseudoText(text)

    for (const kept of ['{{name}}', '$t(common:ok, {"count": 1})', '<0>', '</0>', '<b>', '</b>', '<br/>']) {
      expect(value).toContain(kept)
    }
    expect(value).not.toContain('Hello')
  })

  it('grows the plain text by a third, placeholders not counted', () => {
    const text = 'Total {{count}} of {{max}} sold today'
    const inner = pseudoText(text).slice(1, -1)

    expect(plainLength(inner) - plainLength(text)).toBe(Math.ceil(0.35 * plainLength(text)))
  })

  it('leaves an empty value empty', () => {
    expect(pseudoText('')).toBe('')
  })

  it('is deterministic', () => {
    expect(pseudoText('Same text')).toBe(pseudoText('Same text'))
  })
})

describe('the en-XA generator', () => {
  it('keeps the keys, the plural suffixes and the nesting, and changes only the values', () => {
    const english = {
      title: 'Fixture',
      items_one: '{{count}} item',
      items_other: '{{count}} items',
      nested: { deep: 'Deep', empty: '' },
    }

    expect(generatePseudo(english)).toEqual({
      title: pseudoText('Fixture'),
      items_one: pseudoText('{{count}} item'),
      items_other: pseudoText('{{count}} items'),
      nested: { deep: pseudoText('Deep'), empty: '' },
    })
  })

  it.runIf(WRITE)('writes the committed en-XA files', () => {
    writePseudo(ENGLISH_DIR, PSEUDO_DIR)
  })

  it('writes one file per English file and removes one with no English file', () => {
    const english = folder({ 'sales.json': { a: 'One' }, 'common.json': { b: 'Two' } })
    const out = folder({ 'gone.json': { x: 'y' } })

    writePseudo(english, out)

    expect(readdirSync(out).sort()).toEqual(['common.json', 'sales.json'])
    expect(JSON.parse(readFileSync(join(out, 'sales.json'), 'utf8'))).toEqual({ a: pseudoText('One') })
  })

  it('creates the output folder when it does not exist', () => {
    const english = folder({ 'common.json': { b: 'Two' } })
    const out = join(mkdtempSync(join(tmpdir(), 'pseudo-')), 'en-XA')

    writePseudo(english, out)

    expect(readdirSync(out)).toEqual(['common.json'])
  })

  it('has a committed output that matches the English files', () => {
    expect(pseudoProblems(ENGLISH_DIR, PSEUDO_DIR)).toEqual([])
  })
})

describe('the en-XA staleness check', () => {
  it('is fresh when the files hold what the generator writes', () => {
    const english = folder({ 'common.json': { b: 'Two' } })
    const out = folder({ 'common.json': { b: pseudoText('Two') } })

    expect(pseudoProblems(english, out)).toEqual([])
  })

  it('compares parsed JSON, not bytes', () => {
    const english = folder({ 'common.json': { b: 'Two' } })
    const out = mkdtempSync(join(tmpdir(), 'pseudo-'))
    writeFileSync(join(out, 'common.json'), `{"b":${JSON.stringify(pseudoText('Two'))}}`)

    expect(pseudoProblems(english, out)).toEqual([])
  })

  it('is stale, naming the command, when a value was edited by hand', () => {
    const english = folder({ 'common.json': { b: 'Two' } })
    const out = folder({ 'common.json': { b: 'Two' } })

    const problems = pseudoProblems(english, out)

    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('common.json')
    expect(problems[0]).toContain(PSEUDO_COMMAND)
  })

  it('is stale when an English file has no en-XA file', () => {
    const english = folder({ 'common.json': { b: 'Two' }, 'sales.json': { a: 'One' } })
    const out = folder({ 'common.json': { b: pseudoText('Two') } })

    expect(pseudoProblems(english, out).join('\n')).toContain('sales.json')
  })

  it('is stale when an en-XA file has no English file', () => {
    const english = folder({ 'common.json': { b: 'Two' } })
    const out = folder({ 'common.json': { b: pseudoText('Two') }, 'old.json': {} })

    expect(pseudoProblems(english, out).join('\n')).toContain('old.json')
  })

  it('is stale when the output folder is missing and English has files', () => {
    const english = folder({ 'common.json': { b: 'Two' } })
    const missing = join(mkdtempSync(join(tmpdir(), 'pseudo-')), 'nope')
    mkdirSync(join(missing, '..'), { recursive: true })

    expect(pseudoProblems(english, missing).join('\n')).toContain('common.json')
  })
})
