import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { formatProblems, i18nGuard } from './i18nGuard.ts'

const SRC = join(import.meta.dirname, '..', '..', 'src')

/** A src folder written at run time: the fixtures are template strings, never source files. */
function src(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'i18n-guard-'))
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, file)), { recursive: true })
    writeFileSync(join(root, file), text)
  }
  return root
}

describe('the i18n guard over web/src', () => {
  it('finds nothing in the front', () => {
    expect(formatProblems(i18nGuard(SRC))).toEqual([])
  })
})

describe('the i18n guard over a fixture folder', () => {
  it('rejects a t() call at module top level, naming file and line', () => {
    const root = src({
      'copy/top.ts': `import { t } from './tools'\n\nexport const TITLE = t('shell:customer')\n`,
    })

    expect(formatProblems(i18nGuard(root))).toEqual([
      'copy/top.ts:3: t() at module top level: hold the key and resolve it where it renders',
    ])
  })

  it('accepts t() inside a function body', () => {
    const root = src({
      'copy/inside.ts': `export function title(t: (key: string) => string) {\n  return t('shell:customer')\n}\nexport const arrow = (t: (key: string) => string) => t('shell:customer')\n`,
    })

    expect(i18nGuard(root)).toEqual([])
  })

  it('rejects a value import of the instance, by folder and by package', () => {
    const root = src({
      'a/uses.ts': `import i18n from '../i18n'\n\nexport const lang = () => i18n.language\n`,
      'b/uses.ts': `import i18n from 'i18next'\n\nexport const lang = () => i18n.language\n`,
      'i18n/index.ts': `export default {}\n`,
    })

    expect(formatProblems(i18nGuard(root))).toEqual([
      'a/uses.ts:1: imports the i18next instance: take t from useTranslation',
      'b/uses.ts:1: imports the i18next instance: take t from useTranslation',
    ])
  })

  it('accepts a bare side-effect import of the instance and a type-only import', () => {
    const root = src({
      'main.tsx': `import './i18n'\n`,
      'types.ts': `import type { TFunction } from 'i18next'\nimport { type TOptions } from 'i18next'\n\nexport type Both = [TFunction, TOptions]\n`,
      'i18n/index.ts': `export default {}\n`,
    })

    expect(i18nGuard(root)).toEqual([])
  })

  it('rejects a top-level i18n.t(...) in an object literal and in a class field', () => {
    const root = src({
      'holder.ts': `declare const i18n: { t(key: string): string }\n\nexport const HOLDER = {\n  title: i18n.t('shell:customer'),\n}\n\nexport class Box {\n  label = i18n.t('shell:customer')\n}\n`,
    })

    expect(formatProblems(i18nGuard(root))).toEqual([
      'holder.ts:4: .t() at module top level: hold the key and resolve it where it renders',
      'holder.ts:8: .t() at module top level: hold the key and resolve it where it renders',
    ])
  })

  it('rejects a top-level resolveKey in an ordinary path and accepts it in mobile-standard', () => {
    const root = src({
      'screens/holder.ts': `import { resolveKey } from '../i18n/resolve'\n\nexport const TITLE = resolveKey('shell:customer')\n`,
      'screens/lazy.ts': `import { resolveKey } from '../i18n/resolve'\n\nexport const title = () => resolveKey('shell:customer')\n`,
      'mobile-standard/walk.ts': `import { resolveKey } from '../i18n/resolve'\n\nexport const TITLE = resolveKey('shell:customer')\n`,
      'i18n/resolve.ts': `export const resolveKey = (key: string) => key\n`,
    })

    expect(formatProblems(i18nGuard(root))).toEqual([
      'screens/holder.ts:3: resolveKey() at module top level outside mobile-standard/: hold the key and resolve it where it renders',
    ])
  })

  it('rejects an import of mobile-standard/copy.ts from outside mobile-standard', () => {
    const root = src({
      'screens/reads.ts': `import { copy } from '../mobile-standard/copy'\n\nexport const x = () => copy\n`,
      'mobile-standard/states.ts': `import { copy } from './copy'\n\nexport const x = () => copy\n`,
      'mobile-standard/copy.ts': `export const copy = 1\n`,
    })

    expect(formatProblems(i18nGuard(root))).toEqual([
      'screens/reads.ts:1: imports mobile-standard/copy.ts: only the mobile walk reads English once',
    ])
  })

  it('leaves the i18n folder alone', () => {
    const root = src({
      'i18n/index.ts': `import i18n from 'i18next'\n\nexport const ready = i18n.t('shell:customer')\n`,
    })

    expect(i18nGuard(root)).toEqual([])
  })
})
