/**
 * The closing guards of the icon and text rule (GH-97, `docs/product/icon-and-text-rule.md`,
 * ADR-0037): each returns one line per offence, empty when the tree is clean, and is fed
 * input it must reject in `closingGuards.test.ts` before `closingGuards.real.test.ts` runs
 * it over the real tree. They are what ends the old shapes: after them nothing is exempt
 * beyond the closed lists written here.
 *
 * - `findRawSvg`: no `<svg>` outside `components/Icono.tsx`.
 * - `findRawButtons`: a raw `<button>` in `screens/` or `shell/` carries only a class from
 *   `OPTION_CLASSES` (a choice among options, a row, a switch), never a button look.
 * - `findBotonClasses`: no element outside `Boton`/`BotonLink` carries a `boton*` class.
 * - `findUnusedIcons`: every name in `ICON_NAMES` is drawn by something a person sees.
 * - `findActionLinks`: no `InAppLink`, `Link` or `<a>` that holds an `<Icono` outside
 *   `BotonLink`: an icon and a word on a link is an action, and only `BotonLink` draws one.
 * - `findLinkAliases`: `Link` and `InAppLink` are imported under their own names, so the
 *   guard above can find them.
 */

/** A path inside `src/`, written from its parts so no route-looking literal is in the source. */
/** The path separator, spelled so the source holds no lone slash literal (`routes.test.ts`). */
const SEP = '\u002f'

function inSrc(...parts: string[]): string {
  return ['', 'src', ...parts].join(SEP)
}

export interface SourceFile {
  path: string
  content: string
}

/** The closed list of raw-button classes: options and rows, never an action. */
export const OPTION_CLASSES = [
  'pildora',
  'periodos__boton',
  'gastos__mes-boton',
  'fila-gasto',
  'ajustes__item--boton',
  'encabezado__titulo',
] as const

/** The roles that make a raw `<button>` a choice (a switch or a radio). */
export const OPTION_ROLES = ['switch', 'radio'] as const

/** The files that draw `.boton*`: the two components, what they both draw from, and the dialog
 * answers' one author (`AnswerButton`, the text-only answers the rule lists). */
const BOTON_AUTHORS = [
  inSrc('components', 'Boton.tsx'),
  inSrc('components', 'BotonLink.tsx'),
  inSrc('components', 'botonVisual.tsx'),
  inSrc('components', 'AnswerButton.tsx'),
]

const ICONO = inSrc('components', 'Icono.tsx')
const BOTON = inSrc('components', 'Boton.tsx')

function slashed(path: string): string {
  return path.startsWith(SEP) ? path : `${SEP}${path}`
}

export function isTestSide(path: string): boolean {
  return (
    /\.test\.tsx?$/.test(path) ||
    path.includes('/architecture/') ||
    path.includes(inSrc('test', '')) ||
    /\/src\/test-(setup|viewport)\.ts$/.test(path)
  )
}

function sources(files: readonly SourceFile[]): SourceFile[] {
  return files
    .map(({ path, content }) => ({ path: slashed(path), content }))
    .filter(({ path }) => /\.tsx?$/.test(path) && !isTestSide(path))
}

export function findRawSvg(files: readonly SourceFile[]): string[] {
  return sources(files)
    .filter(({ path, content }) => path !== ICONO && /<svg[\s>]/.test(content))
    .map(({ path }) => `${path}: draws an <svg> itself, use Icono`)
}

/**
 * The one brace and quote balancer of this file. From `start` it walks past quotes (a backtick
 * only inside braces) and nested braces, reading `=>` as an arrow and not as a tag end, and
 * answers an index: with `'tag'`, the `>` that ends the tag; with `'value'`, where `start`
 * holds a quote or a `{`, the quote or `}` that closes it. The text's length when there is none.
 */
function balancedEnd(text: string, start: number, stop: 'tag' | 'value'): number {
  let depth = 0
  let quote: string | null = null
  for (let index = start; index < text.length; index += 1) {
    const char = text.charAt(index)
    if (quote !== null) {
      if (char === quote) {
        quote = null
        if (stop === 'value' && depth === 0) return index
      }
    } else if (char === '"' || char === "'" || (char === '`' && depth > 0)) quote = char
    else if (char === '{') depth += 1
    else if (char === '}') {
      depth -= 1
      if (stop === 'value' && depth === 0) return index
    } else if (stop === 'tag' && char === '>' && depth === 0 && text.charAt(index - 1) !== '=') return index
  }
  return text.length
}

