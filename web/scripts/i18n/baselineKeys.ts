/**
 * The keyed baseline check. When a copy text moves to a locale key, its entry of
 * `src/copy/en.baseline.json` stays and a mapping in `src/copy/baselineKeys/<ns>.json` says
 * where it went: `{ "<baseline source>": { "key": "ns:path", "params"?: ["name", …], "fill"?: {"name": "text"} } }`.
 * `fill` is for a fragment (a baseline entry with no args) whose key holds placeholders.
 *
 * - Every `(source, args)` row of a mapped source renders `args[i]` into `params[i]` and must
 *   equal its baseline `text` in `en` (`mappingProblems`).
 * - Every committed entry is either still exported by a `.ts` copy module or mapped exactly
 *   once, never both and never neither; every entry the modules hold is in the committed
 *   baseline (`coverageProblems`).
 *
 * A function wrapped in `counted()` maps to a plural base with `count` among its params. A
 * function that branches on anything else is not mappable and stays in `.ts`.
 * Problems name the source, the row and the param, never a text.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PLACEHOLDERS } from '../../src/i18n/placeholders.ts'
import { resolveKey, type Bundle } from '../../src/i18n/resolve.ts'
import { collectEntries, renderEntry, type Entry, type Modules } from './baseline.ts'

export interface Mapping {
  key: string
  params?: string[]
  /** The placeholders of a fragment (a baseline text with no args): name to the text it is
   * filled with, so `Back to ` is proved equal to `Back to {{parent}}` filled with an empty text. */
  fill?: Record<string, string>
}

/** The mappings of one `baselineKeys/<ns>.json`, by baseline source. */
export type Mappings = Readonly<Record<string, Mapping>>

export interface MappingFile {
  file: string
  mappings: Mappings
}

export const MAPPINGS_DIR = join(import.meta.dirname, '../../src/copy/baselineKeys')

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** One mapping file, validated: an object of `{key, params?}`. */
export function parseMappings(file: string, raw: string): MappingFile {
  const parsed: unknown = JSON.parse(raw)
  if (!isRecord(parsed)) throw new Error(`${file}: is not an object of mappings`)
  const mappings: Record<string, Mapping> = {}
  for (const [source, item] of Object.entries(parsed)) {
    if (!isRecord(item) || typeof item['key'] !== 'string') throw new Error(`${file}: ${source} is not {key, params?}`)
    const params = item['params']
    const fill = item['fill']
    const mapping: Mapping = { key: item['key'] }
    if (params !== undefined) {
      if (!Array.isArray(params) || !params.every((param) => typeof param === 'string')) {
        throw new Error(`${file}: ${source} params is not a list of names`)
      }
      mapping.params = params.map(String)
    }
    if (fill !== undefined) {
      if (!isRecord(fill) || !Object.values(fill).every((text) => typeof text === 'string')) {
        throw new Error(`${file}: ${source} fill is not a record of texts`)
      }
      mapping.fill = Object.fromEntries(Object.entries(fill).map(([name, text]) => [name, String(text)]))
    }
    mappings[source] = mapping
  }
  return { file, mappings }
}

/** Every `*.json` of the folder, sorted; a missing folder holds none. */
export function loadMappingFiles(dir: string = MAPPINGS_DIR): MappingFile[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => parseMappings(name, readFileSync(join(dir, name), 'utf8')))
}

export interface MappedRow {
  source: string
  index: number
  key: string
  args: Record<string, string | number>
  text: string
}

const rowsOf = (committed: readonly Entry[], source: string): Entry[] => committed.filter((entry) => entry.source === source)

/** The baseline rows of every mapped source with their args named by `params`, and the
 * problems of the mapping's shape (the rows that have one are left out of `rows`). */
export function mappedRows(files: readonly MappingFile[], committed: readonly Entry[]): { rows: MappedRow[]; problems: string[] } {
  const rows: MappedRow[] = []
  const problems: string[] = []
  for (const { mappings } of files) {
    for (const [source, { key, params, fill }] of Object.entries(mappings)) {
      const entries = rowsOf(committed, source)
      if (entries.length === 0) {
        problems.push(`${source}: not in the baseline`)
        continue
      }
      if (entries.every((entry) => entry.args === null)) {
        const unknown = Object.keys(fill ?? {}).filter((name) => PLACEHOLDERS[name] === undefined)
        for (const name of unknown) problems.push(`${source}: the fill ${name} is not in PLACEHOLDERS`)
        if (params !== undefined) problems.push(`${source}: params on a key with no args`)
        else if (unknown.length === 0) entries.forEach((entry, index) => rows.push({ source, index, key, args: fill ?? {}, text: entry.text }))
        continue
      }
      if (fill !== undefined) {
        problems.push(`${source}: fill on a key with args`)
        continue
      }
      const names = params ?? []
      const unknown = names.filter((name) => PLACEHOLDERS[name] === undefined)
      for (const name of unknown) problems.push(`${source}: the param ${name} is not in PLACEHOLDERS`)
      if (unknown.length > 0) continue
      entries.forEach((entry, index) => {
        const values = entry.args ?? []
        if (values.length !== names.length) {
          problems.push(`${source} row ${index}: ${values.length} args against ${names.length} params`)
          return
        }
        const args: Record<string, string | number> = {}
        for (const [position, value] of values.entries()) {
          const name = names[position] ?? ''
          if (typeof value !== 'string' && typeof value !== 'number') {
            problems.push(`${source} row ${index}: argument ${position} is not a string or a number`)
            return
          }
          args[name] = value
        }
        rows.push({ source, index, key, args, text: entry.text })
      })
    }
  }
  return { rows, problems }
}

/** The mapping's own problems, then one per row that does not render its baseline text in `en`. */
export function mappingProblems(files: readonly MappingFile[], committed: readonly Entry[], en: Bundle): string[] {
  const { rows, problems } = mappedRows(files, committed)
  for (const { source, index, key, args, text } of rows) {
    try {
      if (resolveKey(en, key, args) !== text) problems.push(`${source} row ${index}: renders another text in en`)
    } catch (error) {
      problems.push(`${source} row ${index}: ${error instanceof Error ? error.message : 'cannot be resolved'}`)
    }
  }
  return problems.sort()
}

const identity = (entry: Entry): string => `${entry.source}\u0000${JSON.stringify(entry.args)}`

/** Each committed source is exported by a `.ts` module or mapped exactly once, never both and
 * never neither; each entry the modules hold is in the committed baseline. */
export function coverageProblems(modules: Modules, committed: readonly Entry[], files: readonly MappingFile[]): string[] {
  const problems: string[] = []
  const first = new Map<string, Entry>()
  for (const entry of committed) if (!first.has(entry.source)) first.set(entry.source, entry)
  for (const [source, entry] of first) {
    const mapped = files.filter((file) => Object.hasOwn(file.mappings, source)).length
    const exported = renderEntry(modules, entry) !== undefined
    if (mapped > 1) problems.push(`${source}: mapped ${mapped} times`)
    else if (exported && mapped === 1) problems.push(`${source}: both exported and mapped`)
    else if (!exported && mapped === 0) problems.push(`${source}: neither exported nor mapped`)
  }
  const known = new Set(committed.map(identity))
  for (const entry of collectEntries(modules)) {
    if (!known.has(identity(entry))) problems.push(`${entry.source}: not in the committed baseline`)
  }
  return problems.sort()
}
