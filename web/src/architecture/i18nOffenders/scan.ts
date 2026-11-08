/**
 * The one scan the i18n offender lists and their tests share (GH-379 part 2, ADR-0049): what is
 * scanned (`SCANNED`), the copy modules, the probe and the English bundle are defined here and
 * nowhere else. `computeCopyExportsText` and `computeCopyImports` derive the two lists from the
 * tree; `listProblems` and `serializeList` judge and write them.
 */

import { loadBundle } from '../../../scripts/i18n/loadBundle.ts'
import { wordsOf } from '../../design/copyTexts'
import { findCopyImports } from '../copyOnly'
import { COPY_OWNER, KEYS_ONLY, NO_OWNER_REASON } from './owners'

/** The files whose imports of copy words are judged: `.ts` and `.tsx`, by suffix, minus tests and fixtures folders. */
export const SCANNED = {
  roots: ['screens', 'shell', 'components'],
  suffixes: ['.ts', '.tsx'],
  excludedSuffixes: ['.test.ts', '.test.tsx'],
  excludedFolder: 'fixtures',
} as const

export function isScanned(path: string): boolean {
  const parts = path.split('/')
  return (
    parts[0] === '' &&
    parts[1] === 'src' &&
    (SCANNED.roots as readonly (string | undefined)[]).includes(parts[2]) &&
    SCANNED.suffixes.some((suffix) => path.endsWith(suffix)) &&
    !SCANNED.excludedSuffixes.some((suffix) => path.endsWith(suffix)) &&
    !parts.slice(0, -1).includes(SCANNED.excludedFolder)
  )
}

const sourceLoaders = import.meta.glob('/src/**/*.{ts,tsx}', { query: '?raw', import: 'default' })

/** The source of every scanned file, by `/src/...` path. */
export async function scannedSources(): Promise<Record<string, string>> {
  const paths = Object.keys(sourceLoaders).filter(isScanned).sort()
  const sources = await Promise.all(paths.map(async (path) => String(await sourceLoaders[path]?.())))
  return Object.fromEntries(paths.map((path, index) => [path, sources[index] ?? '']))
}

const copyGlob = import.meta.glob<Record<string, unknown>>(['/src/copy/*.ts', '!/src/copy/*.test.ts', '!/src/copy/limits.ts', '!/src/copy/baselineArgs.ts'], { eager: true })

/** The copy modules, by file name (`sales.ts`). */
export function copyModules(): Record<string, Record<string, unknown>> {
  return Object.fromEntries(Object.entries(copyGlob).map(([path, mod]) => [path.slice('/src/copy/'.length), mod]))
}

/** The word every hole of a function is filled with; it is not shaped like a key. */
export const PROBE = 'x'

export const en = loadBundle('en')

export interface ExportsEntry {
  file: string
  issue: number | null
  reason?: string
}

export interface ImportsEntry {
  file: string
  imports: string[]
  issue: number | null
}

const wordsByFile = new Map<string, ReturnType<typeof wordsOf>>()

function wordsIn(file: string): ReturnType<typeof wordsOf> {
  let found = wordsByFile.get(file)
  if (found === undefined) {
    found = wordsOf(file, copyModules()[file] ?? {}, PROBE, en)
    wordsByFile.set(file, found)
  }
  return found
}

/** Every `wordsOf` finding over the copy modules, sorted. */
export function copyFindings(): string[] {
  return Object.keys(copyModules()).flatMap((file) => wordsIn(file).findings).sort()
}

/** The exported names of `file` that hold words. */
function exportsWithWords(file: string): Set<string> {
  return new Set([...wordsIn(file).words.keys()].map((key) => key.slice(file.length + 1).split('.')[0] ?? ''))
}

function issueOf(file: string): number | null {
  const owner = COPY_OWNER[file]
  return owner === undefined || owner === 'none' ? null : owner
}

/** The copy files that hold words of their own, sorted by file. */
export function computeCopyExportsText(): ExportsEntry[] {
  return Object.keys(copyModules())
    .filter((file) => !KEYS_ONLY.includes(file) && wordsIn(file).words.size > 0)
    .sort()
    .map((file) => {
      const issue = issueOf(file)
      return issue === null ? { file, issue, reason: NO_OWNER_REASON[file] ?? '' } : { file, issue }
    })
}

/** The scanned files that import copy words, one entry per file and owner, sorted. */
export async function computeCopyImports(): Promise<ImportsEntry[]> {
  const entries: ImportsEntry[] = []
  for (const [path, source] of Object.entries(await scannedSources())) {
    const owned = new Map<number, Set<string>>()
    for (const { copyFile, names } of findCopyImports(source, path.endsWith('.tsx') ? 'tsx' : 'ts')) {
      const issue = issueOf(copyFile)
      if (issue === null || !(copyFile in copyModules())) continue
      const used = exportsWithWords(copyFile)
      if (names === '*' ? used.size === 0 : !names.some((name) => used.has(name))) continue
      owned.set(issue, (owned.get(issue) ?? new Set()).add(copyFile))
    }
    for (const [issue, files] of owned) entries.push({ file: path.slice(1), imports: [...files].sort(), issue })
  }
  const order = (entry: ImportsEntry): string => `${entry.file}\u0000${entry.imports.join(',')}`
  return entries.sort((a, b) => (order(a) < order(b) ? -1 : order(a) > order(b) ? 1 : 0))
}

type Entry = ExportsEntry | ImportsEntry

const keyOf = (entry: Entry): string => ('imports' in entry ? `${entry.file}\u0000${entry.imports.join(',')}` : entry.file)
const nameOf = (entry: Entry): string => ('imports' in entry ? `${entry.file} [${entry.imports.join(',')}]` : entry.file)
const lineOf = (entry: Entry): string => JSON.stringify(entry)

/**
 * What differs between the `recorded` list and the `computed` one: an offender with no entry, a
 * stale entry (a deleted file included), an issue that is not the owner's, a null issue anywhere
 * but `common.ts`. Each line names the entry to add, remove or fix.
 */
export function listProblems(recorded: readonly Entry[], computed: readonly Entry[]): string[] {
  const problems: string[] = []
  const have = new Map(computed.map((entry) => [keyOf(entry), entry]))
  for (const entry of recorded) {
    if (entry.issue === null && entry.file !== 'common.ts') problems.push(`null issue: ${lineOf(entry)}`)
    const expected = have.get(keyOf(entry))
    if (expected === undefined) problems.push(`stale entry: ${lineOf(entry)}`)
    else if (expected.issue !== entry.issue) problems.push(`wrong issue: ${nameOf(entry)} has ${entry.issue} but COPY_OWNER says ${expected.issue}`)
  }
  const seen = new Set(recorded.map(keyOf))
  for (const entry of computed) if (!seen.has(keyOf(entry))) problems.push(`missing entry: ${lineOf(entry)}`)
  return problems
}

/** A list as the JSON files hold it: one entry per line, two-space indent, trailing newline. */
export function serializeList(entries: readonly Entry[]): string {
  return entries.length === 0 ? '[]\n' : `[\n${entries.map((entry) => `  ${lineOf(entry)}`).join(',\n')}\n]\n`
}
