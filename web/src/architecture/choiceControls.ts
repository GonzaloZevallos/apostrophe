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
 * the network would be caught by the copy guards, not here. Call-site rules (which controls take
 * a `FixedSet`) belong to a later part of GH-581.
 */

import { mask, relativePath, type SourceFile } from './controlScan'

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
