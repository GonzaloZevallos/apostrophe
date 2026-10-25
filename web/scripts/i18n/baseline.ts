/**
 * The English baseline: every text of today's `.ts` copy files, recorded as it is, in
 * `src/copy/en.baseline.json`. A text that later moves to a locale key must equal its
 * entry here (invariant 10), so the file is written once and then only checked or
 * updated by this script, never by hand.
 *
 * Each entry is `{source, args, text}`: `source` is `<file>:<path>`, `args` the tuple a
 * function was called with (null for a string), `text` what it returned. Functions are
 * called with the rows of their file's `BASELINE_ARGS` (`src/copy/baselineArgs.ts`).
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'

/** The copy modules by file name (`stock.ts`), as `import.meta.glob` hands them over. */
export type Modules = Readonly<Record<string, Readonly<Record<string, unknown>>>>

export interface Entry {
  source: string
  args: unknown[] | null
  text: string
}

export type Mode = 'default' | 'update'

/** `limits.ts` is the length checker, not copy; the three names below are registries of
 * the files that hold the copy, which the baseline reads but does not record. */
const SKIPPED_FILES: ReadonlySet<string> = new Set(['limits.ts'])
const SKIPPED_EXPORTS: ReadonlySet<string> = new Set(['LIMITED_COPY', 'LONG_REFUSALS', 'BASELINE_ARGS'])

/** JSON has no `undefined`: it is written as this object so it stays apart from `null`. */
const UNDEFINED_MARK = { $undefined: true }

type Rows = readonly (readonly unknown[])[]

export interface CopyFunction {
  source: string
  fn: (...args: unknown[]) => unknown
  rows: Rows
}

interface Walked {
  texts: { source: string; text: string }[]
  functions: CopyFunction[]
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false
  const proto: unknown = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

/** A key as the end of a path: `.key`, or `["a.b"]` (JSON-quoted) when the key would read as
 * more than one step, like the refusal codes of `REFUSAL_BY_CODE`. */
function segment(key: string): string {
  return /^[^.[\]"]+$/.test(key) ? `.${key}` : `[${JSON.stringify(key)}]`
}

/** The keys a path walks through, inverse of `segment` and of the `[index]` of arrays. */
function steps(path: string): string[] {
  const found = [...path.matchAll(/\[("(?:[^"\\]|\\.)*")\]|\[(\d+)\]|\.?([^.[\]]+)/g)]
  return found.map(([, quoted, index, name]) => (quoted !== undefined ? (JSON.parse(quoted) as string) : (index ?? name ?? '')))
}

function isRows(value: unknown): value is Rows {
  return Array.isArray(value) && value.every((row) => Array.isArray(row))
}

/** Every string and function of the modules, by source. Stops, naming the export path, on
 * a function with no row, a row naming no function, or an export that is not copy. */
export function walkModules(modules: Modules): Walked {
  const walked: Walked = { texts: [], functions: [] }
  for (const [file, mod] of Object.entries(modules)) {
    if (SKIPPED_FILES.has(file)) continue
    const table: unknown = mod['BASELINE_ARGS'] ?? {}
    if (!isPlainObject(table)) throw new Error(`${file}:BASELINE_ARGS is not a table of rows`)
    const used = new Set<string>()
    const visit = (path: string, value: unknown): void => {
      const source = `${file}:${path}`
      if (typeof value === 'string') walked.texts.push({ source, text: value })
      else if (typeof value === 'function') {
        const rows = table[path]
        if (!isRows(rows) || rows.length === 0) throw new Error(`${source}: a function with no BASELINE_ARGS row`)
        used.add(path)
        walked.functions.push({ source, fn: value as CopyFunction['fn'], rows })
      } else if (Array.isArray(value)) value.forEach((item, index) => visit(`${path}[${index}]`, item))
      else if (isPlainObject(value)) {
        for (const [key, item] of Object.entries(value)) {
          visit(`${path}${segment(key)}`, item)
        }
      } else throw new Error(`${source}: an export of kind ${value === null ? 'null' : typeof value} is not copy`)
    }
    for (const [name, value] of Object.entries(mod)) {
      if (!SKIPPED_EXPORTS.has(name)) visit(name, value)
    }
    for (const path of Object.keys(table)) {
      if (!used.has(path)) throw new Error(`${file}:${path}: a BASELINE_ARGS row for something that is not a function`)
    }
  }
  return walked
}

/** The text of a function called with `args`; stops, naming the source, if it throws or
 * answers something that is not a string. */
export function callCopy(source: string, fn: CopyFunction['fn'], args: readonly unknown[]): string {
  let text: unknown
  try {
    text = fn(...args)
  } catch (error) {
    throw new Error(`${source}: the call threw (${error instanceof Error ? error.message : 'not an Error'})`)
  }
  if (typeof text !== 'string') throw new Error(`${source}: the call returned a ${typeof text}, not a string`)
  return text
}

/** Arguments as JSON: strings, finite numbers, booleans, null, `undefined` (marked),
 * arrays and plain objects. Anything else stops, naming the source. */
function encodeValue(source: string, value: unknown): unknown {
  if (value === undefined) return UNDEFINED_MARK
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (Array.isArray(value)) return value.map((item) => encodeValue(source, item))
  if (isPlainObject(value)) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encodeValue(source, v)]))
  throw new Error(`${source}: an argument of kind ${typeof value} cannot be recorded as JSON`)
}

export function decodeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decodeValue)
  if (isPlainObject(value)) {
    if (JSON.stringify(value) === JSON.stringify(UNDEFINED_MARK)) return undefined
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, decodeValue(v)]))
  }
  return value
}

