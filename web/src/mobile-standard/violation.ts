/**
 * The seam between the checkers and the offender lists: a `Violation` is one failure of
 * one rule on one screen in one cell (size and theme). Checkers only return Violations;
 * `diffOffenders` alone decides whether one is allowed.
 *
 * `target` names the element: its `data-testid`, or else `role:accessible name` with
 * digit runs turned into `#`, cut to `TARGET_MAX_LENGTH`; a repeated target carries the
 * identity of its nearest identified ancestor as a suffix. It is empty exactly for a
 * page rule: each `Rule` declares here whether it is a `page` or an `element` rule.
 */

export const SIZES = ['320x568', '375x812', '430x932', '246x437'] as const
export type Size = (typeof SIZES)[number]

export const THEMES = ['claro', 'oscuro'] as const
export type Theme = (typeof THEMES)[number]

export const TARGET_MAX_LENGTH = 60

export type RuleKind = 'page' | 'element'

/** The closed set of rules, each with the kind that decides whether it has a target. */
export const RULE_KINDS = {
  unreachable: 'page',
  'h-scroll': 'page',
  'chrome-at-load': 'element',
  'chrome-mid-scroll': 'element',
  'touch-target': 'element',
  'input-font': 'element',
  'text-size': 'element',
  'figure-split': 'element',
  'name-overflow': 'element',
  autocomplete: 'element',
  inputmode: 'element',
  'input-type': 'element',
  'user-select': 'element',
  'touch-action': 'element',
  overscroll: 'page',
  contrast: 'element',
  'contrast-unprovable': 'element',
  'blank-while-loading': 'page',
  'aria-busy': 'page',
  'false-empty': 'element',
  'data-while-loading': 'element',
  'chrome-shift': 'element',
  'content-shift': 'element',
  'pending-state': 'element',
  'tabular-figures': 'element',
} as const satisfies Record<string, RuleKind>

export type Rule = keyof typeof RULE_KINDS

/**
 * A rule that is fixed and never listed: it has no offenders file, and the loader refuses
 * an entry for it.
 */
export const UNLISTED_RULES: readonly Rule[] = ['tabular-figures']

/** The rules that keep an offenders file: every rule but the unlisted ones. */
export const RULES = Object.keys(RULE_KINDS)
  .filter(isRule)
  .filter((rule) => !UNLISTED_RULES.includes(rule))

export function isRule(value: string): value is Rule {
  return Object.hasOwn(RULE_KINDS, value)
}

export function isSize(value: unknown): value is Size {
  return SIZES.some((size) => size === value)
}

export function isTheme(value: unknown): value is Theme {
  return THEMES.some((theme) => theme === value)
}

export interface Violation {
  screen: string
  size: Size
  theme: Theme
  rule: Rule
  target: string
}

/** The five fields an offender entry matches on, as one comparable key. */
export function cellKey(v: Violation): string {
  return JSON.stringify([v.screen, v.size, v.theme, v.rule, v.target])
}
