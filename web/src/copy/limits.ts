/**
 * The limits on always-visible copy (docs/product/icon-and-text-rule.md) and the one
 * checker over the copy modules, run by `copyLimits.test.ts`.
 *
 * A limit is measured on the Spanish as shown, with every placeholder filled from
 * `SAMPLES` (the worst cases), never from fixture or API data.
 */

/** The kinds of always-visible text with a limit, in characters. */
export const LIMITS = {
  help: 80,
  notice: 80,
  moreInfo: 80,
  emptyTitle: 40,
  emptyLine: 80,
} as const

export type CopyKind = keyof typeof LIMITS

/** Over this a refusal must be listed in its module's `LONG_REFUSALS`. */
export const REFUSAL_AIM = 80

/** What a placeholder is filled with when a function's copy is measured. */
export const SAMPLES = {
  date: '28/09',
  amount: '$ 999.999',
  negativeAmount: '−$ 999.999',
  grams: '999,99 g',
  name: 'Nombre de veinticuatro c',
  count: '99',
} as const

/** Code points after NFC: `á` is one whether composed or not, an emoji is one. */
export function measure(text: string): number {
  return Array.from(text.normalize('NFC')).length
}

export interface LimitedCopy {
  kind: CopyKind
  text: string
}

/** What a copy module (a section of `web/src/copy/`) exports besides its strings. */
export interface CopyModule {
  LIMITED_COPY?: readonly LimitedCopy[]
  LONG_REFUSALS?: readonly string[]
  [name: string]: unknown
}

/** The violations of one copy module, each a sentence naming the module and the rule
 * (never the text's data). Empty when the module is sound. */
export function copyProblems(path: string, mod: CopyModule): string[] {
  const problems: string[] = []
  const { LIMITED_COPY, LONG_REFUSALS } = mod
  if (LIMITED_COPY === undefined) problems.push(`${path}: LIMITED_COPY is not exported`)
  if (LONG_REFUSALS === undefined) problems.push(`${path}: LONG_REFUSALS is not exported`)
  if (LIMITED_COPY === undefined || LONG_REFUSALS === undefined) return problems

  for (const { kind, text } of LIMITED_COPY) {
    if (measure(text) > LIMITS[kind]) {
      problems.push(`${path}: a ${kind} is over ${LIMITS[kind]} characters`)
    }
  }

  const exported = Object.entries(mod).filter(
    (entry): entry is [string, string] =>
      typeof entry[1] === 'string' && entry[0] !== 'LIMITED_COPY' && entry[0] !== 'LONG_REFUSALS',
  )
  const listed = new Set(LONG_REFUSALS)
  for (const [name, text] of exported) {
    if (measure(text) > REFUSAL_AIM && !listed.has(text)) {
      problems.push(`${path}: ${name} is over ${REFUSAL_AIM} characters and not in LONG_REFUSALS`)
    }
  }
  const values = new Set(exported.map(([, text]) => text))
  for (const text of LONG_REFUSALS) {
    if (!values.has(text)) problems.push(`${path}: LONG_REFUSALS lists a text the module does not export`)
    else if (measure(text) <= REFUSAL_AIM) problems.push(`${path}: LONG_REFUSALS lists a text that fits ${REFUSAL_AIM}`)
  }
  return problems
}