const identity = (entry: Entry): string => `${entry.source}\u0000${JSON.stringify(entry.args)}`

function sortEntries(entries: Entry[]): Entry[] {
  return entries.sort((a, b) => {
    if (a.source !== b.source) return a.source < b.source ? -1 : 1
    const [x, y] = [JSON.stringify(a.args), JSON.stringify(b.args)]
    return x === y ? 0 : x < y ? -1 : 1
  })
}

/** Every entry of today's copy, sorted. */
export function collectEntries(modules: Modules): Entry[] {
  const { texts, functions } = walkModules(modules)
  const entries: Entry[] = texts.map(({ source, text }) => ({ source, args: null, text }))
  for (const { source, fn, rows } of functions) {
    for (const row of rows) {
      const args = encodeValue(source, [...row])
      entries.push({ source, args: args as unknown[], text: callCopy(source, fn, row) })
    }
  }
  const seen = new Set<string>()
  for (const entry of entries) {
    if (seen.has(identity(entry))) throw new Error(`${entry.source}: two rows call it with the same arguments`)
    seen.add(identity(entry))
  }
  return sortEntries(entries)
}

/** The committed file, validated: an array of `{source, args, text}`. */
export function parseBaseline(raw: string): Entry[] {
  const parsed: unknown = JSON.parse(raw)
  if (!Array.isArray(parsed)) throw new Error('en.baseline.json is not an array')
  return parsed.map((item: unknown, index) => {
    if (!isPlainObject(item)) throw new Error(`en.baseline.json[${index}] is not an entry`)
    const { source, args, text } = item
    if (typeof source !== 'string' || typeof text !== 'string' || !(args === null || Array.isArray(args))) {
      throw new Error(`en.baseline.json[${index}] is not {source, args, text}`)
    }
    return { source, args: args as unknown[] | null, text }
  })
}

/** One entry per line, so a reworded text is one changed line in a diff. */
export function serialize(entries: readonly Entry[]): string {
  return `[\n${entries.map((entry) => `  ${JSON.stringify(entry)}`).join(',\n')}\n]\n`
}

type Found = { kind: 'string'; text: string } | { kind: 'function'; fn: CopyFunction['fn'] } | undefined

/** What a source points at in the modules now, or undefined when it no longer exists. */
function resolve(modules: Modules, source: string): Found {
  const colon = source.indexOf(':')
  const mod = modules[source.slice(0, colon)]
  const path = source.slice(colon + 1)
  if (mod === undefined || SKIPPED_EXPORTS.has(path.split(/[.[]/)[0] ?? '')) return undefined
  let value: unknown = mod
  for (const token of steps(path)) {
    if (typeof value !== 'object' || value === null || !Object.hasOwn(value, token)) return undefined
    value = (value as Record<string, unknown>)[token]
  }
  if (typeof value === 'string') return { kind: 'string', text: value }
  if (typeof value === 'function') return { kind: 'function', fn: value as CopyFunction['fn'] }
  return undefined
}

/** What an entry renders now: its text, or undefined when its source no longer exists
 * (the text moved). Stops if the source changed from a string to a function or back. */
export function renderEntry(modules: Modules, entry: Entry): string | undefined {
  const found = resolve(modules, entry.source)
  if (found === undefined) return undefined
  if (found.kind === 'string') {
    if (entry.args !== null) throw new Error(`${entry.source}: recorded as a function, now a string`)
    return found.text
  }
  if (entry.args === null) throw new Error(`${entry.source}: recorded as a string, now a function`)
  return callCopy(entry.source, found.fn, decodeValue(entry.args) as unknown[])
}

/** One sentence per committed entry whose export still exists and renders another text.
 * Names the source and arguments, never the text. */
export function driftProblems(modules: Modules, committed: readonly Entry[]): string[] {
  const problems: string[] = []
  for (const entry of committed) {
    const now = renderEntry(modules, entry)
    if (now !== undefined && now !== entry.text) {
      problems.push(`${entry.source}${entry.args === null ? '' : ` ${JSON.stringify(entry.args)}`}: no longer renders its baseline text`)
    }
  }
  return problems
}

/** The committed entries with `text` rewritten for those whose source still exists. Never
 * deletes an entry and never adds one. */
export function updatedEntries(modules: Modules, committed: readonly Entry[]): Entry[] {
  return committed.map((entry) => ({ ...entry, text: renderEntry(modules, entry) ?? entry.text }))
}

export interface RunOptions {
  modules: Modules
  file: string
  mode: Mode
}

export interface RunResult {
  action: 'wrote' | 'updated' | 'checked'
  problems: string[]
}

/** The script: writes the file when it does not exist; with `update` rewrites the texts
 * of the entries whose source still exists; otherwise checks the file against the copy. */
export function runBaseline({ modules, file, mode }: RunOptions): RunResult {
  const current = collectEntries(modules)
  if (!existsSync(file)) {
    writeFileSync(file, serialize(current))
    return { action: 'wrote', problems: [] }
  }
  const committed = parseBaseline(readFileSync(file, 'utf8'))
  if (mode === 'update') {
    const updated = updatedEntries(modules, committed)
    if (JSON.stringify(updated) !== JSON.stringify(committed)) writeFileSync(file, serialize(updated))
    return { action: 'updated', problems: [] }
  }
  return { action: 'checked', problems: driftProblems(modules, committed) }
}

