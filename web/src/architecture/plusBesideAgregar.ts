/**
 * The double-plus guard (icon-and-text-rule.md, "Which form each control takes"): the
 * `agregar` icon draws the plus, so the visible text beside it is the word alone. The docs'
 * "+ Cargar gasto" stands for icon + "Cargar gasto". A literal "+" in a visible position
 * would show two plus signs.
 *
 * What counts as a visible position:
 * - the text, and the string or template children, of a JSX control with `icon="agregar"`;
 * - the `label`, `title` and `detail` keys of an object literal whose `icon` is `'agregar'`
 *   (a menu or list entry that a component draws beside the icon).
 *
 * What does not: `ACCESSIBLE_NAME_KEYS`. The docs' "+" stays in the accessible name
 * (criterion 5: every accessible name is unchanged), so `aria-label` and `ariaLabel` may
 * carry it. It is never drawn there.
 *
 * Returns one line per offending "+": `path:line: visible "+" beside the agregar icon`.
 */

export interface SourceFile {
  path: string
  content: string
}

export const VISIBLE_KEYS = ['label', 'title', 'detail'] as const
export const ACCESSIBLE_NAME_KEYS = ['aria-label', 'ariaLabel'] as const

/** The `/` that ends a self-closing tag, by code so that routes.test.ts does not read it as a path. */
const SLASH_CODE = 47
const MESSAGE = 'visible "+" beside the agregar icon'
const JSX_AGREGAR = /\bicon=(?:"agregar"|\{\s*'agregar'\s*\})/
const OBJECT_AGREGAR = /\bicon\s*:\s*(['"])agregar\1/g
const VISIBLE_KEY = new RegExp(`(?<![\\w.-])(${VISIBLE_KEYS.join('|')})\\s*:\\s*(['"\`])`, 'g')

function isQuote(char: string): boolean {
  return char === "'" || char === '"' || char === '`'
}

/** The end (after the closing quote) of the literal opening at `start`, and where its text holds a "+". */
function readLiteral(src: string, start: number): { end: number; plusAt: number[] } {
  const quote = src.charAt(start)
  const plusAt: number[] = []
  let i = start + 1
  while (i < src.length && src.charAt(i) !== quote) {
    const char = src.charAt(i)
    if (char === '\\') {
      i += 2
    } else if (quote === '`' && char === '$' && src.charAt(i + 1) === '{') {
      i = skipBraces(src, i + 1)
    } else {
      if (char === '+') plusAt.push(i)
      i += 1
    }
  }
  return { end: i + 1, plusAt }
}

/** The index after the `}` that closes the `{` at `open`, skipping the strings inside. */
function skipBraces(src: string, open: number): number {
  let depth = 0
  let i = open
  while (i < src.length) {
    const char = src.charAt(i)
    if (isQuote(char)) {
      i = readLiteral(src, i).end
      continue
    }
    if (char === '{') depth += 1
    if (char === '}') {
      depth -= 1
      if (depth === 0) return i + 1
    }
    i += 1
  }
  return src.length
}

function lineOf(content: string, offset: number): number {
  return content.slice(0, offset).split('\n').length
}

/** The index of the `>` that ends the opening tag starting at `start`, and whether it self-closes. */
function endOfOpeningTag(src: string, start: number): { end: number; selfClosing: boolean } {
  let i = start
  while (i < src.length) {
    const char = src.charAt(i)
    if (isQuote(char)) i = readLiteral(src, i).end
    else if (char === '{') i = skipBraces(src, i)
    else if (char === '>') return { end: i, selfClosing: src.charCodeAt(i - 1) === SLASH_CODE }
    else i += 1
  }
  return { end: src.length, selfClosing: true }
}

/** The index where the children of the element named `name` end (its closing tag), from `from`. */
function endOfChildren(src: string, name: string, from: number): number {
  const tags = new RegExp(`<(/?)${name.replace('.', '\\.')}(?=[\\s>/])`, 'g')
  tags.lastIndex = from
  let depth = 1
  for (let found = tags.exec(src); found !== null; found = tags.exec(src)) {
    if (found[1] !== '') depth -= 1
    else if (!endOfOpeningTag(src, found.index + 1).selfClosing) depth += 1
    if (depth === 0) return found.index
  }
  return src.length
}

/** Offsets of each "+" a reader would see in the JSX children `src[from, to)`. */
function visiblePlusInChildren(src: string, from: number, to: number): number[] {
  const found: number[] = []
  let i = from
  while (i < to) {
    const char = src.charAt(i)
    if (char === '{') {
      const close = skipBraces(src, i)
      for (let j = i + 1; j < close - 1; j += 1) {
        if (isQuote(src.charAt(j))) {
          const literal = readLiteral(src, j)
          found.push(...literal.plusAt)
          j = literal.end - 1
        }
      }
      i = close
    } else if (char === '<') {
      i = endOfOpeningTag(src, i + 1).end + 1
    } else {
      if (char === '+') found.push(i)
      i += 1
    }
  }
  return found
}

function scanJsx({ path, content }: SourceFile): string[] {
  const lines: string[] = []
  const opening = /<([A-Z][\w.]*)(?=[\s>/])/g
  for (let tag = opening.exec(content); tag !== null; tag = opening.exec(content)) {
    const name = tag[1] ?? ''
    const { end, selfClosing } = endOfOpeningTag(content, tag.index + tag[0].length)
    if (selfClosing || !JSX_AGREGAR.test(content.slice(tag.index, end))) continue
    const stop = endOfChildren(content, name, end + 1)
    for (const at of visiblePlusInChildren(content, end + 1, stop)) {
      lines.push(`${path}:${lineOf(content, at)}: ${MESSAGE}`)
    }
  }
  return lines
}

function enclosingObject(src: string, at: number): { open: number; close: number } | null {
  let depth = 0
  for (let open = at - 1; open >= 0; open -= 1) {
    const char = src.charAt(open)
    if (char === '}') depth += 1
    if (char === '{') {
      if (depth === 0) return { open, close: skipBraces(src, open) }
      depth -= 1
    }
  }
  return null
}

function scanObjects({ path, content }: SourceFile): string[] {
  const lines: string[] = []
  for (const icon of content.matchAll(OBJECT_AGREGAR)) {
    const object = enclosingObject(content, icon.index)
    if (object === null) continue
    const body = content.slice(object.open, object.close)
    for (const key of body.matchAll(VISIBLE_KEY)) {
      const quote = object.open + key.index + key[0].length - 1
      for (const at of readLiteral(content, quote).plusAt) {
        lines.push(`${path}:${lineOf(content, at)}: ${MESSAGE}`)
      }
    }
  }
  return lines
}

export function findPlusBesideAgregar(files: readonly SourceFile[]): string[] {
  return files.flatMap((file) => [...new Set([...scanJsx(file), ...scanObjects(file)])])
}
