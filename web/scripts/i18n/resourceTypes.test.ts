import { readFileSync, writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  TYPES_COMMAND,
  TYPES_PATH,
  englishNamespaces,
  renderResourceTypes,
  stalenessProblem,
} from './resourceTypes.ts'

const WRITE = process.env['I18N_TYPES_WRITE'] === '1'

describe('the resource types writer', () => {
  it.runIf(WRITE)('writes the committed types file', () => {
    writeFileSync(TYPES_PATH, renderResourceTypes(englishNamespaces()))
  })

  it('renders one sorted line per English file', () => {
    const text = renderResourceTypes(['sales', 'common'])
    const lines = text.split('\n').filter((line) => line.includes('typeof import'))

    expect(lines).toEqual([
      `  "common": typeof import('../copy/locales/en/common.json')`,
      `  "sales": typeof import('../copy/locales/en/sales.json')`,
    ])
    expect(text).toContain('export type CopyKey = KeysOf<Resources>')
    expect(text).toContain('interface CustomTypeOptions')
  })

  it('renders an empty resource set when the folder is empty', () => {
    expect(renderResourceTypes([])).toContain('export type Resources = {}')
  })

  it('is stale when a file is in the folder and not in the committed text', () => {
    const committed = renderResourceTypes(['common'])

    expect(stalenessProblem(committed, ['common', 'sales'])).toContain(TYPES_COMMAND)
    expect(stalenessProblem(committed, [])).toContain(TYPES_COMMAND)
  })

  it('is stale when the committed text was edited by hand', () => {
    const edited = `${renderResourceTypes(['common'])}// hand edit\n`

    expect(stalenessProblem(edited, ['common'])).toContain(TYPES_COMMAND)
  })

  it('is fresh when the committed text matches the folder', () => {
    expect(stalenessProblem(renderResourceTypes(['common']), ['common'])).toBeNull()
  })

  it('has a committed types file that matches src/copy/locales/en', () => {
    const problem = stalenessProblem(readFileSync(TYPES_PATH, 'utf8'), englishNamespaces())

    expect(problem).toBeNull()
  })
})
