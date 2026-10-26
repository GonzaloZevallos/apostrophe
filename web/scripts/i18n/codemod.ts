/**
 * `npm run i18n:codemod -- [--keys <dir>] <file>...`: rewrites the reads of a copy object
 * whose texts moved to locale keys, using the mappings of `src/copy/baselineKeys/<ns>.json`.
 *
 * - `OBJ.name` becomes `t('<ns>:name')`; `OBJ.fn(a, b)` becomes `t('<ns>:fn', { p1: a, p2: b })`
 *   with the param names of the mapping.
 * - The enclosing component or hook gets `const { t } = useTranslation()` as the first
 *   statement of its body (an existing one at the top is reused), and `useTranslation` is
 *   imported from `react-i18next`.
 * - A use inside `useMemo`, `useCallback`, `useEffect` or `useLayoutEffect` adds `t` to a
 *   literal dependency array that lacks it.
 * - The import of `OBJ` goes once no read of it remains.
 *
 * A name of the object with no mapping is left as it is: it is still exported by its `.ts`.
 * A read it cannot rewrite safely is an error naming file and line, and the run is all or none:
 * every file is computed first and nothing is written unless there is no error.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import ts from 'typescript'
import { loadMappingFiles, type Mapping, type Mappings } from './baselineKeys.ts'

export interface SourceFile {
  path: string
  text: string
}

export interface CodemodError {
  file: string
  line: number
  message: string
}

export interface FileEdit {
  file: string
  text: string
}

export type CodemodResult = { edits: FileEdit[] } | { errors: CodemodError[] }

interface Edit {
  start: number
  end: number
  text: string
}

/** A copy read to rewrite: the node it replaces and what it becomes. */
interface Use {
  node: ts.Node
  mapping: Mapping
  args: readonly ts.Expression[]
  target: Target
}

/** A copy object imported by the file, with the references to it. */
interface Target {
  local: string
  prefix: string
  specifier: ts.ImportSpecifier
  references: number
  rewritten: number
}

type FunctionNode = ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction | ts.MethodDeclaration | ts.AccessorDeclaration | ts.ConstructorDeclaration

const COPY_FOLDER = /(^|\/)src\/copy\//
const WRAPPERS = new Set(['memo', 'forwardRef'])
const DEPENDENCY_HOOKS = new Set(['useMemo', 'useCallback', 'useEffect', 'useLayoutEffect'])
const HOOK_MODULE = 'react-i18next'

const isFunctionNode = (node: ts.Node): node is FunctionNode =>
  ts.isFunctionDeclaration(node) ||
  ts.isFunctionExpression(node) ||
  ts.isArrowFunction(node) ||
  ts.isMethodDeclaration(node) ||
  ts.isGetAccessorDeclaration(node) ||
  ts.isSetAccessorDeclaration(node) ||
  ts.isConstructorDeclaration(node)

const isComponentOrHook = (name: string): boolean => /^[A-Z]/.test(name) || /^use[A-Z0-9]/.test(name)

function calleeName(call: ts.CallExpression): string | undefined {
  const callee = call.expression
  if (ts.isIdentifier(callee)) return callee.text
  if (ts.isPropertyAccessExpression(callee)) return callee.name.text
  return undefined
}

/** The outermost function around a node: the component, hook or helper a copy read lives in. */
function outermostFunction(node: ts.Node): FunctionNode | undefined {
  let found: FunctionNode | undefined
  for (let current = node.parent; current !== undefined; current = current.parent) {
    if (isFunctionNode(current)) found = current
  }
  return found
}

interface Naming {
  name: string | undefined
  wrapped: boolean
}

/** The name that says what a function is: its own, or the variable a `memo`/`forwardRef`
 * call around it is assigned to. */
function nameOf(fn: FunctionNode): Naming {
  const own = ts.isFunctionDeclaration(fn) || ts.isFunctionExpression(fn) ? fn.name?.text : undefined
  let node: ts.Node = fn
  let wrapped = false
  while (ts.isCallExpression(node.parent) && node.parent.arguments[0] === node && WRAPPERS.has(calleeName(node.parent) ?? '')) {
    wrapped = true
    node = node.parent
  }
  const declaration = node.parent
  const variable =
    ts.isVariableDeclaration(declaration) && declaration.initializer === node && ts.isIdentifier(declaration.name) ? declaration.name.text : undefined
  return { name: own ?? variable, wrapped }
}