interface OpeningTag {
  attributes: string
  line: number
  /** Where the `<` of the tag sits. */
  index: number
  /** Where the `>` that ends the tag sits (the text's length when it never ends). */
  end: number
  selfClosing: boolean
}

/** Every `<tag` opening in the content: its attribute text, line, end and whether it closes itself. */
function openingTags(content: string, tag: string): OpeningTag[] {
  const found: OpeningTag[] = []
  const opening = new RegExp(`<${tag}(?=[\\s>/])`, 'g')
  for (let match = opening.exec(content); match !== null; match = opening.exec(content)) {
    const start = match.index + match[0].length
    const end = balancedEnd(content, start, 'tag')
    found.push({
      attributes: content.slice(start, end),
      line: content.slice(0, match.index).split('\n').length,
      index: match.index,
      end,
      selfClosing: end < content.length && content.charAt(end - 1) === SEP,
    })
  }
  return found
}

/**
 * The value an attribute is written with, braces or quotes included and trimmed; empty for a
 * bare attribute, `undefined` when it is absent. Only attributes at the top level count: a
 * name inside a quoted string or a `{…}` (a spread, an object) is not one.
 */
export function attributeValue(attributes: string, name: string): string | undefined {
  const word = /[\w:-]+/y
  let index = 0
  while (index < attributes.length) {
    word.lastIndex = index
    const written = word.exec(attributes)
    if (written === null) {
      const char = attributes.charAt(index)
      index = char === '{' ? balancedEnd(attributes, index, 'value') + 1 : index + 1
      continue
    }
    const after = index + written[0].length
    const opener = attributes.charAt(after + 1)
    const hasValue = attributes.charAt(after) === '=' && (opener === '{' || opener === '"' || opener === "'")
    const stop = hasValue ? balancedEnd(attributes, after + 1, 'value') + 1 : after
    if (written[0] === name) return hasValue ? attributes.slice(after + 1, stop).trim() : ''
    index = Math.max(stop, after + 1)
  }
  return undefined
}

