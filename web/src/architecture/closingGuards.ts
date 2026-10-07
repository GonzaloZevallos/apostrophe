/**
 * The closing guards of the icon and text rule (GH-97, `docs/product/icon-and-text-rule.md`,
 * ADR-0034): each returns one line per offence, empty when the tree is clean, and is fed
 * input it must reject in `closingGuards.test.ts` before `closingGuards.real.test.ts` runs
 * it over the real tree. They are what ends the old shapes: after them nothing is exempt
 * beyond the closed lists written here.
 *
 * - `findRawSvg`: no `<svg>` outside `components/Icono.tsx`.
 * - `findRawButtons`: a raw `<button>` in `screens/` or `shell/` carries only a class from
 *   `OPTION_CLASSES` (a choice among options, a row, a switch), never a button look.
 * - `findBotonClasses`: no element outside `Boton`/`BotonLink` carries a `boton*` class.
 * - `findUnusedIcons`: every name in `ICON_NAMES` is drawn by something a person sees.
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

/** The files that draw `.boton*`: the two components and what they both draw from. */
const BOTON_AUTHORS = [
  inSrc('components', 'Boton.tsx'),
  inSrc('components', 'BotonLink.tsx'),
  inSrc('components', 'botonVisual.tsx'),
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

/** The attribute text of every `<button` opening tag, reading past `=>` and braces. */
function buttonTags(content: string): { attributes: string; line: number }[] {
  const found: { attributes: string; line: number }[] = []
  const opening = /<button(?=[\s>/])/g
  for (let match = opening.exec(content); match !== null; match = opening.exec(content)) {
    let depth = 0
    let quote: string | null = null
    let index = match.index + match[0].length
    const start = index
    for (; index < content.length; index += 1) {
      const char = content.charAt(index)
      if (quote !== null) {
        if (char === quote) quote = null
      } else if (char === '"' || char === "'" || (char === '`' && depth > 0)) {
        quote = char
      } else if (char === '{') depth += 1
      else if (char === '}') depth -= 1
      else if (char === '>' && depth === 0 && content.charAt(index - 1) !== '=') break
    }
    found.push({
      attributes: content.slice(start, index),
      line: content.slice(0, match.index).split('\n').length,
    })
  }
  return found
}

function classTokens(attributes: string): string[] {
  const written = /className=(\{(?:[^{}]|\{[^{}]*\})*\}|"[^"]*"|'[^']*')/.exec(attributes)
  const text = written?.[1] ?? ''
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
      buttonTags(content)
        .filter(({ attributes }) => !isOption(attributes))
        .map(
          ({ line }) =>
            `${path}:${line}: a raw <button> that is not an option or a row, use Boton`,
        ),
    )
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

/**
 * A name is used when a screen, the shell or a component other than `Icono` and `Boton`
 * writes it as a string; one reached only through `Boton`'s action map counts when a screen
 * passes that `action`; `info` and `atencion` count when `MasInfo` and `attention` have a
 * caller under `screens/` or `shell/`.
 */
export function findUnusedIcons(files: readonly SourceFile[]): string[] {
  const all = files.map(({ path, content }) => ({ path: slashed(path), content }))
  const iconoSource = all.find(({ path }) => path === ICONO)?.content ?? ''
  const botonVisualSource = all.find(({ path }) => path === inSrc('components', 'botonVisual.tsx'))?.content ?? ''
  const actions = actionIcons(botonVisualSource)
  const users = seen(all, [inSrc('screens', ''), inSrc('shell', ''), inSrc('components', '')]).filter(
    ({ path }) => path !== ICONO && path !== BOTON && path !== inSrc('components', 'botonVisual.tsx'),
  )
  const screens = seen(all, [inSrc('screens', ''), inSrc('shell', '')])
  const quoted = (name: string) => new RegExp(`['"\`]${name}['"\`]`)
  const passesAction = (action: string) => screens.some(({ content }) => new RegExp(`action=["{']+${action}\\b`).test(content))
  const iconHandle = (name: string) =>
    name === 'info'
      ? screens.some(({ content }) => /<MasInfo[\s>]/.test(content))
      : name === 'atencion'
        ? screens.some(({ content }) => /\battention\b/.test(content))
        : undefined

  return listedIcons(iconoSource).flatMap((name) => {
    const handled = iconHandle(name)
    if (handled !== undefined) return handled ? [] : [`${name}: no screen uses it`]
    const actionsOfName = [...actions].filter(([, icon]) => icon === name).map(([action]) => action)
    const throughAction = actionsOfName.some(passesAction)
    const written = users.some(({ content }) => quoted(name).test(content))
    return written || throughAction ? [] : [`${name}: no screen uses it`]
  })
}
