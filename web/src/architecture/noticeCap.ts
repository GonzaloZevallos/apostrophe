/**
 * The notice cap (GH-188): the tappable notice card, `.boton-aviso`, is at most 560px wide
 * on a computer, as `InicioPrimeraVezCompu.dc.html` draws it. jsdom reads no stylesheet, so
 * no render test can prove a width; this checker reads the CSS text instead and says
 * whether the cap is there, once, in the one place it belongs.
 *
 * The cap lives in two places that must agree: `app.css`'s `@media (min-width: 900px)`
 * block and `NOTICE_CAP` below. Every finding names both.
 *
 * What it reads: comments are blanked (newlines kept), then the file is walked as
 * `selector { declarations }` blocks counted by braces. A `max-width` counts when it sits
 * in a rule with a selector part whose last compound is exactly `.boton-aviso`, followed
 * only by pseudo-classes; `:is(...)` and `:where(...)` are opened into their own lists. A
 * part ending in another compound (`.boton-aviso .aviso-onboarding__texto`) is a
 * descendant and never counts. Exactly one such `max-width` must exist, on the rule
 * `.boton-aviso` alone, equal to `NOTICE_CAP`, directly inside `NOTICE_CAP_MEDIA`.
 *
 * Known limits, on purpose: a width set through a custom property, written inline, set by
 * `max-inline-size`, or put on a compound that adds a class, an attribute or an element
 * (`a.boton-aviso`) is not seen. A brace inside a string or `url(...)` would break the
 * counting, so the checker refuses the file instead of guessing.
 */

export const NOTICE_CAP = '560px'
export const NOTICE_CAP_MEDIA = '(min-width: 900px)'

const BARE_SELECTOR = '.boton-aviso'
const BRACE_IN_STRING =
  'noticeCap: a brace inside a string or url(); the checker cannot count blocks'
const WHERE_IT_LIVES = ` The cap lives in two places that must agree: app.css's @media ${NOTICE_CAP_MEDIA} block and NOTICE_CAP (${NOTICE_CAP}) in noticeCap.ts.`

function endOfString(css: string, start: number): number {
  const quote = css.charAt(start)
  let at = start + 1
  while (at < css.length && css.charAt(at) !== quote && css.charAt(at) !== '\n') {
    const char = css.charAt(at)
    if (char === '{' || char === '}') throw new Error(BRACE_IN_STRING)
    at += char === '\\' ? 2 : 1
  }
  return css.charAt(at) === quote ? at + 1 : at
}

function endOfUrl(css: string, start: number): number {
  let at = start + 'url('.length
  while (at < css.length && css.charAt(at) !== ')') {
    const char = css.charAt(at)
    if (char === '{' || char === '}') throw new Error(BRACE_IN_STRING)
    at = char === '"' || char === "'" ? endOfString(css, at) : at + 1
  }
  return Math.min(at + 1, css.length)
}

/** Comments become spaces (newlines kept); a string or url body becomes `x`s, so nothing in
 * it can pass for a brace, a semicolon or a selector. Throws on a brace inside either. */
function blank(css: string): string {
  let out = ''
  let at = 0
  while (at < css.length) {
    const char = css.charAt(at)
    let stop = at + 1
    let piece = char
    if (char === '/' && css.charAt(at + 1) === '*') {
      const close = css.indexOf('*/', at + 2)
      stop = close < 0 ? css.length : close + 2
      piece = css.slice(at, stop).replace(/[^\n]/g, ' ')
    } else if (char === '"' || char === "'") {
      stop = endOfString(css, at)
      piece = char + 'x'.repeat(Math.max(stop - at - 2, 0)) + char
    } else if (css.slice(at, at + 4).toLowerCase() === 'url(') {
      stop = endOfUrl(css, at)
      piece = 'url(' + 'x'.repeat(Math.max(stop - at - 5, 0)) + ')'
    }
    out += piece
    at = stop
  }
  return out
}

interface Block {
  header: string
  own: string
  parent: string | null
}

function squash(text: string): string {
  return text.trim().replace(/\s+/g, ' ')
}

/** Every `{ ... }` block with its header, its own declarations and its enclosing header. */
function blocksOf(css: string): Block[] {
  const blocks: Block[] = []
  const open: Block[] = []
  let start = 0
  for (let at = 0; at < css.length; at += 1) {
    const char = css.charAt(at)
    const top = open[open.length - 1]
    if (char === '{') {
      open.push({
        header: squash(css.slice(start, at)),
        own: '',
        parent: top === undefined ? null : top.header,
      })
      start = at + 1
    } else if (char === '}') {
      const closed = open.pop()
      if (closed !== undefined) {
        closed.own += css.slice(start, at)
        blocks.push(closed)
      }
      start = at + 1
    } else if (char === ';') {
      if (top !== undefined) top.own += css.slice(start, at + 1)
      start = at + 1
    }
  }
  return blocks
}