/** A `const { t } = useTranslation()` statement. */
function isPlainHook(statement: ts.Statement): boolean {
  if (!ts.isVariableStatement(statement)) return false
  const [declaration] = statement.declarationList.declarations
  if (statement.declarationList.declarations.length !== 1 || declaration === undefined) return false
  const init = declaration.initializer
  if (init === undefined || !ts.isCallExpression(init) || calleeName(init) !== 'useTranslation' || init.arguments.length > 0) return false
  return (
    ts.isObjectBindingPattern(declaration.name) &&
    declaration.name.elements.some((element) => ts.isIdentifier(element.name) && element.name.text === 't' && element.propertyName === undefined)
  )
}

function descendants(root: ts.Node, visit: (node: ts.Node) => void): void {
  const walk = (node: ts.Node): void => {
    visit(node)
    ts.forEachChild(node, walk)
  }
  ts.forEachChild(root, walk)
}

/** Whether a statement can return from the function itself (not from a nested function). */
function returnsEarly(statement: ts.Node): boolean {
  let found = false
  const walk = (node: ts.Node): void => {
    if (found || isFunctionNode(node)) return
    if (ts.isReturnStatement(node)) found = true
    else ts.forEachChild(node, walk)
  }
  walk(statement)
  return found
}

class FileRewrite {
  readonly errors: CodemodError[] = []
  private readonly sf: ts.SourceFile
  private readonly seen = new Set<string>()
  private readonly uses: Use[] = []
  private readonly edits: Edit[] = []
  private readonly depArrays = new Set<ts.ArrayLiteralExpression>()
  private readonly functions = new Set<FunctionNode>()
  private readonly targets: Target[] = []

  private readonly source: SourceFile
  private readonly mappings: Mappings