function classTokens(attributes: string): string[] {
  const text = attributeValue(attributes, 'className') ?? ''
  return Array.from(text.matchAll(/["'`]([^"'`]*)["'`]/g), (found) => found[1] ?? '')
    .flatMap((literal) => literal.split(/\s+/))
    .filter((token) => token !== '')
}

function isOption(attributes: string): boolean {
  const role = /\brole=(?:"([^"]*)"|'([^']*)')/.exec(attributes)
  const named = role?.[1] ?? role?.[2]
  if (named !== undefined && (OPTION_ROLES as readonly string[]).includes(named)) return true
  const tokens = classTokens(attributes)
  return tokens.length > 0 && tokens.some((token) => (OPTION_CLASSES as readonly string[]).includes(token))
}

export function findRawButtons(files: readonly SourceFile[]): string[] {
  return sources(files)
    .filter(({ path }) => path.includes(inSrc('screens', '')) || path.includes(inSrc('shell', '')))
    .flatMap(({ path, content }) =>
      openingTags(content, 'button')
        .filter(({ attributes }) => !isOption(attributes))
        .map(
          ({ line }) =>
            `${path}:${line}: a raw <button> that is not an option or a row, use Boton`,
        ),
    )
}

/**
 * The entries of a list that carry an icon and are not an action: the rows of `Mas` and of the
 * settings. A shell entry (the bar, the sidebar) is covered by `aria-current` on its opening
 * tag instead, so a shell class is never added here. The list is closed: it does not grow.
 */
export const ENTRY_CLASSES = ['mas__item', 'ajustes__item'] as const

/** The chevron at the end of a row says "opens", it is not an icon on an action. */
const ROW_CHEVRON = /<Icono\s+nombre="chevron"\s*\/>/g

const LINK_FOLDERS = [inSrc('screens', ''), inSrc('shell', ''), inSrc('components', '')]
const IN_APP_LINK = inSrc('components', 'InAppLink.tsx')
const LINK_TAGS = ['InAppLink', 'PaneRowLink', 'Link', 'a']

/** The sources the link guards read: the three folders, minus the .boton* authors and InAppLink. */
function linkSources(files: readonly SourceFile[]): SourceFile[] {
  return seen(files, LINK_FOLDERS).filter(({ path }) => !BOTON_AUTHORS.includes(path) && path !== IN_APP_LINK)
}

export interface LinkTag {
  path: string
  line: number
  /** The `to=` value as written, `undefined` when the tag has none that can be read. */
  to: string | undefined
  attributes: string
  selfClosing: boolean
  /** The text up to the tag's own close; `undefined` for a self-closing tag or one never closed. */
  body: string | undefined
}

/** The text between a tag's opening and the close that matches it, counting same-name openings. */
function bodyOf(content: string, tag: string, opening: OpeningTag, openings: OpeningTag[]): string | undefined {
  const closing = new RegExp(`</${tag}\\s*>`, 'g')
  const events = [
    ...openings.filter(({ index }) => index > opening.end).map(({ index, selfClosing }) => ({ index, step: selfClosing ? 0 : 1 })),
    ...Array.from(content.matchAll(closing), (close) => ({ index: close.index, step: -1 })).filter(
      ({ index }) => index > opening.end,
    ),
  ].sort((a, b) => a.index - b.index)
  let depth = 1
  for (const { index, step } of events) {
    depth += step
    if (depth === 0) return content.slice(opening.end + 1, index)
  }
  return undefined
}

/** Every link tag the guards read, with its body when it has one. */
export function linkTags(files: readonly SourceFile[]): LinkTag[] {
  return linkSources(files).flatMap(({ path, content }) => {
    const clean = withoutComments(content)
    return LINK_TAGS.flatMap((tag) => {
      const openings = openingTags(clean, tag)
      return openings.map((opening) => ({
        path,
        line: opening.line,
        to: attributeValue(opening.attributes, 'to'),
        attributes: opening.attributes,
        selfClosing: opening.selfClosing,
        body: opening.selfClosing ? undefined : bodyOf(clean, tag, opening, openings),
      }))
    })
  })
}

/**
 * A link that holds an `<Icono` in its own body (a row's trailing chevron aside) draws an action,
 * and only `BotonLink` does.
 * Not flagged: the `ENTRY_CLASSES` rows, and under `shell/` a link with `aria-current`.
 */
export function findActionLinks(files: readonly SourceFile[]): string[] {
  return linkTags(files).flatMap(({ path, line, to, attributes, selfClosing, body }) => {
    const name = to ?? '<unreadable>'
    if (selfClosing) return []
    if (body === undefined) return [`${path}:${line}: cannot read the body of a link (to=${name}), close it`]
    if (!/<Icono(?=[\s/>])/.test(body.replace(ROW_CHEVRON, ''))) return []
    if (classTokens(attributes).some((token) => (ENTRY_CLASSES as readonly string[]).includes(token))) return []
    if (path.includes(inSrc('shell', '')) && attributeValue(attributes, 'aria-current') !== undefined) return []
    return [`${path}:${line}: an action drawn as a link (to=${name}), use BotonLink`]
  })
}

/** The imports that rename `Link` or `InAppLink`, which would hide a link from `findActionLinks`. */
export function findLinkAliases(files: readonly SourceFile[]): string[] {
  return linkSources(files).flatMap(({ path, content }) => {
    const clean = withoutComments(content)
    const lineOf = (index: number) => clean.slice(0, index).split('\n').length
    const renamed = Array.from(clean.matchAll(/import\s[^;]*?\{([^}]*)\}\s*from/g)).flatMap((statement) =>
      Array.from(
        (statement[1] ?? '').matchAll(/\b(?:Link|InAppLink)\s+as\s+\w+/g),
        (alias) => `${path}:${lineOf(statement.index)}: renames a link import (${alias[0]}), use its own name`,
      ),
    )
    const defaults = Array.from(clean.matchAll(/import\s+(\w+)\s*(?:,\s*\{[^}]*\})?\s*from\s*['"][^'"]*\/InAppLink['"]/g))
      .filter((statement) => statement[1] !== 'InAppLink')
      .map((statement) => `${path}:${lineOf(statement.index)}: renames the InAppLink import (as ${statement[1]}), use its own name`)
    return [...renamed, ...defaults]
  })
}

/** Every class token written in a string literal or template of the file. */
function stringTokens(content: string): { token: string; line: number }[] {
  const found: { token: string; line: number }[] = []
  const literal = /"([^"\n]*)"|'([^'\n]*)'|`([^`]*)`/g
  for (let match = literal.exec(content); match !== null; match = literal.exec(content)) {
    const text = match[1] ?? match[2] ?? match[3] ?? ''
    const line = content.slice(0, match.index).split('\n').length
    for (const token of text.split(/\s+/)) found.push({ token, line })
  }
  return found
}

const BOTON_CLASS = /^boton(?:--?[a-z0-9-]+)?$/

export function findBotonClasses(files: readonly SourceFile[]): string[] {
  return sources(files)
    .filter(({ path }) => !BOTON_AUTHORS.includes(path))
    .flatMap(({ path, content }) =>
      stringTokens(content)
        .filter(({ token }) => BOTON_CLASS.test(token))
        .map(({ token, line }) => `${path}:${line}: carries the class ${token}, only Boton and BotonLink draw .boton*`),
    )
}

/** The names `ICON_NAMES` lists, read from the source of `Icono.tsx`. */
export function listedIcons(iconoSource: string): string[] {
  const list = /ICON_NAMES\s*=\s*\[([\s\S]*?)\]\s*as const/.exec(iconoSource)
  return Array.from((list?.[1] ?? '').matchAll(/'([A-Za-z]+)'/g), (found) => found[1] ?? '')
}

/** The icon-only actions `ACTION_ICON` maps to each name, read from `botonVisual.tsx`. */
function actionIcons(botonVisualSource: string): Map<string, string> {
  const map = /ACTION_ICON[^=]*=\s*\{([\s\S]*?)\n\}/.exec(botonVisualSource)
  const pairs = Array.from((map?.[1] ?? '').matchAll(/(\w+):\s*'([A-Za-z]+)'/g))
  return new Map(pairs.map((pair) => [pair[1] ?? '', pair[2] ?? '']))
}

function seen(files: readonly SourceFile[], inside: readonly string[]): SourceFile[] {
  return sources(files).filter(({ path }) => inside.some((folder) => path.includes(folder)))
}

/** The source with its comments blanked, so a name in prose is not a use. */
export function withoutComments(content: string): string {
  return content.replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' ')).replace(/(^|\s)\/\/.*$/gm, '$1')
}

/** A line that hands an icon name to `Icono` or to a control: `nombre=`, `icon=`, `icono:`… */
const ICON_POSITION = /\b(?:nombre|icon|icono)\b\s*[=:]/

/**
 * A name is used when a screen, the shell or a component other than `Icono` and `Boton`
 * writes it as the icon of something (`nombre="x"`, `icon="x"`, `icon: 'x'`, on one line,
 * comments blanked): a route key or a label that merely equals it is not a use. A name that
 * `Boton`'s action map reaches counts only when some screen passes that `action`. `info` and
 * `atencion` count when `MasInfo` and `attention` have a caller under `screens/` or `shell/`.
 */
export function findUnusedIcons(files: readonly SourceFile[]): string[] {
  const all = files.map(({ path, content }) => ({ path: slashed(path), content }))
  const iconoSource = all.find(({ path }) => path === ICONO)?.content ?? ''
  const botonVisualSource = all.find(({ path }) => path === inSrc('components', 'botonVisual.tsx'))?.content ?? ''
  const actions = actionIcons(botonVisualSource)
  const users = seen(all, [inSrc('screens', ''), inSrc('shell', ''), inSrc('components', '')])
    .filter(({ path }) => path !== ICONO && path !== BOTON && path !== inSrc('components', 'botonVisual.tsx'))
    .map(({ content }) => withoutComments(content))
  const screens = seen(all, [inSrc('screens', ''), inSrc('shell', '')]).map(({ content }) => withoutComments(content))
  const iconOf = (name: string) => new RegExp(`['"\`]${name}['"\`]`)
  const writes = (name: string) =>
    users.some((content) => content.split('\n').some((line) => ICON_POSITION.test(line) && iconOf(name).test(line)))
  const passesAction = (action: string) =>
    screens.some((content) => new RegExp(`\\baction=(?:["']|\\{["'])${action}["']`).test(content))
  const iconHandle = (name: string) =>
    name === 'info'
      ? screens.some((content) => /<MasInfo[\s>]/.test(content))
      : name === 'atencion'
        ? screens.some((content) => /\battention\b/.test(content))
        : undefined

  return listedIcons(iconoSource).flatMap((name) => {
    const handled = iconHandle(name)
    if (handled !== undefined) return handled ? [] : [`${name}: no screen uses it`]
    const throughAction = [...actions].some(([action, icon]) => icon === name && passesAction(action))
    return writes(name) || throughAction ? [] : [`${name}: no screen uses it`]
  })
}
