/**
 * What a `screens.json` row or a walked state's step may name: an English text, or a locale
 * key (`namespace:path`, `isKeyShaped`) that stands for it. Browserless and node-loadable: it
 * imports only `./resolve.ts` and `./keyShape.ts` and never reads `import.meta`
 * (`stepPurity.test.ts` enforces both), so Playwright and `scripts/design/comparisons.mjs`
 * load it under plain node. The bundle is always given by the caller.
 *
 * Only a step's `click`, `press`, `wait` and `fill.label` are texts of the page. `fill.value`
 * (what is typed), `select` and `offline` are never resolved, and neither are sample names.
 *
 * No message here holds a step's text: only the screen, the step index and the field.
 */

import { isKeyShaped } from './keyShape.ts'
import { resolveKey, type Bundle } from './resolve.ts'

/** A key-shaped text resolves through `resolveKey` (it throws `MissingKeyError` when it is missing); any other text is returned unchanged. */
export function stepText(text: string, bundle: Bundle): string {
  return isKeyShaped(text) ? resolveKey(bundle, text) : text
}

type Field = 'click' | 'press' | 'wait' | 'fill.label'

/** The texts a step names, by field; `fill.value` is not one of them. */
function namedTexts(step: object): [Field, unknown][] {
  const named: [Field, unknown][] = []
  for (const field of ['click', 'press', 'wait'] as const) if (field in step) named.push([field, Reflect.get(step, field)])
  const fill: unknown = Reflect.get(step, 'fill')
  if (typeof fill === 'object' && fill !== null && 'label' in fill) named.push(['fill.label', fill.label])
  return named
}

function resolves(text: unknown, bundle: Bundle): boolean {
  if (typeof text !== 'string' || !isKeyShaped(text)) return false
  try {
    resolveKey(bundle, text)
    return true
  } catch {
    // Missing, an object, `$t(`, a placeholder with no argument: none of them is a text the page shows.
    return false
  }
}

type StepsRow = { screen: string; steps?: readonly object[] }

/** A row is converted when any named text of its steps (`click`, `press`, `wait`, `fill.label`) is key-shaped. */
export function isConvertedRow(row: StepsRow): boolean {
  return (row.steps ?? []).some((step) => namedTexts(step).some(([, text]) => typeof text === 'string' && isKeyShaped(text)))
}

/**
 * In a converted row every named text must be key-shaped and resolve. One message per failing
 * field, with the zero-based index in `steps` (every kind of step counts). An unconverted row
 * gives none.
 */
export function rowProblems(row: StepsRow, bundle: Bundle): string[] {
  if (!isConvertedRow(row)) return []
  const problems: string[] = []
  for (const [index, step] of (row.steps ?? []).entries()) {
    for (const [field, text] of namedTexts(step)) {
      if (!resolves(text, bundle)) problems.push(`${row.screen}: step ${index} ${field} is not a resolving key`)
    }
  }
  return problems
}

/**
 * The step as the page reads it: `click`, `press`, `wait` and `fill.label` through `stepText`,
 * everything else (`fill.value`, `select`, `offline`, `activate`) untouched. The one function
 * every walker calls.
 */
export function resolveStep<S extends object>(step: S, bundle: Bundle): S {
  const patch: { click?: string; press?: string; wait?: string; fill?: object } = {}
  for (const field of ['click', 'press', 'wait'] as const) {
    const text: unknown = Reflect.get(step, field)
    if (typeof text === 'string') patch[field] = stepText(text, bundle)
  }
  const fill: unknown = Reflect.get(step, 'fill')
  if (typeof fill === 'object' && fill !== null && 'label' in fill && typeof fill.label === 'string') {
    patch.fill = { ...fill, label: stepText(fill.label, bundle) }
  }
  return { ...step, ...patch }
}