  constructor(source: SourceFile, mappings: Mappings) {
    this.source = source
    this.mappings = mappings
    this.sf = ts.createSourceFile(source.path, source.text, ts.ScriptTarget.Latest, true, source.path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  }

  private fail(node: ts.Node | undefined, message: string): void {
    const line = node === undefined ? 1 : this.sf.getLineAndCharacterOfPosition(node.getStart(this.sf)).line + 1
    if (this.seen.has(`${line}:${message}`)) return
    this.seen.add(`${line}:${message}`)
    this.errors.push({ file: this.source.path, line, message })
  }

  /** The new text of the file, or undefined when it has nothing to rewrite or has errors. */
  result(): string | undefined {
    if (COPY_FOLDER.test(this.source.path.replaceAll('\\', '/'))) {
      this.fail(undefined, 'a file under web/src/copy is never rewritten')
      return undefined
    }
    this.findTargets()
    for (const target of this.targets) this.collectReferences(target)
    for (const use of this.uses) this.checkContext(use)
    if (this.errors.length > 0 || this.uses.length === 0) return undefined
    for (const fn of this.functions) this.addHook(fn)
    if (this.errors.length > 0) return undefined
    this.rewriteUses()
    this.dropImports()
    this.addHookImport()
    return this.apply()
  }

  private findTargets(): void {
    for (const statement of this.sf.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue
      const bindings = statement.importClause?.namedBindings
      if (bindings === undefined || !ts.isNamedImports(bindings)) continue
      const module = basename(statement.moduleSpecifier.text).replace(/\.(ts|tsx)$/, '')
      for (const specifier of bindings.elements) {
        const prefix = `${module}.ts:${(specifier.propertyName ?? specifier.name).text}`
        if (Object.keys(this.mappings).some((source) => source.startsWith(`${prefix}.`))) {
          this.targets.push({ local: specifier.name.text, prefix, specifier, references: 0, rewritten: 0 })
        }
      }
    }
  }

  private collectReferences(target: Target): void {
    descendants(this.sf, (node) => {
      if (!ts.isIdentifier(node) || node.text !== target.local) return
      const parent = node.parent
      if (ts.isImportSpecifier(parent)) return
      if (ts.isPropertyAccessExpression(parent) && parent.name === node) return
      if (ts.isPropertyAssignment(parent) && parent.name === node) return
      target.references += 1
      this.collectUse(node, target)
    })
  }

  private collectUse(id: ts.Identifier, target: Target): void {
    const parent = id.parent
    if (ts.findAncestor(id, ts.isTypeQueryNode) !== undefined) return this.fail(id, `${id.text} is read in a type position`)
    if (ts.isSpreadElement(parent) || ts.isSpreadAssignment(parent)) return this.fail(id, `${id.text} is spread`)
    if (ts.isElementAccessExpression(parent) && parent.expression === id) return this.fail(id, `${id.text} is read by computed access`)
    if (!ts.isPropertyAccessExpression(parent) || parent.expression !== id) return this.fail(id, `${id.text} is aliased or passed as a value`)

    let matched: { node: ts.PropertyAccessExpression; mapping: Mapping } | undefined
    const names: string[] = []
    let node: ts.PropertyAccessExpression = parent
    for (;;) {
      names.push(node.name.text)
      const mapping = this.mappings[`${target.prefix}.${names.join('.')}`]
      if (mapping !== undefined) matched = { node, mapping }
      const up: ts.Node = node.parent
      if (!ts.isPropertyAccessExpression(up) || up.expression !== node) break
      node = up
    }
    if (matched === undefined) return
    const { node: access, mapping } = matched
    const call = ts.isCallExpression(access.parent) && access.parent.expression === access ? access.parent : undefined
    const where = `${id.text}.${names.join('.')}`
    if (mapping.params !== undefined && mapping.params.length > 0 && call === undefined) return this.fail(access, `${where} is a function and is read without a call`)
    const args = call?.arguments ?? []
    if (call !== undefined) {
      if (args.some(ts.isSpreadElement)) return this.fail(call, `${where} is called with a spread argument`)
      const expected = mapping.params?.length ?? 0
      if (args.length !== expected) return this.fail(call, `${where} takes ${expected} arguments, called with ${args.length}`)
    }
    const use: Use = { node: call ?? access, mapping, args, target }
    let outer: ts.Node = use.node
    while (ts.isParenthesizedExpression(outer.parent)) outer = outer.parent
    if (ts.isBinaryExpression(outer.parent) && (outer.parent.operatorToken.kind === ts.SyntaxKind.PlusToken || outer.parent.operatorToken.kind === ts.SyntaxKind.PlusEqualsToken)) {
      return this.fail(use.node, `${where} is concatenated into a string`)
    }
    if (ts.isTemplateSpan(outer.parent)) return this.fail(use.node, `${where} is put in a template literal`)
    this.uses.push(use)
  }

  private checkContext(use: Use): void {
    const fn = outermostFunction(use.node)
    if (fn === undefined) return this.fail(use.node, 'a copy read at module top level')
    const { name, wrapped } = nameOf(fn)
    if (name === undefined) {
      return this.fail(use.node, wrapped ? 'an anonymous memo or forwardRef wrapper cannot take the hook' : 'a copy read in an anonymous function that is not a component or a hook')
    }
    if (!isComponentOrHook(name)) return this.fail(use.node, `a copy read in ${name}, which is neither a component nor a hook`)
    this.functions.add(fn)
    this.checkDependencies(use.node, fn)
  }

  private checkDependencies(node: ts.Node, fn: FunctionNode): void {
    for (let current = node.parent; current !== undefined && current !== fn; current = current.parent) {
      if (!ts.isCallExpression(current) || !DEPENDENCY_HOOKS.has(calleeName(current) ?? '')) continue
      const callback = current.arguments[0]
      if (callback === undefined || node.pos < callback.pos || node.end > callback.end) continue
      const deps = current.arguments[1]
      if (deps === undefined) continue
      if (!ts.isArrayLiteralExpression(deps)) {
        this.fail(deps, 'a dependency list that is not an array literal')
        continue
      }
      if (this.depArrays.has(deps)) continue
      this.depArrays.add(deps)
      if (deps.elements.some((element) => ts.isIdentifier(element) && element.text === 't')) continue
      const last = deps.elements[deps.elements.length - 1]
      if (last === undefined) this.edits.push({ start: deps.elements.pos, end: deps.elements.pos, text: 't' })
      else this.edits.push({ start: last.end, end: last.end, text: ', t' })
    }
  }

  /** The hook of one component or hook: reused when it is at the top, added otherwise. */
  private addHook(fn: FunctionNode): void {
    const body = fn.body
    if (body === undefined) return
    const hooks: ts.CallExpression[] = []
    const locals: ts.Node[] = []
    descendants(fn, (node) => {
      if (ts.isCallExpression(node) && calleeName(node) === 'useTranslation') hooks.push(node)
      const declared =
        (ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isBindingElement(node) || ts.isFunctionDeclaration(node)) && node.name !== undefined ? node.name : undefined
      if (declared !== undefined && ts.isIdentifier(declared) && declared.text === 't') locals.push(node)
    })
    const statements = ts.isBlock(body) ? body.statements : []
    const reusable = statements.findIndex(isPlainHook)
    if (hooks.length > 0) {
      const ok = hooks.length === 1 && reusable >= 0 && !statements.slice(0, reusable).some(returnsEarly)
      if (!ok) return this.fail(hooks[0], 'useTranslation is not a plain const { t } = useTranslation() at the top of the body')
    }
    const reused = reusable >= 0 ? statements[reusable] : undefined
    const conflicts = locals.filter((node) => reused === undefined || node.pos < reused.pos || node.end > reused.end)
    const topLevel = this.sf.statements.filter((statement) => (ts.isVariableStatement(statement) && statement.declarationList.declarations.some((d) => ts.isIdentifier(d.name) && d.name.text === 't')) || (ts.isFunctionDeclaration(statement) && statement.name?.text === 't'))
    const imported = this.sf.statements.filter((statement) => ts.isImportDeclaration(statement) && this.importsLocal(statement, 't'))
    const [conflict] = [...conflicts, ...topLevel, ...imported]
    if (conflict !== undefined) return this.fail(conflict, 'a local named t already exists where the hook goes')
    if (reused !== undefined) return
    const hook = 'const { t } = useTranslation()'
    if (ts.isBlock(body)) {
      const first = body.statements[0]
      if (first === undefined) return
      const lineStart = this.source.text.lastIndexOf('\n', first.getStart(this.sf)) + 1
      const indent = this.source.text.slice(lineStart, first.getStart(this.sf))
      const at = first.getStart(this.sf)
      this.edits.push({ start: at, end: at, text: `${hook}${this.semi()}\n${/^\s*$/.test(indent) ? indent : ''}` })
    } else {
      this.edits.push({ start: body.getStart(this.sf), end: body.getStart(this.sf), text: `{ ${hook}; return ` })
      this.edits.push({ start: body.end, end: body.end, text: ' }' })
    }
  }

  private importsLocal(statement: ts.ImportDeclaration, local: string): boolean {
    const clause = statement.importClause
    if (clause === undefined) return false
    if (clause.name?.text === local) return true
    const bindings = clause.namedBindings
    return bindings !== undefined && ts.isNamedImports(bindings) && bindings.elements.some((element) => element.name.text === local)
  }

  private semi(): string {
    const first = this.sf.statements[0]
    return first !== undefined && first.getText(this.sf).endsWith(';') ? ';' : ''
  }

  private rewriteUses(): void {
    const outermost = this.uses.filter((use) => !this.uses.some((other) => other !== use && other.node.pos <= use.node.pos && use.node.end <= other.node.end))
    for (const use of outermost) {
      this.edits.push({ start: use.node.getStart(this.sf), end: use.node.end, text: this.render(use) })
    }
    for (const use of this.uses) use.target.rewritten += 1
  }

  private render(use: Use): string {
    const params = use.mapping.params ?? []
    if (use.args.length === 0) return `t('${use.mapping.key}')`
    const pairs = use.args.map((arg, index) => {
      const name = params[index] ?? ''
      const text = this.span(arg.getStart(this.sf), arg.end, use)
      return text === name ? name : `${name}: ${text}`
    })
    return `t('${use.mapping.key}', { ${pairs.join(', ')} })`
  }

  /** The source between two positions with the copy reads inside it rewritten. */
  private span(start: number, end: number, parent: Use): string {
    const inside = this.uses.filter((use) => use !== parent && start <= use.node.getStart(this.sf) && use.node.end <= end)
    const outermost = inside.filter((use) => !inside.some((other) => other !== use && other.node.pos <= use.node.pos && use.node.end <= other.node.end))
    outermost.sort((a, b) => a.node.getStart(this.sf) - b.node.getStart(this.sf))
    let cursor = start
    let text = ''
    for (const use of outermost) {
      text += this.source.text.slice(cursor, use.node.getStart(this.sf)) + this.render(use)
      cursor = use.node.end
    }
    return text + this.source.text.slice(cursor, end)
  }

  private dropImports(): void {
    for (const target of this.targets) {
      if (target.rewritten === 0 || target.rewritten !== target.references) continue
      const clause = target.specifier.parent.parent
      const named = target.specifier.parent
      const declaration = clause.parent
      const remaining = named.elements.filter((element) => this.targets.every((other) => other.specifier !== element || other.rewritten === 0 || other.rewritten !== other.references))
      if (remaining.length > 0) {
        this.pushOnce({ start: named.getStart(this.sf), end: named.end, text: `{ ${remaining.map((element) => element.getText(this.sf)).join(', ')} }` })
      } else if (clause.name !== undefined) {
        this.pushOnce({ start: clause.name.end, end: named.end, text: '' })
      } else {
        let end = declaration.end
        if (this.source.text[end] === '\r') end += 1
        if (this.source.text[end] === '\n') end += 1
        this.pushOnce({ start: declaration.getStart(this.sf), end, text: '' })
      }
    }
  }

  private pushOnce(edit: Edit): void {
    if (!this.edits.some((other) => other.start === edit.start && other.end === edit.end)) this.edits.push(edit)
  }

  private addHookImport(): void {
    const existing = this.sf.statements.filter((statement): statement is ts.ImportDeclaration => ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier) && statement.moduleSpecifier.text === HOOK_MODULE)
    if (existing.some((statement) => this.importsLocal(statement, 'useTranslation'))) return
    for (const statement of existing) {
      const bindings = statement.importClause?.namedBindings
      const last = bindings !== undefined && ts.isNamedImports(bindings) ? bindings.elements[bindings.elements.length - 1] : undefined
      if (last !== undefined && statement.importClause?.isTypeOnly !== true) {
        this.edits.push({ start: last.end, end: last.end, text: ', useTranslation' })
        return
      }
    }
    const first = this.sf.statements[0]
    if (first === undefined) return
    const semi = this.semi()
    this.edits.push({ start: first.getStart(this.sf), end: first.getStart(this.sf), text: `import { useTranslation } from '${HOOK_MODULE}'${semi}\n` })
  }

