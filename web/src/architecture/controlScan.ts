/**
 * The control scan (GH-102): which elements of the product's `.tsx` sources a person can
 * tap, and the classes each can carry, read from the markup itself. A link such as
 * `.ajustes__item` has no `cursor` rule in the stylesheet, so only the JSX says it is a
 * control. `touch.test.ts` checks each class found here against the pressed block.
 *
 * It is a reader of source text, not a compiler, so it fails closed: a `className` it
 * cannot read, or a click handler on an element that is not a control, is an error with
 * `file:line`, never a silent skip. Pure functions over `{path, source}` pairs; nothing
 * here imports a component or touches CSS.
 *
 * A control is: a `button`, `a`, `Link`, `NavLink` or `InAppLink` tag; any element with
 * `role` `button`, `tab`, `radio` or `switch`; or the call site of a wrapper (a component
 * whose control tag takes its classes from its own `className` prop or spreads its props),
 * where the wrapper's inner tag is not reported.
 *
 * A `className` is read as: a string literal; a ternary, `&&`, `||` or `??` of readable
 * parts (every branch counts); a template literal whose static parts are whole
 * space-separated tokens (a `${}` glued inside a token is an error); or an identifier,
 * member access or call naming a `const` or `function` in the same file, in which case
 * every string literal of its declaration counts. Anything else is an error.
 */

export interface SourceFile {
  path: string
  source: string
}

export interface Control {
  file: string
  line: number
  tag: string
  classes: string[]
}

export interface ScanResult {
  controls: Control[]
  errors: string[]
}

const CONTROL_TAGS = new Set(['button', 'a', 'Link', 'NavLink', 'InAppLink'])
const CONTROL_ROLES = new Set(['button', 'tab', 'radio', 'switch'])
const HANDLERS = new Set(['onClick', 'onPointerDown', 'onMouseDown'])

