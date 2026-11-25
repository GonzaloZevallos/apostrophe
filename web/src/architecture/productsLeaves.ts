/**
 * Two scans over the Products phone leaves (`screens/varieties/ProductsPhoneBodies`,
 * `productsSegment`):
 *
 *   1. nothing the computer layout reaches (`ProductsComputer.tsx` and every file its relative
 *      imports lead to) imports `productsSegment`: only `ProductsPhone` reads the segment;
 *   2. every `front-exclude.json` pattern naming a `src/screens/varieties/` module still matches a
 *      file only excluded files import: a module that gets wired into a screen leaves the list in
 *      the same diff, so a stale entry is found here.
 */

import { posix } from 'node:path'
import type { Source } from './productsFiles'

const IMPORT = /(?:^[ \t]*(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\sfrom\s+)?|\bimport\s*\(\s*)['"]([^'"]+)['"]/gm
const SUFFIXES = ['', '.ts', '.tsx', '/index.ts', '/index.tsx']
const COMPUTER_ENTRY = 'src/screens/varieties/ProductsComputer.tsx'
const SEGMENT_MODULE = /(?:^|\/)productsSegment$/
const VARIETIES_PATTERN = /src\/screens\/varieties\//

/** `from` joined with a relative `module`, `..` and `.` resolved; null when it leaves `src/`. */
function join(from: string, module: string): string | null {
  const resolved = posix.join(posix.dirname(from), module)
  return resolved.startsWith('src/') ? resolved : null
}

/** The modules a file imports, as written. */
function importsOf(content: string): string[] {
  return [...content.matchAll(IMPORT)].map((match) => match[1] ?? '')
}

/** The source files `path` imports through relative specifiers (the ones that exist in `files`). */
function relativeImports(path: string, files: Map<string, string>): string[] {
  const found: string[] = []
  for (const module of importsOf(files.get(path) ?? '')) {
    if (!module.startsWith('.')) continue
    const base = join(path, module)
    if (base === null) continue
    const target = SUFFIXES.map((suffix) => `${base}${suffix}`).find((candidate) => files.has(candidate))
    if (target !== undefined) found.push(target)
  }
  return found
}

/** One line per file the computer layout reaches that imports `productsSegment`. */
export function findComputerSegmentImports(sources: Source[], entry = COMPUTER_ENTRY): string[] {
  const files = new Map(sources.map(({ path, content }) => [path, content]))
  const seen = new Set<string>()
  const queue = [entry]
  const out: string[] = []
  for (let path = queue.pop(); path !== undefined; path = queue.pop()) {
    if (seen.has(path)) continue
    seen.add(path)
    if (importsOf(files.get(path) ?? '').some((module) => SEGMENT_MODULE.test(module))) {
      out.push(`${path}: imports productsSegment, reached from ${entry}; only ProductsPhone reads the segment`)
    }
    queue.push(...relativeImports(path, files))
  }
  return out
}

/** One line per `front-exclude` pattern that names a varieties module and no longer holds. */
export function findStaleExclusions(sources: Source[], patterns: string[]): string[] {
  const files = new Map(sources.map(({ path, content }) => [path, content]))
  const excluded = patterns.map((pattern) => new RegExp(pattern))
  const isExcluded = (path: string) => excluded.some((pattern) => pattern.test(path))
  const importers = new Map<string, string[]>()
  for (const { path } of sources) {
    for (const target of relativeImports(path, files)) importers.set(target, [...(importers.get(target) ?? []), path])
  }
  const out: string[] = []
  for (const pattern of patterns) {
    if (!VARIETIES_PATTERN.test(pattern)) continue
    const regex = new RegExp(pattern)
    const matches = sources.filter(({ path }) => regex.test(path))
    if (matches.length === 0) {
      out.push(`${pattern}: matches no file; remove the entry`)
      continue
    }
    for (const { path } of matches) {
      const wired = (importers.get(path) ?? []).filter((importer) => !isExcluded(importer))
      if (wired.length > 0) out.push(`${pattern}: ${path} is imported by ${wired.join(', ')}; remove the entry`)
    }
  }
  return out
}
