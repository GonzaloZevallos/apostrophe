/**
 * The i18n guard: a walk over `web/src` on the TypeScript compiler API that keeps shared words
 * resolving at render, so a language switch re-renders them. It flags, with file and line:
 *
 * 1. A value import of the i18next instance (`src/i18n/index.ts`, or the `i18next` package)
 *    outside `src/i18n/`. A type-only import passes, and so does a bare side-effect import
 *    (`import './i18n'`, the one `main.tsx` style).
 * 2. A call to `t` or `.t` outside every function-like body: the module body, a top-level
 *    object or array literal, a class field initializer.
 * 3. A top-level call to `resolveKey` outside `mobile-standard/` and `i18n/`.
 * 4. Any import of `mobile-standard/copy.ts` from outside `mobile-standard/`.
 *
 * `src/i18n/` is skipped whole: it is where the instance lives.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import ts from 'typescript'

export interface Problem {
  readonly file: string
  readonly line: number
  readonly message: string
}

const INSTANCE_PACKAGE = 'i18next'
const I18N_FOLDER = 'i18n'
const WALK_FOLDER = 'mobile-standard'

/*
 * The two folders where a top-level `resolveKey` is allowed: `i18n/` defines it and
 * `mobile-standard/` resolves the English texts once. The walk runs once, in English, under
 * Playwright, against the pinned fixture (ADR-0048), so it has no language to switch.
 */
const RESOLVE_ONCE_FOLDERS: readonly string[] = [I18N_FOLDER, WALK_FOLDER]

const HERE_TOP_LEVEL = 'at module top level: hold the key and resolve it where it renders'

const isSource = (name: string): boolean => /\.tsx?$/.test(name) && !name.endsWith('.d.ts')

function sourcePaths(dir: string): readonly string[] {
  return readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : sourcePaths(path)
      return isSource(entry.name) ? [path] : []
    })
}

const isFunctionLike = (node: ts.Node): boolean =>
  ts.isFunctionDeclaration(node) ||
  ts.isFunctionExpression(node) ||
  ts.isArrowFunction(node) ||
  ts.isMethodDeclaration(node) ||
  ts.isGetAccessorDeclaration(node) ||
  ts.isSetAccessorDeclaration(node) ||
  ts.isConstructorDeclaration(node)

/** The absolute path a relative specifier points at, without extension. */
function target(file: string, specifier: string): string | undefined {
  if (!specifier.startsWith('.')) return undefined
  return resolve(dirname(file), specifier).replace(/\.tsx?$/, '')
}

const inFolder = (srcDir: string, path: string, folder: string): boolean => {
  const base = join(srcDir, folder)
  return path === base || path.startsWith(base + sep)
}

/** Whether an import brings a value: not `import type`, not only `type` names, not a bare import. */
function bringsValue(node: ts.ImportDeclaration): boolean {
  const clause = node.importClause
  if (clause === undefined) return false
  if (clause.isTypeOnly) return false
  const named = clause.namedBindings
  if (clause.name === undefined && named !== undefined && ts.isNamedImports(named)) {
    return named.elements.some((element) => !element.isTypeOnly)
  }
  return true
}

export function i18nGuard(srcDir: string): readonly Problem[] {
  const problems: Problem[] = []

  for (const path of sourcePaths(srcDir)) {
    const rel = relative(srcDir, path).split(sep).join('/')
    const insideI18n = inFolder(srcDir, path, I18N_FOLDER)
    if (insideI18n) continue
    const insideWalk = inFolder(srcDir, path, WALK_FOLDER)
    const resolvesOnce = RESOLVE_ONCE_FOLDERS.some((folder) => inFolder(srcDir, path, folder))
    const source = ts.createSourceFile(
      path,
      readFileSync(path, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    )
    const report = (node: ts.Node, message: string): void => {
      const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1
      problems.push({ file: rel, line, message })
    }

    const visit = (node: ts.Node, insideFunction: boolean): void => {
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
        const specifier = node.moduleSpecifier.text
        const to = target(path, specifier)
        if (bringsValue(node)) {
          const isInstance =
            specifier === INSTANCE_PACKAGE ||
            (to !== undefined && (to === join(srcDir, I18N_FOLDER) || to === join(srcDir, I18N_FOLDER, 'index')))
          if (isInstance) report(node, 'imports the i18next instance: take t from useTranslation')
        }
        if (to !== undefined && to === join(srcDir, WALK_FOLDER, 'copy') && !insideWalk) {
          report(node, 'imports mobile-standard/copy.ts: only the mobile walk reads English once')
        }
      }
      if (ts.isCallExpression(node) && !insideFunction) {
        const callee = node.expression
        if (ts.isIdentifier(callee) && callee.text === 't') report(node, `t() ${HERE_TOP_LEVEL}`)
        else if (ts.isPropertyAccessExpression(callee) && callee.name.text === 't') {
          report(node, `.t() ${HERE_TOP_LEVEL}`)
        } else if (ts.isIdentifier(callee) && callee.text === 'resolveKey' && !resolvesOnce) {
          report(node, `resolveKey() at module top level outside ${WALK_FOLDER}/: hold the key and resolve it where it renders`)
        }
      }
      ts.forEachChild(node, (child) => visit(child, insideFunction || isFunctionLike(node)))
    }
    visit(source, false)
  }
  return problems
}

/** The problems as `file:line: message` lines. */
export function formatProblems(problems: readonly Problem[]): readonly string[] {
  return problems.map(({ file, line, message }) => `${file}:${line}: ${message}`)
}