/** The product's `.tsx` sources (tests excluded), as `scanControls` takes them. */
export function productSources(): SourceFile[] {
  const modules = import.meta.glob(['/src/**/*.tsx', '!/src/**/*.test.tsx'], {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>
  return Object.entries(modules).map(([path, source]) => ({
    path: path.replace(/^\//, ''),
    source,
  }))
}

// ---- lexing helpers ------------------------------------------------------------------

/** Comments become spaces (newlines kept), so indexes and line numbers stay the same. */
function mask(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '))
    .replace(/(^|[ \t])\/\/[^\n]*/gm, (line, lead: string) => lead + ' '.repeat(line.length - lead.length))
}

function isQuote(ch: string | undefined): boolean {
  return ch === "'" || ch === '"' || ch === '`'
}

/** The index just after the quoted string or template literal that starts at `start`. */
function skipQuoted(src: string, start: number): number {
  const quote = src[start]
  let i = start + 1
  while (i < src.length) {
    const ch = src[i]
    if (ch === '\\') {
      i += 2
    } else if (quote === '`' && ch === '$' && src[i + 1] === '{') {
      i = skipBraces(src, i + 1)
    } else if (ch === quote) {
      return i + 1
    } else {
      i += 1
    }
  }
  return src.length
}

/** The index just after the `}` matching the `{` at `start`. */
function skipBraces(src: string, start: number): number {
  let depth = 0
  let i = start
  while (i < src.length) {
    const ch = src[i]
    if (isQuote(ch)) {
      i = skipQuoted(src, i)
      continue
    }
    if (ch === '{') depth += 1
    if (ch === '}') {
      depth -= 1
      if (depth === 0) return i + 1
    }
    i += 1
  }
  return src.length
}

function skipSpaces(src: string, from: number): number {
  let i = from
  while (i < src.length && /\s/.test(src[i] ?? '')) i += 1
  return i
}

function lineAt(src: string, index: number): number {
  let line = 1
  for (let i = 0; i < index && i < src.length; i += 1) if (src[i] === '\n') line += 1
  return line
}

function matchAt(re: RegExp, src: string, at: number): string | null {
  const sticky = new RegExp(re.source, 'y')
  sticky.lastIndex = at
  return sticky.exec(src)?.[0] ?? null
}

/** The positions of the characters of `text` outside strings and brackets. */
function topLevel(text: string): number[] {
  const out: number[] = []
  let depth = 0
  let i = 0
  while (i < text.length) {
    const ch = text[i] ?? ''
    if (isQuote(ch)) {
      i = skipQuoted(text, i)
      continue
    }
    if ('([{'.includes(ch)) depth += 1
    else if (')]}'.includes(ch)) depth -= 1
    else if (depth === 0) out.push(i)
    i += 1
  }
  return out
}

// ---- template literals ---------------------------------------------------------------

interface Template {
  parts: string[]
  exprs: string[]
  end: number
}

function parseTemplate(src: string, start: number): Template {
  const parts: string[] = []
  const exprs: string[] = []
  let current = ''
  let i = start + 1
  while (i < src.length) {
    const ch = src[i]
    if (ch === '\\') {
      current += src[i + 1] ?? ''
      i += 2
    } else if (ch === '$' && src[i + 1] === '{') {
      const end = skipBraces(src, i + 1)
      exprs.push(src.slice(i + 2, end - 1))
      parts.push(current)
      current = ''
      i = end
    } else if (ch === '`') {
      parts.push(current)
      return { parts, exprs, end: i + 1 }
    } else {
      current += ch ?? ''
      i += 1
    }
  }
  parts.push(current)
  return { parts, exprs, end: src.length }
}

function tokensOf(text: string): string[] {
  return text.split(/\s+/).filter((token) => token !== '')
}

interface Context {
  file: string
  masked: string
  errors: string[]
}

function fail(ctx: Context, line: number, reason: string): void {
  ctx.errors.push(`${ctx.file}:${line} ${reason}`)
}

/** The tokens of a template's static parts; a `${}` glued to a token is an error. */
function templateTokens(tpl: Template, ctx: Context, line: number): string[] {
  const out: string[] = []
  tpl.parts.forEach((part, k) => {
    const gluedBefore = k > 0 && part !== '' && !/^\s/.test(part)
    const gluedAfter = k < tpl.parts.length - 1 && part !== '' && !/\s$/.test(part)
    if (gluedBefore || gluedAfter) {
      fail(ctx, line, 'className template has a ${} inside a class token, which cannot be read')
    }
    out.push(...tokensOf(part))
  })
  return out
}

// ---- reading a className -------------------------------------------------------------

/** Every string literal of a declaration's region, except those compared with `===`. */
function literalsIn(region: string, ctx: Context, line: number): string[] {
  const out: string[] = []
  let i = 0
  while (i < region.length) {
    const ch = region[i]
    if (ch === "'" || ch === '"') {
      const end = skipQuoted(region, i)
      const before = region.slice(Math.max(0, i - 12), i)
      if (!/(===?|!==?|\bcase)\s*$/.test(before)) out.push(...tokensOf(region.slice(i + 1, end - 1)))
      i = end
    } else if (ch === '`') {
      const tpl = parseTemplate(region, i)
      out.push(...templateTokens(tpl, ctx, line))
      for (const expr of tpl.exprs) out.push(...literalsIn(expr, ctx, line))
      i = tpl.end
    } else {
      i += 1
    }
  }
  return out
}

/** The text of the `const` or `function` named `name` in this file, or null. */
function declarationRegion(src: string, name: string): string | null {
  const declared = new RegExp(`\\b(?:const|let|function)\\s+${name.replace(/\$/g, '\\$')}\\b`).exec(src)
  if (declared === null) return null
  let i = declared.index + declared[0].length
  if (declared[0].startsWith('function')) {
    i = src.indexOf('(', i)
    if (i === -1) return null
    let depth = 0
    for (; i < src.length; i += 1) {
      if (src[i] === '(') depth += 1
      if (src[i] === ')') {
        depth -= 1
        if (depth === 0) break
      }
    }
    const open = src.indexOf('{', i)
    return open === -1 ? null : src.slice(open, skipBraces(src, open))
  }
  const equals = /=(?!>)/.exec(src.slice(i))
  if (equals === null) return null
  const start = i + equals.index + 1
  const first = skipSpaces(src, start)
  if (src[first] === '{') return src.slice(first, skipBraces(src, first))
  let end = first
  for (;;) {
    const newline = src.indexOf('\n', end)
    if (newline === -1) return src.slice(first)
    const next = /^\s*(.)/.exec(src.slice(newline + 1, newline + 200))?.[1] ?? ''
    end = newline + 1
    if (!'?:|&+.'.includes(next) || next === '') return src.slice(first, newline)
  }
}

function splitOn(text: string, operators: string[]): string[] {
  const pieces: string[] = []
  let from = 0
  for (const at of topLevel(text)) {
    const operator = operators.find((candidate) => text.startsWith(candidate, at))
    if (operator === undefined || at < from) continue
    pieces.push(text.slice(from, at))
    from = at + operator.length
  }
  pieces.push(text.slice(from))
  return pieces
}

function splitTernary(text: string): [string, string] | null {
  const top = topLevel(text)
  let nested = 0
  let question = -1
  for (const at of top) {
    const ch = text[at]
    if (ch === '?' && text[at + 1] !== '?' && text[at + 1] !== '.' && text[at - 1] !== '?') {
      if (question === -1) question = at
      else nested += 1
    } else if (ch === ':' && question !== -1) {
      if (nested === 0) return [text.slice(question + 1, at), text.slice(at + 1)]
      nested -= 1
    }
  }
  return null
}

function resolve(expr: string, ctx: Context, line: number): string[] {
  const text = expr.trim()
  const unreadable = (): string[] => {
    fail(ctx, line, `className expression cannot be read: ${text.replace(/\s+/g, ' ')}`)
    return []
  }
  if (text === '') return unreadable()
  if (/^(undefined|null|false|true)$/.test(text)) return []
  const ternary = splitTernary(text)
  if (ternary !== null) return [...resolve(ternary[0], ctx, line), ...resolve(ternary[1], ctx, line)]
  const either = splitOn(text, ['||', '??'])
  if (either.length > 1) return either.flatMap((part) => resolve(part, ctx, line))
  const both = splitOn(text, ['&&'])
  if (both.length > 1) return resolve(both[both.length - 1] ?? '', ctx, line)
  if (text[0] === "'" || text[0] === '"') {
    return skipQuoted(text, 0) === text.length ? tokensOf(text.slice(1, -1)) : unreadable()
  }
  if (text[0] === '`') {
    const tpl = parseTemplate(text, 0)
    return tpl.end === text.length ? templateTokens(tpl, ctx, line) : unreadable()
  }
  if (text[0] === '(' && skipBalanced(text, 0) === text.length) return resolve(text.slice(1, -1), ctx, line)
  const name = matchAt(/[A-Za-z_$][\w$]*/, text, 0)
  if (name === null || !isAccessChain(text.slice(name.length))) return unreadable()
  const region = declarationRegion(ctx.masked, name)
  if (region === null) return unreadable()
  return literalsIn(region, ctx, line)
}

function skipBalanced(text: string, start: number): number {
  let depth = 0
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i] ?? ''
    if (isQuote(ch)) {
      i = skipQuoted(text, i) - 1
    } else if ('([{'.includes(ch)) {
      depth += 1
    } else if (')]}'.includes(ch)) {
      depth -= 1
      if (depth === 0) return i + 1
    }
  }
  return text.length
}

/** True when `rest` is only `.name`, `?.name`, `[...]` and `(...)` steps. */
function isAccessChain(rest: string): boolean {
  let i = 0
  while (i < rest.length) {
    if (rest[i] === '[' || rest[i] === '(') {
      i = skipBalanced(rest, i)
      continue
    }
    const step = matchAt(/\??\.[A-Za-z_$][\w$]*/, rest, i)
    if (step === null) return false
    i += step.length
  }
  return true
}

// ---- parsing a tag -------------------------------------------------------------------

interface Attr {
  name: string
  kind: 'string' | 'expr' | 'bare' | 'spread'
  value: string
  index: number
}

interface Tag {
  name: string
  index: number
  attrs: Attr[]
}

function parseTag(src: string, start: number): Tag | null {
  const name = matchAt(/[A-Za-z][\w.:-]*/, src, start + 1)
  if (name === null) return null
  const attrs: Attr[] = []
  let i = start + 1 + name.length
  for (;;) {
    i = skipSpaces(src, i)
    const ch = src[i]
    if (ch === undefined) return null
    if (ch === '>' || src.startsWith('/>', i)) return { name, index: start, attrs }
    if (ch === '{') {
      const end = skipBraces(src, i)
      const inner = src.slice(i + 1, end - 1).trim()
      if (!inner.startsWith('...')) return null
      attrs.push({ name: '...', kind: 'spread', value: inner.slice(3), index: i })
      i = end
      continue
    }
    const attrName = matchAt(/[A-Za-z_$][\w$:-]*/, src, i)
    if (attrName === null) return null
    const attrIndex = i
    i = skipSpaces(src, i + attrName.length)
    if (src[i] !== '=') {
      attrs.push({ name: attrName, kind: 'bare', value: '', index: attrIndex })
      continue
    }
    i = skipSpaces(src, i + 1)
    if (src[i] === '"' || src[i] === "'") {
      const end = skipQuoted(src, i)
      attrs.push({ name: attrName, kind: 'string', value: src.slice(i + 1, end - 1), index: attrIndex })
      i = end
    } else if (src[i] === '{') {
      const end = skipBraces(src, i)
      attrs.push({ name: attrName, kind: 'expr', value: src.slice(i + 1, end - 1), index: attrIndex })
      i = end
    } else {
      return null
    }
  }
}

function tagsOf(masked: string): { tag: Tag | null; index: number; name: string }[] {
  const out: { tag: Tag | null; index: number; name: string }[] = []
  for (const match of masked.matchAll(/<(?=[A-Za-z])/g)) {
    const index = match.index
    // `Array<string>`, `useRef<T>(…)`, `a<b`: a `<` right after a word is not JSX.
    if (/[\w$)\]]/.test(masked[index - 1] ?? '')) continue
    const name = matchAt(/[A-Za-z][\w.:-]*/, masked, index + 1) ?? ''
    out.push({ tag: parseTag(masked, index), index, name })
  }
  return out
}