  private apply(): string {
    const ordered = [...this.edits].sort((a, b) => b.start - a.start || b.end - a.end)
    let text = this.source.text
    for (const edit of ordered) text = text.slice(0, edit.start) + edit.text + text.slice(edit.end)
    return text
  }
}

/**
 * Rewrites the copy reads of every file, all or none: the result holds either the new text of
 * every file that changes, or the errors of every file that cannot be rewritten.
 */
export function run(files: readonly SourceFile[], mappings: Mappings): CodemodResult {
  const edits: FileEdit[] = []
  const errors: CodemodError[] = []
  for (const source of files) {
    const rewrite = new FileRewrite(source, mappings)
    const text = rewrite.result()
    errors.push(...rewrite.errors)
    if (text !== undefined && text !== source.text) edits.push({ file: source.path, text })
  }
  return errors.length > 0 ? { errors } : { edits }
}

const USAGE = 'usage: npm run i18n:codemod -- [--keys <baselineKeys folder>] <file>...'

/** The CLI: reads the files and the mappings, writes only when there is no error. */
export function main(argv: readonly string[], cwd: string = process.cwd()): number {
  const paths: string[] = []
  let keys: string | undefined
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] ?? ''
    if (arg === '--keys') {
      keys = argv[index + 1]
      index += 1
    } else paths.push(arg)
  }
  if (paths.length === 0 || (argv.includes('--keys') && keys === undefined)) {
    process.stderr.write(`${USAGE}\n`)
    return 2
  }
  const mappings: Record<string, Mapping> = {}
  for (const { mappings: found } of keys === undefined ? loadMappingFiles() : loadMappingFiles(resolve(cwd, keys))) Object.assign(mappings, found)
  const files = paths.map((path) => ({ path, text: readFileSync(resolve(cwd, path), 'utf8') }))
  const result = run(files, mappings)
  if ('errors' in result) {
    for (const { file, line, message } of result.errors) process.stderr.write(`${file}:${line}: ${message}\n`)
    return 1
  }
  for (const { file, text } of result.edits) {
    writeFileSync(resolve(cwd, file), text)
    process.stdout.write(`rewrote ${file}\n`)
  }
  return 0
}

if (import.meta.main) process.exit(main(process.argv.slice(2)))
