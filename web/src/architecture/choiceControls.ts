/**
 * The choice-controls guard (GH-581 part 2, ADR-0074). `web/src/components/fixedSets.ts` is the
 * one registry of the sets that may render as chips; a set there must be fixed for good, so the
 * module may import only from `src/copy/` and the `NombreIcono` type. An import of anything
 * under `api/`, a hook, a query library or a settings module would let a set be read from the
 * business's data, which is the one thing a fixed set is not. A violation is `file:line`, never
 * a silent skip.
 *
 * It is a reader of source text, like `controlScan`: comments are masked with `controlScan`'s
 * `mask`, every import form is found (static, `import type`, side-effect, `export … from`,
 * `export * from`, dynamic `import()`, `require()`, and `import.meta`), a relative specifier is
 * resolved with `controlScan`'s `relativePath` (so `../copy/../api/x` is `src/api/x` before it is
 * judged), and whatever cannot be classified fails closed.
 *
 * Allowed: a target under `src/copy/`, and exactly `import type { NombreIcono } from './Icono'`.
 * Everything else fails, a value import from `./Icono` and an inline `{ type NombreIcono }`
 * included. Only direct imports are checked, on purpose: a `src/copy/` module that reached for
 * the network would be caught by the copy guards, not here.
 *
 * The call-site rules (GH-581 part 7) read every product `.ts`/`.tsx` the same way and fail the
 * same way, `file:line` and why, whatever they cannot read included:
 *
 * 1. `role="radio"`, `role="tab"`, `aria-pressed` and the chip class tokens `pildora`,
 *    `selector-pago__opcion` and `ajustes-tema__opcion` (each with its `--modifier`) appear only
 *    in `SegmentedChoice.tsx`, `Pestanas.tsx` and the files of `RAW_CHIP_SITES`. A `role={…}`
 *    counts as well unless every value it can take is readable and is neither `radio` nor `tab`.
 *    In a raw site every such marker sits inside a `.map` whose receiver is exactly the set
 *    registered for that file, imported from `components/fixedSets`, or a direct `.filter` of it.
 *    A spread, a call result, a local array, a prop or no enclosing `.map` fails.
 * 2. No native `<select>` element in product sources.
 *
 * Limits, left to review (`DESIGN_STANDARDS.md`): a class name built in a variable away from the
 * markup, and a data-mapped list of plain buttons with no role, pressed state or chip class.
 */

import { mask, relativePath, type SourceFile } from './controlScan'
import { RAW_CHIP_SITES, type RawChipSite } from '../components/fixedSets'

export interface ImportViolation {
  path: string
  line: number
  specifier: string
  reason: string
}

const COPY_ROOT = 'src/copy/'
const ICON_MODULE = 'src/components/Icono'
const ICON_TYPE_IMPORT = 'import type { NombreIcono }'