function isCapitalized(name: string): boolean {
  return /^[A-Z]/.test(name)
}

function attr(tag: Tag, name: string): Attr | undefined {
  return tag.attrs.find((candidate) => candidate.name === name)
}

function hasControlRole(tag: Tag): boolean {
  const role = attr(tag, 'role')
  if (role === undefined) return false
  const value = role.kind === 'expr' ? role.value.trim().replace(/^(['"])(.*)\1$/, '$2') : role.value
  return role.kind !== 'bare' && CONTROL_ROLES.has(value)
}

function isControl(tag: Tag, wrappers: ReadonlySet<string> = new Set()): boolean {
  return CONTROL_TAGS.has(tag.name) || wrappers.has(tag.name) || hasControlRole(tag)
}

/** True when a control tag takes its classes from the props of the component around it. */
function forwardsClasses(tag: Tag): boolean {
  const classAttr = attr(tag, 'className')
  if (classAttr === undefined) return tag.attrs.some((candidate) => candidate.kind === 'spread')
  return classAttr.kind === 'expr' && /\bclassName\b/.test(classAttr.value)
}

function enclosingComponent(masked: string, index: number): string | null {
  let found: string | null = null
  for (const match of masked.matchAll(/\b(?:function|const|class)\s+([A-Z][\w$]*)/g)) {
    if (match.index >= index) break
    found = match[1] ?? null
  }
  return found
}

function classesOf(tag: Tag, ctx: Context): string[] {
  const classAttr = attr(tag, 'className')
  if (classAttr === undefined) return []
  const line = lineAt(ctx.masked, classAttr.index)
  if (classAttr.kind === 'string') return tokensOf(classAttr.value)
  if (classAttr.kind === 'expr') return resolve(classAttr.value, ctx, line)
  fail(ctx, line, 'className has no value')
  return []
}

// ---- the scan ------------------------------------------------------------------------

export function scanControls(files: ReadonlyArray<SourceFile>): ScanResult {
  const controls: Control[] = []
  const errors: string[] = []
  const parsed = files.map((file) => {
    const masked = mask(file.source)
    return { file, masked, tags: tagsOf(masked) }
  })

  // Components defined in the sources: a click handler passed to one is checked where the
  // component puts it on an element.
  const declared = new Set<string>()
  for (const { masked } of parsed) {
    for (const match of masked.matchAll(/\b(?:function|const|class)\s+([A-Z][\w$]*)/g)) {
      declared.add(match[1] ?? '')
    }
  }

  // Wrappers: the control tag inside is not reported, its call sites are.
  const wrapperInner = new Set<string>()
  const wrappers = new Set<string>()
  for (const { file, masked, tags } of parsed) {
    for (const { tag, index } of tags) {
      if (tag === null || !isControl(tag) || !forwardsClasses(tag)) continue
      const component = enclosingComponent(masked, index)
      if (component === null) continue
      wrapperInner.add(`${file.path}:${index}`)
      wrappers.add(component)
    }
  }

  for (const { file, masked, tags } of parsed) {
    const ctx: Context = { file: file.path, masked, errors }
    for (const { tag, index, name } of tags) {
      const line = lineAt(masked, index)
      if (tag === null) {
        if (CONTROL_TAGS.has(name) || isCapitalized(name)) fail(ctx, line, `<${name}> cannot be read`)
        continue
      }
      if (isControl(tag, wrappers)) {
        if (wrapperInner.has(`${file.path}:${index}`)) continue
        controls.push({ file: file.path, line, tag: name, classes: [...new Set(classesOf(tag, ctx))] })
        continue
      }
      const handler = tag.attrs.find((candidate) => HANDLERS.has(candidate.name))
      if (handler !== undefined && !(isCapitalized(name) && declared.has(name))) {
        fail(ctx, line, `${handler.name} on <${name}>, which is not a control`)
      }
    }
  }
  return { controls, errors }
}
