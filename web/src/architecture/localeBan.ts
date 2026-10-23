/**
 * The locale ban (ADR-0049, amendment GH-297): front code never reads the device's locale for
 * dates, numbers or sorting. Formats and order stay Argentine whatever language the device is
 * set to. No non-test file under `web/src` uses:
 *
 *  1. any member of the `to`-`Locale` family of methods;
 *  2. the `Intl` date formatter;
 *  3. the `Intl` relative-time formatter;
 *  4. `Intl.NumberFormat`, with or without `new`, whose first argument is not a string
 *     literal. `Intl.NumberFormat` without a literal first argument is banned: the thousands
 *     and decimal marks would follow the device (`$ 11.000` would become `$ 11,000`);
 *  5. the `locale`-`Compare` method whose second argument is missing or not a string literal,
 *     and the `Intl` collator whose first argument is missing or not a string literal.
 *
 * A locale stays only as a literal argument (`'es-AR'`, `'es'`). The other `Intl` members
 * (plural rules and the like) are not banned.
 *
 * `findLocaleCalls(source)` reads the file as text with comments blanked, so a comment that
 * names the ban is not a call; a string that names one is, the rule being about the name.
 * "A string literal" and "the first or second argument" are decided by a scan that tracks
 * strings, templates and bracket depth, never by a pattern over the text after the open
 * parenthesis; any shape it cannot read (a spread, a concatenation, an alias, a bare
 * reference) is a hit. This file builds every banned name from parts, so it, under the ban
 * like every other file, never spells one.
 */

const LOCALE = 'Locale'
const TO_LOCALE = `to${LOCALE}`
const LOCALE_COMPARE = `${LOCALE.toLowerCase()}Compare`
const INTL = ['In', 'tl'].join('')
const NAMES = new RegExp(String.raw`\b(?:${TO_LOCALE}\w*|${LOCALE_COMPARE}|${INTL})\b`, 'g')

const ALWAYS_BANNED_MEMBERS: readonly string[] = ['DateTimeFormat', 'RelativeTimeFormat']
const LITERAL_ARGUMENT_MEMBERS: readonly string[] = ['NumberFormat', 'Collator']

type Mode = 'code' | 'single' | 'double' | 'template' | 'line' | 'block' | 'regex'

/** A `/` opens a regex after the start of the file or one of these characters. */
const REGEX_AFTER = '(,=:[!&|?{};+-*%>~^'
const REGEX_AFTER_WORDS: readonly string[] = ['return', 'typeof']

const WORD = /[A-Za-z0-9_$]+/y

function blank(text: string): string {
  return text.replace(/[^\n]/g, ' ')
}

function opensRegex(last: string): boolean {
  return last === '' || (last.length === 1 && REGEX_AFTER.includes(last)) || REGEX_AFTER_WORDS.includes(last)
}

interface Scanned {
  /** The source with every comment blanked to spaces (newlines kept), same length. */
  code: string
  endsInCode: boolean
}

/** One forward pass over the text through code, strings, templates, comments and regexes. */
function scan(source: string): Scanned {
  let mode: Mode = 'code'
  const holes: number[] = [] // brace depth inside each open `${` of a template
  let out = ''
  let last = '' // the last significant token in code: '', one character or one word
  let inClass = false
  let i = 0
  while (i < source.length) {
    const ch = source.charAt(i)
    const next = source.charAt(i + 1)
    if (mode === 'code') {
      if (ch === '/' && next === '/' && source.charAt(i - 1) !== ':') {
        mode = 'line'
        out += '  '
        i += 2
      } else if (ch === '/' && next === '/') {
        // `//` right after `:` is the end of `http:`, not a comment.
        out += '//'
        last = '/'
        i += 2
      } else if (ch === '/' && next === '*') {
        mode = 'block'
        out += '  '
        i += 2
      } else if (ch === '/' && opensRegex(last)) {
        mode = 'regex'
        inClass = false
        out += ch
        i += 1
      } else if (ch === "'" || ch === '"' || ch === '`') {
        mode = ch === "'" ? 'single' : ch === '"' ? 'double' : 'template'
        out += ch
        i += 1
      } else if (ch === '}' && holes.length > 0 && holes[holes.length - 1] === 0) {
        holes.pop()
        mode = 'template'
        out += ch
        i += 1
      } else {
        if (ch === '{' && holes.length > 0) holes[holes.length - 1] = (holes[holes.length - 1] ?? 0) + 1
        if (ch === '}' && holes.length > 0) holes[holes.length - 1] = (holes[holes.length - 1] ?? 0) - 1
        WORD.lastIndex = i
        const word = WORD.exec(source)
        if (word !== null) {
          last = word[0]
          out += word[0]
          i += word[0].length
        } else {
          if (!/\s/.test(ch)) last = ch
          out += ch
          i += 1
        }
      }
    } else if (mode === 'single' || mode === 'double') {
      const quote = mode === 'single' ? "'" : '"'
      if (ch === '\\') {
        out += source.slice(i, i + 2)
        i += 2
      } else {
        if (ch === quote || ch === '\n') {
          mode = 'code'
          last = '0'
        }
        out += ch
        i += 1
      }
    } else if (mode === 'template') {
      if (ch === '\\') {
        out += source.slice(i, i + 2)
        i += 2
      } else if (ch === '$' && next === '{') {
        holes.push(0)
        mode = 'code'
        last = '{'
        out += '${'
        i += 2
      } else {
        if (ch === '`') {
          mode = 'code'
          last = '0'
        }
        out += ch
        i += 1
      }
    } else if (mode === 'line') {
      if (ch === '\n') mode = 'code'
      out += ch === '\n' ? ch : ' '
      i += 1
    } else if (mode === 'block') {
      if (ch === '*' && next === '/') {
        mode = 'code'
        out += '  '
        i += 2
      } else {
        out += blank(ch)
        i += 1
      }
    } else if (ch === '\\') {
      out += source.slice(i, i + 2)
      i += 2
    } else {
      if (ch === '[') inClass = true
      else if (ch === ']') inClass = false
      else if ((ch === '/' && !inClass) || ch === '\n') {
        mode = 'code'
        last = '0'
      }
      out += ch
      i += 1
    }
  }
  return { code: out, endsInCode: (mode === 'code' && holes.length === 0) || mode === 'line' }
}