/** Splits on `separator` outside parentheses and brackets. */
function splitTop(text: string, separator: string): string[] {
  const parts: string[] = []
  let depth = 0
  let from = 0
  for (let at = 0; at < text.length; at += 1) {
    const char = text.charAt(at)
    if (char === '(' || char === '[') depth += 1
    else if (char === ')' || char === ']') depth -= 1
    else if (char === separator && depth === 0) {
      parts.push(text.slice(from, at))
      from = at + 1
    }
  }
  parts.push(text.slice(from))
  return parts.map((part) => part.trim()).filter((part) => part !== '')
}

/** The text inside the parenthesis that opens at `open`. */
function insideParens(text: string, open: number): string {
  let depth = 0
  for (let at = open; at < text.length; at += 1) {
    const char = text.charAt(at)
    if (char === '(') depth += 1
    else if (char === ')') {
      depth -= 1
      if (depth === 0) return text.slice(open + 1, at)
    }
  }
  return text.slice(open + 1)
}

/** Every selector part of a rule, with each `:is(...)` and `:where(...)` list opened. */
function selectorParts(selector: string): string[] {
  const parts: string[] = []
  for (const part of splitTop(selector, ',')) {
    parts.push(part)
    for (const match of part.matchAll(/:(?:is|where)\(/g)) {
      const open = match.index + match[0].length - 1
      parts.push(...selectorParts(insideParens(part, open)))
    }
  }
  return parts
}

/** The compound after the last combinator of a selector part. */
function lastCompound(part: string): string {
  let depth = 0
  let last = -1
  for (let at = 0; at < part.length; at += 1) {
    const char = part.charAt(at)
    if (char === '(' || char === '[') depth += 1
    else if (char === ')' || char === ']') depth -= 1
    else if (depth === 0 && /[\s>+~]/.test(char)) last = at
  }
  return part.slice(last + 1)
}

/** True for `.boton-aviso` alone or followed by pseudo-classes only. */
function isNoticeCompound(compound: string): boolean {
  if (!compound.startsWith(BARE_SELECTOR)) return false
  let rest = compound.slice(BARE_SELECTOR.length)
  while (rest !== '') {
    const pseudo = /^:[a-zA-Z-]+/.exec(rest)
    if (pseudo === null) return false
    rest = rest.slice(pseudo[0].length)
    if (rest.startsWith('(')) rest = rest.slice(insideParens(rest, 0).length + 2)
  }
  return true
}

interface Cap {
  selector: string
  value: string
  parent: string | null
}

function capsOf(css: string): Cap[] {
  const caps: Cap[] = []
  for (const block of blocksOf(css)) {
    if (block.header.startsWith('@')) continue
    const counted = selectorParts(block.header).filter((part) =>
      isNoticeCompound(lastCompound(part)),
    )
    for (const declaration of block.own.matchAll(/(?:^|[;{\s])max-width\s*:\s*([^;]*)/g)) {
      for (let part = 0; part < counted.length; part += 1) {
        caps.push({
          selector: block.header,
          value: squash(declaration[1] ?? ''),
          parent: block.parent,
        })
      }
    }
  }
  return caps
}

/** The findings against `css`, none when the notice cap is as the design draws it. */
export function checkNoticeCap(css: string): string[] {
  const caps = capsOf(blank(css))
  const [cap] = caps
  if (cap === undefined) {
    return [`no max-width reaches ${BARE_SELECTOR}.${WHERE_IT_LIVES}`]
  }
  if (caps.length > 1) {
    return [
      `${caps.length} max-width declarations reach ${BARE_SELECTOR}; exactly one is allowed.${WHERE_IT_LIVES}`,
    ]
  }
  const findings: string[] = []
  if (cap.selector !== BARE_SELECTOR) {
    findings.push(
      `the max-width on ${BARE_SELECTOR} must be written on the bare ${BARE_SELECTOR} rule alone, not on "${cap.selector}".${WHERE_IT_LIVES}`,
    )
  }
  if (cap.value !== NOTICE_CAP) {
    findings.push(
      `the value of the max-width on ${BARE_SELECTOR} is "${cap.value}", not ${NOTICE_CAP}.${WHERE_IT_LIVES}`,
    )
  }
  const media = `@media ${NOTICE_CAP_MEDIA}`
  if (cap.parent !== media) {
    findings.push(
      `the max-width on ${BARE_SELECTOR} must sit directly inside ${media}, not ${cap.parent === null ? 'at the top level' : `inside "${cap.parent}"`}.${WHERE_IT_LIVES}`,
    )
  }
  return findings
}
