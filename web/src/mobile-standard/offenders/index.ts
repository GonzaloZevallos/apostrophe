/**
 * The known offenders: one JSON file per rule (`offenders/<rule>.json`), each entry
 * `{screen, rule, target, issue, sizes?, themes?}`. The list can only shrink: every
 * entry names the open area issue that removes it, a cell it lists must still fail, and
 * a failure it does not list fails the run (`diffOffenders`).
 *
 * `FILES` takes one static JSON import per rule, so a rule without a file is a `tsc`
 * error (`Record<Rule, unknown>`), and nothing here needs a glob or `node:`.
 */

import { SCREEN_NAMES } from '../registry.ts'
import {
  cellKey,
  isRule,
  isSize,
  isTheme,
  RULE_KINDS,
  SIZES,
  THEMES,
  type Rule,
  type Size,
  type Theme,
  type Violation,
} from '../violation.ts'
import ariaBusy from './aria-busy.json' with { type: 'json' }
import autocomplete from './autocomplete.json' with { type: 'json' }
import blankWhileLoading from './blank-while-loading.json' with { type: 'json' }
import chromeAtLoad from './chrome-at-load.json' with { type: 'json' }
import chromeMidScroll from './chrome-mid-scroll.json' with { type: 'json' }
import chromeShift from './chrome-shift.json' with { type: 'json' }
import contentShift from './content-shift.json' with { type: 'json' }
import contrast from './contrast.json' with { type: 'json' }
import contrastUnprovable from './contrast-unprovable.json' with { type: 'json' }
import dataWhileLoading from './data-while-loading.json' with { type: 'json' }
import falseEmpty from './false-empty.json' with { type: 'json' }
import figureSplit from './figure-split.json' with { type: 'json' }
import hScroll from './h-scroll.json' with { type: 'json' }
import inputFont from './input-font.json' with { type: 'json' }
import inputType from './input-type.json' with { type: 'json' }
import inputmode from './inputmode.json' with { type: 'json' }
import nameOverflow from './name-overflow.json' with { type: 'json' }
import overscroll from './overscroll.json' with { type: 'json' }
import pendingState from './pending-state.json' with { type: 'json' }
import textSize from './text-size.json' with { type: 'json' }
import touchAction from './touch-action.json' with { type: 'json' }
import touchTarget from './touch-target.json' with { type: 'json' }
import unreachable from './unreachable.json' with { type: 'json' }
import userSelect from './user-select.json' with { type: 'json' }

export const FILES: Record<Rule, unknown> = {
  unreachable,
  'h-scroll': hScroll,
  'chrome-at-load': chromeAtLoad,
  'chrome-mid-scroll': chromeMidScroll,
  'touch-target': touchTarget,
  'input-font': inputFont,
  'text-size': textSize,
  'figure-split': figureSplit,
  'name-overflow': nameOverflow,
  autocomplete,
  inputmode,
  'input-type': inputType,
  'user-select': userSelect,
  'touch-action': touchAction,
  overscroll,
  contrast,
  'contrast-unprovable': contrastUnprovable,
  'blank-while-loading': blankWhileLoading,
  'aria-busy': ariaBusy,
  'false-empty': falseEmpty,
  'data-while-loading': dataWhileLoading,
  'chrome-shift': chromeShift,
  'content-shift': contentShift,
  'pending-state': pendingState,
}

/** The fixed area map: the only issue numbers an entry may carry (#45–#49, #59, #60, #78). */
export const AREA_ISSUES: readonly number[] = [45, 46, 47, 48, 49, 59, 60, 78]

export interface Offender extends Violation {
  issue: number
}

function asRecord(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${what} is not an object`)
  }
  return Object.fromEntries(Object.entries(value))
}

function subset<T>(
  value: unknown,
  all: readonly T[],
  guard: (item: unknown) => item is T,
  what: string,
): readonly T[] {
  if (value === undefined) return all
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${what} is not a non-empty list`)
  const items: T[] = []
  for (const item of value as unknown[]) {
    if (!guard(item)) throw new Error(`${what} holds an unknown value`)
    items.push(item)
  }
  return items
}

