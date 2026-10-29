import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ENGLISH_DIR } from './resourceTypes.ts'

const LOCALES_DIR = join(ENGLISH_DIR, '..')

/** The test locale and English are never reported: English is the source, en-XA is derived. */
const NOT_REPORTED: readonly string[] = ['en', 'en-XA']

export type Missing = { readonly locale: string; readonly keys: readonly string[] }

type Tree = { readonly [key: string]: unknown }

function readTree(path: string): Tree {
  if (!existsSync(path)) return {}
  return JSON.parse(readFileSync(path, 'utf8')) as Tree
}

/** The `a.b` path of every string leaf of a tree, with its value. */
function leaves(tree: Tree, prefix = ''): readonly (readonly [string, string])[] {
  return Object.entries(tree).flatMap(([key, value]): (readonly [string, string])[] => {
    if (typeof value === 'string') return [[`${prefix}${key}`, value]]
    if (typeof value === 'object' && value !== null) return [...leaves(value as Tree, `${prefix}${key}.`)]
    return []
  })
}

function jsonFiles(dir: string): readonly string[] {
  return readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .sort()
}

/**
 * For every locale folder but `en` and `en-XA`, the English keys (as `ns:key`) that are
 * absent or empty there. Keys only: a value is never read into the result.
 */
export function missingKeys(localesDir: string = LOCALES_DIR): readonly Missing[] {
  const englishDir = join(localesDir, 'en')
  const english = existsSync(englishDir) ? jsonFiles(englishDir) : []
  const tags = readdirSync(localesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !NOT_REPORTED.includes(entry.name))
    .map((entry) => entry.name)
    .sort()
  return tags.map((locale) => {
    const keys = english.flatMap((file) => {
      const have = new Map(leaves(readTree(join(localesDir, locale, file))))
      const ns = file.slice(0, -'.json'.length)
      return leaves(readTree(join(englishDir, file)))
        .filter(([key]) => (have.get(key) ?? '') === '')
        .map(([key]) => `${ns}:${key}`)
    })
    return { locale, keys: keys.sort() }
  })
}

/** The report as lines: `tag: N missing`, then each key indented. */
export function formatReport(report: readonly Missing[]): readonly string[] {
  return report.flatMap(({ locale, keys }) => [
    `${locale}: ${keys.length} missing`,
    ...keys.map((key) => `  ${key}`),
  ])
}

/** Prints the report through `print` and returns the exit code, which is always 0. */
export function runReport(
  localesDir: string = LOCALES_DIR,
  print: (line: string) => void = console.log,
): 0 {
  for (const line of formatReport(missingKeys(localesDir))) print(line)
  return 0
}