/** True when the walk over the text finishes in code: no string, template, block comment or
 * regex is left open. A misread of text this guard does not model (JSX text) shows here. */
export function endsInCode(source: string): boolean {
  return scan(source).endsInCode
}

function skipSpace(code: string, from: number): number {
  let at = from
  while (at < code.length && /\s/.test(code.charAt(at))) at += 1
  return at
}

/** The index after the quoted text that starts at `from` (a quote or a backtick). */
function skipQuoted(code: string, from: number): number {
  const quote = code.charAt(from)
  let at = from + 1
  while (at < code.length) {
    const ch = code.charAt(at)
    if (ch === '\\') at += 2
    else if (ch === quote) return at + 1
    else if (ch === '\n' && quote !== '`') return at
    else if (quote === '`' && ch === '$' && code.charAt(at + 1) === '{') at = skipHole(code, at + 2)
    else at += 1
  }
  return code.length
}

/** The index after the `}` that closes a template hole whose body starts at `from`. */
function skipHole(code: string, from: number): number {
  let depth = 0
  let at = from
  while (at < code.length) {
    const ch = code.charAt(at)
    if (ch === "'" || ch === '"' || ch === '`') at = skipQuoted(code, at)
    else if (ch === '}' && depth === 0) return at + 1
    else {
      if (ch === '{') depth += 1
      if (ch === '}') depth -= 1
      at += 1
    }
  }
  return code.length
}

/** The arguments of the call whose `(` is at `openIndex`, split at depth 0 across `()[]{}`. */
function splitArgs(code: string, openIndex: number): string[] {
  const args: string[] = []
  let depth = 0
  let start = openIndex + 1
  let at = openIndex + 1
  while (at < code.length) {
    const ch = code.charAt(at)
    if (ch === "'" || ch === '"' || ch === '`') {
      at = skipQuoted(code, at)
    } else if (ch === ')' && depth === 0) {
      args.push(code.slice(start, at))
      break
    } else if (ch === ',' && depth === 0) {
      args.push(code.slice(start, at))
      at += 1
      start = at
    } else {
      if ('([{'.includes(ch)) depth += 1
      if (')]}'.includes(ch)) depth -= 1
      at += 1
    }
  }
  if (at >= code.length) args.push(code.slice(start))
  // `f()` and a trailing comma carry no last argument.
  if (args.length > 0 && (args[args.length - 1] ?? '').trim() === '') args.pop()
  return args
}

/** True only when the whole argument is one `'…'`, `"…"` or `` `…` `` token with no `${`. */
function isStringLiteral(argument: string | undefined): boolean {
  const text = (argument ?? '').trim()
  const quote = text.charAt(0)
  if (quote !== "'" && quote !== '"' && quote !== '`') return false
  let at = 1
  while (at < text.length) {
    const ch = text.charAt(at)
    if (ch === '\\') at += 2
    else if (ch === quote) return at === text.length - 1
    else if (quote === '`' && ch === '$' && text.charAt(at + 1) === '{') return false
    else if (ch === '\n' && quote !== '`') return false
    else at += 1
  }
  return false
}

/** The index of the `(` of a call written at `from`, `?.(` included, or -1. */
function callParen(code: string, from: number): number {
  const at = skipSpace(code, from)
  if (code.charAt(at) === '(') return at
  if (code.startsWith('?.', at)) {
    const paren = skipSpace(code, at + 2)
    if (code.charAt(paren) === '(') return paren
  }
  return -1
}

/** Whether the `Intl` token ending at `end` is a banned use. */
function isBannedIntl(code: string, end: number): boolean {
  let at = skipSpace(code, end)
  if (code.startsWith('?.', at)) at += 2
  else if (code.charAt(at) === '.') at += 1
  else return true
  at = skipSpace(code, at)
  const member = /^[A-Za-z0-9_$]*/.exec(code.slice(at))?.[0] ?? ''
  if (member === '' || ALWAYS_BANNED_MEMBERS.includes(member)) return true
  if (!LITERAL_ARGUMENT_MEMBERS.includes(member)) return false
  const paren = callParen(code, at + member.length)
  return paren < 0 || !isStringLiteral(splitArgs(code, paren)[0])
}

function isBannedCompare(code: string, end: number): boolean {
  const paren = skipSpace(code, end)
  return code.charAt(paren) !== '(' || !isStringLiteral(splitArgs(code, paren)[1])
}

/** The lines of every banned use in one file: the line where the banned name starts, once,
 * sorted. */
export function findLocaleCalls(source: string): number[] {
  const { code } = scan(source)
  const lines: number[] = []
  for (const match of code.matchAll(NAMES)) {
    const name = match[0]
    const end = match.index + name.length
    const banned = name === INTL ? isBannedIntl(code, end) : name === LOCALE_COMPARE ? isBannedCompare(code, end) : true
    if (banned) lines.push(code.slice(0, match.index).split('\n').length)
  }
  return [...new Set(lines)].sort((a, b) => a - b)
}