function parseEntry(raw: unknown, file: Rule, where: string): Offender[] {
  const entry = asRecord(raw, where)
  const screen = entry['screen']
  if (typeof screen !== 'string' || !SCREEN_NAMES.has(screen)) {
    throw new Error(`${where}: unknown screen`)
  }
  const rule = entry['rule']
  if (typeof rule !== 'string' || !isRule(rule)) throw new Error(`${where}: unknown rule`)
  if (rule !== file) throw new Error(`${where}: rule ${rule} sits in the file of ${file}`)
  const target = entry['target']
  if (typeof target !== 'string') throw new Error(`${where}: target is not a string`)
  if (RULE_KINDS[rule] === 'page' && target !== '') throw new Error(`${where}: a page rule has no target`)
  if (RULE_KINDS[rule] === 'element' && target === '') {
    throw new Error(`${where}: an element rule needs a target`)
  }
  const issue = entry['issue']
  if (typeof issue !== 'number' || !Number.isInteger(issue) || issue <= 0) {
    throw new Error(`${where}: issue is missing or not a positive integer`)
  }
  if (!AREA_ISSUES.includes(issue)) throw new Error(`${where}: issue #${issue} is not in the area map`)
  const sizes = subset<Size>(entry['sizes'], SIZES, isSize, `${where}: sizes`)
  const themes = subset<Theme>(entry['themes'], THEMES, isTheme, `${where}: themes`)
  return sizes.flatMap((size) => themes.map((theme) => ({ screen, size, theme, rule, target, issue })))
}

/** Every entry of every rule's file, expanded into one offender per cell. */
export function parseOffenders(files: Record<Rule, unknown> = FILES): Offender[] {
  const out: Offender[] = []
  const seen = new Set<string>()
  for (const [name, content] of Object.entries(files)) {
    if (!isRule(name)) throw new Error(`${name} is not a rule`)
    if (!Array.isArray(content)) throw new Error(`${name}.json is not a list`)
    const entries: unknown[] = content
    entries.forEach((raw, index) => {
      for (const offender of parseEntry(raw, name, `${name}.json #${index}`)) {
        const key = cellKey(offender)
        if (seen.has(key)) throw new Error(`${name}.json #${index}: the same cell is listed twice`)
        seen.add(key)
        out.push(offender)
      }
    })
  }
  return out
}

export const OFFENDERS: readonly Offender[] = parseOffenders(FILES)

export interface OffenderDiff {
  /** Failures no entry allows: new offenders. */
  unlisted: Violation[]
  /** Entries whose cell now passes: fixed, and still listed. */
  fixedButListed: Offender[]
}

/**
 * The only place that decides whether a violation is allowed. An entry matches a
 * violation on screen, size, theme, rule and target, all five.
 */
export function diffOffenders(expected: readonly Offender[], actual: readonly Violation[]): OffenderDiff {
  const listed = new Set(expected.map(cellKey))
  const failing = new Set(actual.map(cellKey))
  const seenUnlisted = new Set<string>()
  return {
    unlisted: actual.filter((violation) => {
      const key = cellKey(violation)
      if (listed.has(key) || seenUnlisted.has(key)) return false
      seenUnlisted.add(key)
      return true
    }),
    fixedButListed: expected.filter((offender) => !failing.has(cellKey(offender))),
  }
}

/** The entries that belong to one cell of the walk, for `diffOffenders` to compare with its failures. */
export function offendersOfCell(
  offenders: readonly Offender[],
  cell: { screen: string; size: Size; theme: Theme },
): Offender[] {
  return offenders.filter(
    (offender) =>
      offender.screen === cell.screen && offender.size === cell.size && offender.theme === cell.theme,
  )
}