/** `src/components/fixedSets.ts`, the file this guard reads, as `fixedSetImportViolations` takes it. */
export function fixedSetsSources(): SourceFile[] {
  const modules = import.meta.glob('/src/components/fixedSets.ts', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>
  return Object.entries(modules).map(([path, source]) => ({
    path: path.replace(/^\//, ''),
    source,
  }))
}

function lineAt(source: string, index: number): number {
  return source.slice(0, index).split('\n').length
}

/** What an import statement points at: a relative specifier resolved, a bare one as written. */
function targetOf(path: string, specifier: string): string {
  return specifier.startsWith('.') ? relativePath(path, specifier) : specifier
}

interface Found {
  index: number
  /** The statement's clause (`import type { X }`), or '' when it has none. */
  clause: string
  /** The module named, or null when the form names none that can be read. */
  specifier: string | null
  /** Shown with `reason` when `specifier` is null. */
  shown: string
  reason: string
}

const QUOTED = String.raw`(?<quote>['"])(?<spec>[^'"\n]*)\k<quote>`
const OPENS_CALL = /^\s*\(/

const REEXPORT = new RegExp(
  String.raw`^\s*(?:type\s+)?(\{[^}]*\}|\*(?:\s+as\s+[\w$]+)?)\s*(?:from\s*${QUOTED})?`,
)
const CALL_WITH_LITERAL = new RegExp(String.raw`^\s*\(\s*${QUOTED}\s*\)`)
const SIDE_EFFECT = new RegExp(String.raw`^\s*${QUOTED}`)
const STATEMENT = new RegExp(String.raw`^\s*([^'"\`;]*?)\s*\bfrom\s*${QUOTED}`)

function unreadable(index: number, shown: string, reason: string): Found {
  return { index, clause: '', specifier: null, shown, reason }
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/** The form that starts with `keyword` at `index`, or null when it is not an import at all. */
function readForm(keyword: string, index: number, rest: string): Found | null {
  if (keyword === 'export') {
    const reexport = REEXPORT.exec(rest)
    if (reexport === null) return null
    const names = oneLine(reexport[1] ?? '')
    if (reexport.groups?.spec !== undefined) {
      return { index, clause: `export ${names}`, specifier: reexport.groups.spec, shown: '', reason: '' }
    }
    // `export { a }` re-exports nothing; `export *` with no source cannot be read.
    return names.startsWith('*') ? unreadable(index, `export ${names}`, 'fixedSets.ts has an export that cannot be read') : null
  }
  if (OPENS_CALL.test(rest)) {
    const literal = CALL_WITH_LITERAL.exec(rest)
    if (literal !== null) return { index, clause: '', specifier: literal.groups?.spec ?? '', shown: '', reason: '' }
    const argument = oneLine(/^\s*\(([^)]*)/.exec(rest)?.[1] ?? '')
    return unreadable(index, `${keyword}(${argument})`, `fixedSets.ts has a call to ${keyword}() that cannot be read`)
  }
  if (keyword === 'require') return null
  if (/^\s*\./.test(rest)) return unreadable(index, 'import.meta', 'fixedSets.ts reads import.meta, which is not judged')
  const sideEffect = SIDE_EFFECT.exec(rest)
  if (sideEffect !== null) return { index, clause: 'import', specifier: sideEffect.groups?.spec ?? '', shown: '', reason: '' }
  const statement = STATEMENT.exec(rest)
  if (statement === null) return unreadable(index, 'import', 'fixedSets.ts has an import that cannot be read')
  return { index, clause: oneLine(`import ${statement[1] ?? ''}`), specifier: statement.groups?.spec ?? '', shown: '', reason: '' }
}

/** Every import-like form of a masked source, in source order. */
function importsOf(masked: string): Found[] {
  const found: Found[] = []
  for (const match of masked.matchAll(/(?<![\w$])(import|export|require)(?![\w$])/g)) {
    const keyword = match[1] ?? ''
    const form = readForm(keyword, match.index, masked.slice(match.index + keyword.length))
    if (form !== null) found.push(form)
  }
  return found
}

/** Every import of the given sources that `fixedSets.ts` may not have. */
export function fixedSetImportViolations(files: ReadonlyArray<SourceFile>): ImportViolation[] {
  const violations: ImportViolation[] = []
  for (const file of files) {
    const masked = mask(file.source)
    for (const found of importsOf(masked)) {
      const line = lineAt(masked, found.index)
      if (found.specifier === null) {
        violations.push({ path: file.path, line, specifier: found.shown, reason: found.reason })
        continue
      }
      const target = targetOf(file.path, found.specifier)
      const isCopy = target.startsWith(COPY_ROOT)
      const isIconType = target === ICON_MODULE && found.clause === ICON_TYPE_IMPORT
      if (!isCopy && !isIconType) {
        violations.push({
          path: file.path,
          line,
          specifier: target,
          reason: `fixedSets.ts imports from ${target}; only src/copy/ and the NombreIcono type are allowed`,
        })
      }
    }
  }
  return violations
}

// ---- call-site rules (GH-581 part 7) ---------------------------------------------------

export interface CallSiteViolation {
  path: string
  line: number
  reason: string
}

const FIXED_SETS_MODULE = 'src/components/fixedSets'
const CHIP_FILES = ['src/components/SegmentedChoice.tsx', 'src/components/Pestanas.tsx']
const CHIP_CLASS = /(?<![\w-])(?:pildora|selector-pago__opcion|ajustes-tema__opcion)(?:--[\w-]+)?(?![\w-])/g
const PRESSED = /(?<![\w-])aria-pressed(?![\w-])/g
const LITERAL_ROLE = /(?<![\w-])role\s*=\s*(?:"(?:radio|tab)"|'(?:radio|tab)')/g
const ROLE_EXPRESSION = /(?<![\w-])role\s*=\s*\{/g
const NATIVE_SELECT = /<select(?![\w-])/g

/** The product's `.ts`/`.tsx` sources (tests, fixtures and this folder excluded), for the call-site rules. */
export function callSiteSources(): SourceFile[] {
  const modules = import.meta.glob(
    [
      '/src/**/*.ts',
      '/src/**/*.tsx',
      '!/src/**/*.test.ts',
      '!/src/**/*.test.tsx',
      '!/src/architecture/**',
      '!/src/test/**',
      '!/src/test-*.ts',
    ],
    { query: '?raw', import: 'default', eager: true },
  ) as Record<string, string>
  return Object.entries(modules).map(([path, source]) => ({ path: path.replace(/^\//, ''), source }))
}

/** Index of every bracket's partner, both ways, strings skipped (a `'`/`"` string ends at its line). */
function bracketPairs(src: string): Map<number, number> {
  const pairs = new Map<number, number>()
  const stack: number[] = []
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i] ?? ''
    if (ch === "'" || ch === '"' || ch === '`') {
      i += 1
      while (i < src.length && src[i] !== ch && (ch === '`' || src[i] !== '\n')) i += src[i] === '\\' ? 2 : 1
    } else if ('([{'.includes(ch)) {
      stack.push(i)
    } else if (')]}'.includes(ch)) {
      const open = stack.pop()
      if (open !== undefined) {
        pairs.set(open, i)
        pairs.set(i, open)
      }
    }
  }
  return pairs
}

interface Marker {
  index: number
  what: string
}

/** The values a `role={…}` expression can take, or null when one cannot be read. */
function roleValues(expression: string, masked: string): string[] | null {
  const text = expression.trim()
  let depth = 0
  let question = -1
  let colon = -1
  let nested = 0
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i] ?? ''
    if (ch === "'" || ch === '"' || ch === '`') {
      i += 1
      while (i < text.length && text[i] !== ch) i += text[i] === '\\' ? 2 : 1
    } else if ('([{'.includes(ch)) depth += 1
    else if (')]}'.includes(ch)) depth -= 1
    else if (depth === 0 && ch === '?' && text[i + 1] !== '.' && text[i + 1] !== '?' && text[i - 1] !== '?') {
      if (question === -1) question = i
      else nested += 1
    } else if (depth === 0 && ch === ':' && question !== -1) {
      if (nested === 0) {
        colon = i
        break
      }
      nested -= 1
    }
  }
  if (question !== -1) {
    if (colon === -1) return null
    const whenTrue = roleValues(text.slice(question + 1, colon), masked)
    const whenFalse = roleValues(text.slice(colon + 1), masked)
    return whenTrue === null || whenFalse === null ? null : [...whenTrue, ...whenFalse]
  }
  const literal = /^(['"`])([^'"`]*)\1$/.exec(text)
  if (literal !== null) return [literal[2] ?? '']
  if (text === 'undefined' || text === 'null') return []
  if (!/^[\w$.?]+$/.test(text)) return null
  const name = (text.split(/\??\./).at(-1) ?? '').replace(/[$]/g, String.raw`\$`)
  const typed = new RegExp(String.raw`(?<![\w$])${name}\??\s*:\s*((?:'[^'\n]*'\s*\|?\s*)+)`).exec(masked)
  const declared = new RegExp(String.raw`\bconst\s+${name}\s*=\s*'([^'\n]*)'`).exec(masked)
  if (typed !== null) return [...(typed[1] ?? '').matchAll(/'([^'\n]*)'/g)].map((found) => found[1] ?? '')
  return declared === null ? null : [declared[1] ?? '']
}

function markersOf(masked: string, pairs: Map<number, number>): Marker[] {
  const found: Marker[] = []
  for (const match of masked.matchAll(CHIP_CLASS)) found.push({ index: match.index, what: `the chip class ${match[0]}` })
  for (const match of masked.matchAll(PRESSED)) found.push({ index: match.index, what: 'aria-pressed' })
  for (const match of masked.matchAll(LITERAL_ROLE)) found.push({ index: match.index, what: match[0].replace(/\s+/g, '') })
  for (const match of masked.matchAll(ROLE_EXPRESSION)) {
    const open = match.index + match[0].length - 1
    const close = pairs.get(open)
    const values = close === undefined ? null : roleValues(masked.slice(open + 1, close), masked)
    if (values === null) found.push({ index: match.index, what: 'a role={…} whose value cannot be read' })
    else if (values.some((value) => value === 'radio' || value === 'tab')) {
      found.push({ index: match.index, what: `role={…} that can be ${values.filter((v) => v === 'radio' || v === 'tab').join(' or ')}` })
    }
  }
  return found.sort((a, b) => a.index - b.index)
}

/** Local name -> imported name, for every name this file imports from `components/fixedSets`. */
function fixedSetImports(path: string, masked: string): Map<string, string> {
  const names = new Map<string, string>()
  for (const match of masked.matchAll(/import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*['"]([^'"\n]+)['"]/g)) {
    if (targetOf(path, match[2] ?? '') !== FIXED_SETS_MODULE) continue
    for (const item of (match[1] ?? '').split(',')) {
      const [imported, local] = item.trim().split(/\s+as\s+/)
      if (imported !== undefined && imported !== '') names.set(local ?? imported, imported)
    }
  }
  return names
}

type Receiver = { kind: 'name'; name: string } | { kind: 'filter'; name: string } | { kind: 'other'; text: string }

/** The words and dots that end right before `end`, skipping the space around a dot (a chain). */
function chainBefore(src: string, end: number): string {
  let start = end
  for (;;) {
    let i = start
    while (i > 0 && /[\w$]/.test(src[i - 1] ?? '')) i -= 1
    if (i === start) break
    start = i
    let j = i
    while (j > 0 && /\s/.test(src[j - 1] ?? '')) j -= 1
    if (src[j - 1] === '.') {
      start = j - 1
      while (start > 0 && /\s/.test(src[start - 1] ?? '')) start -= 1
    } else break
  }
  return src.slice(start, end).replace(/\s+/g, '')
}

function receiverOf(src: string, dot: number, pairs: Map<number, number>): Receiver {
  let end = dot
  while (end > 0 && /\s/.test(src[end - 1] ?? '')) end -= 1
  if (src[end - 1] === ')') {
    const open = pairs.get(end - 1)
    if (open === undefined) return { kind: 'other', text: 'an unreadable call' }
    const head = chainBefore(src, open)
    const filtered = /^([A-Za-z_$][\w$]*)\.filter$/.exec(head)
    return filtered === null ? { kind: 'other', text: `${head}(…)` } : { kind: 'filter', name: filtered[1] ?? '' }
  }
  const chain = chainBefore(src, end)
  return /^[A-Za-z_$][\w$]*$/.test(chain) ? { kind: 'name', name: chain } : { kind: 'other', text: chain === '' ? 'an expression' : chain }
}

/** What is wrong with the `.map` that holds a marker in a raw site, or null when it is fine. */
function mapProblem(
  masked: string,
  pairs: Map<number, number>,
  index: number,
  site: RawChipSite,
  imports: Map<string, string>,
): string | null {
  let best: { open: number; dot: number } | null = null
  for (const call of masked.matchAll(/\.map\s*\(/g)) {
    const open = call.index + call[0].length - 1
    const close = pairs.get(open)
    if (close === undefined || open > index || close < index) continue
    if (best === null || open > best.open) best = { open, dot: call.index }
  }
  if (best === null) return `is not inside a .map of ${site.set}; a raw site draws its chips by mapping its fixed set`
  const receiver = receiverOf(masked, best.dot, pairs)
  if (receiver.kind === 'other') {
    return `is inside a .map over ${receiver.text}; only ${site.set} (or a direct .filter of it) may be mapped here`
  }
  const imported = imports.get(receiver.name)
  if (imported === undefined) {
    return `is inside a .map over ${receiver.name}, which is not imported from components/fixedSets`
  }
  if (imported !== site.set) {
    return `is inside a .map over ${imported}, but this site is registered for ${site.set}`
  }
  return null
}

/** Rule 1: the markers of a chip control, wherever they are not allowed or not over the registered set. */
export function fixedSetCallSiteViolations(
  files: ReadonlyArray<SourceFile>,
  sites: readonly RawChipSite[] = RAW_CHIP_SITES,
): CallSiteViolation[] {
  const violations: CallSiteViolation[] = []
  const present = new Set(files.map((file) => file.path))
  for (const site of sites) {
    if (!present.has(site.file)) {
      violations.push({ path: site.file, line: 1, reason: `RAW_CHIP_SITES names ${site.file}, which is not among the product sources` })
    }
  }
  for (const file of files) {
    if (CHIP_FILES.includes(file.path)) continue
    const masked = mask(file.source)
    const pairs = bracketPairs(masked)
    const markers = markersOf(masked, pairs)
    const site = sites.find((candidate) => candidate.file === file.path)
    const imports = site === undefined ? new Map<string, string>() : fixedSetImports(file.path, masked)
    for (const marker of markers) {
      const line = lineAt(masked, marker.index)
      if (site === undefined) {
        violations.push({
          path: file.path,
          line,
          reason: `${marker.what} outside SegmentedChoice, Pestanas and the raw sites of RAW_CHIP_SITES; a choice over a set takes a FixedSet or the Selector`,
        })
        continue
      }
      const problem = mapProblem(masked, pairs, marker.index, site, imports)
      if (problem !== null) violations.push({ path: file.path, line, reason: `${marker.what} ${problem}` })
    }
  }
  return violations.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : a.line - b.line))
}

/** Rule 2: a native `<select>` in product sources. */
export function selectViolations(files: ReadonlyArray<SourceFile>): CallSiteViolation[] {
  const violations: CallSiteViolation[] = []
  for (const file of files) {
    const masked = mask(file.source)
    for (const match of masked.matchAll(NATIVE_SELECT)) {
      violations.push({
        path: file.path,
        line: lineAt(masked, match.index),
        reason: 'a native <select>; a choice over a set is made with the Selector',
      })
    }
  }
  return violations
}
