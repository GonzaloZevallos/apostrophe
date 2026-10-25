import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { ENGLISH_DIR } from './resourceTypes.ts'

/** The command that rewrites the committed en-XA files; the staleness failure names it. */
export const PSEUDO_COMMAND = 'npm run i18n:pseudo'

export const PSEUDO_DIR = join(ENGLISH_DIR, '..', 'en-XA')

// The same table, growth and filler as `app/shared/copy/pseudo.py`; both generators assert
// the pairs of `tests/fixtures/pseudo_shared.json`, so a drift between them fails a test.
const OPEN = '⟦'
const CLOSE = '⟧'
const GROWTH = 0.35
const FILLER = '·~'
const PLAIN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
const ACCENTED = 'ÅßÇÐÈḞĜĤÌĴĶĿṀŇÖṖǪŘŠŤÛṼŴẊÝŽåƀçđèḟĝĥìĵķłṁňöṗǫřšťûṽŵẋýž'
const LOOKALIKE = new Map([...PLAIN].map((letter, index) => [letter, [...ACCENTED][index] ?? letter]))

// What i18next reads inside a value and the pseudo text must keep as it is:
// `{{name}}` (with a format or spaces), `$t(...)` nesting, and `<0>…</0>` / `<b>…</b>` tags.
const PLACEHOLDER = /\{\{[^{}]*\}\}|\$t\([^)]*\)|<\/?[A-Za-z0-9]+\s*\/?>/g

function accent(plain: string): string {
  return [...plain].map((letter) => LOOKALIKE.get(letter) ?? letter).join('')
}

/** One English value as its `en-XA` text: wrapped, accented, about 35 % longer. */
export function pseudoText(text: string): string {
  if (text === '') return text
  const pieces: string[] = []
  let length = 0
  let position = 0
  for (const found of text.matchAll(PLACEHOLDER)) {
    const plain = text.slice(position, found.index)
    pieces.push(accent(plain), found[0])
    length += [...plain].length
    position = found.index + found[0].length
  }
  const tail = text.slice(position)
  pieces.push(accent(tail))
  length += [...tail].length
  const filler = FILLER.repeat(length).slice(0, Math.ceil(GROWTH * length))
  return `${OPEN}${pieces.join('')}${filler}${CLOSE}`
}

type Tree = { readonly [key: string]: string | Tree }

/** The same tree with every string value pseudo-localised: keys, suffixes and nesting stay. */
export function generatePseudo(english: Tree): Tree {
  return Object.fromEntries(
    Object.entries(english).map(([key, value]) => [
      key,
      typeof value === 'string' ? pseudoText(value) : generatePseudo(value),
    ]),
  )
}

function jsonFiles(dir: string): readonly string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .sort()
}

function readTree(path: string): Tree {
  return JSON.parse(readFileSync(path, 'utf8')) as Tree
}

/** Writes `en-XA/<ns>.json` for every English file and removes the ones with no English. */
export function writePseudo(englishDir: string = ENGLISH_DIR, outDir: string = PSEUDO_DIR): void {
  mkdirSync(outDir, { recursive: true })
  const english = jsonFiles(englishDir)
  for (const file of jsonFiles(outDir)) {
    if (!english.includes(file)) rmSync(join(outDir, file))
  }
  for (const file of english) {
    const text = `${JSON.stringify(generatePseudo(readTree(join(englishDir, file))), null, 2)}\n`
    writeFileSync(join(outDir, file), text)
  }
}

/** What is wrong with the committed en-XA files, comparing parsed JSON; empty when fresh. */
export function pseudoProblems(
  englishDir: string = ENGLISH_DIR,
  outDir: string = PSEUDO_DIR,
): readonly string[] {
  const english = jsonFiles(englishDir)
  const committed = jsonFiles(outDir)
  const hint = `run \`${PSEUDO_COMMAND}\` and commit the result`
  const problems: string[] = []
  for (const file of english) {
    if (!committed.includes(file)) {
      problems.push(`en-XA/${file} is missing: ${hint}`)
      continue
    }
    const expected = generatePseudo(readTree(join(englishDir, file)))
    if (!isDeepStrictEqual(readTree(join(outDir, file)), expected)) {
      problems.push(`en-XA/${file} disagrees with en/${file}: ${hint}`)
    }
  }
  for (const file of committed) {
    if (!english.includes(file)) problems.push(`en-XA/${file} has no en/${file}: ${hint}`)
  }
  return problems
}
