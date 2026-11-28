/**
 * The pure logic of the Expenses month summary: the category segments of the bar, the short
 * amount, the list order and the muted line of a row. It returns data, never text: the words
 * come from `copy/expenses.ts` where the screen renders them, so this file imports no React
 * and no copy.
 */

import type { Expense, MonthlyView } from '../../api/expenses'
import { relativeDay, type RelativeDay } from '../../format/dates'

export type ColorIndex = 0 | 1 | 2 | 'others'

export interface Segment {
  /** The category id, or `'others'` for the one segment that sums every category after the third. */
  key: number | 'others'
  /** The category name, or null for Others (the screen words it). */
  name: string | null
  /** In currency units. */
  amount: number
  /** Whole percent of the month, rounded half up. Never adjusted to sum to 100. */
  percent: number
  /** The exact fraction of the month, `minor / total`. Never adjusted, so every share of a month sums to 1. */
  share: number
  /** The amount as a short figure, from `shortAmount` at the Business's decimals. */
  short: ShortAmount
  colorIndex: ColorIndex
}

export interface Summary {
  /** The sum of the segments' amounts, in currency units. */
  total: number
  segments: Segment[]
}

const TOP = 3
const COLORS = [0, 1, 2] as const

/** The one conversion of an API amount to minor units. API amounts never carry more decimals
 * than the Money format allows, so this is exact. */
function toMinor(amount: number, decimals: number): number {
  return Math.round(amount * 10 ** decimals)
}

interface Ranked {
  id: number
  name: string
  minor: number
}

function ranking(a: Ranked, b: Ranked): number {
  if (a.minor !== b.minor) return b.minor - a.minor
  if (a.name !== b.name) return a.name < b.name ? -1 : 1
  return a.id - b.id
}

/** `floor((200a + t) / (2t))`, in integers: `a / t` as a percent, half up. */
function percentOf(minor: number, total: number): number {
  return Math.floor((200 * minor + total) / (2 * total))
}

/** The one constructor of a `Segment`: the top three and Others alike, so amount, percent, share and
 * short amount always come from the same `minor` and `total`. */
function segmentOf(
  key: Segment['key'],
  name: string | null,
  minor: number,
  total: number,
  unit: number,
  colorIndex: ColorIndex,
  decimals: number,
): Segment {
  return {
    key,
    name,
    amount: minor / unit,
    percent: percentOf(minor, total),
    share: minor / total,
    short: shortAmount(minor / unit, decimals),
    colorIndex,
  }
}

/** The month's category segments: zeros dropped, ranked by amount, the top three coloured and the
 * rest summed into Others. The total is the sum of the converted subtotals; `view.total` is not read. */
export function summarize(view: MonthlyView, decimals: number): Summary {
  const ranked = view.categories
    .map((category) => ({ id: category.id, name: category.name, minor: toMinor(category.subtotal, decimals) }))
    .filter((category) => category.minor !== 0)
    .sort(ranking)
  const total = ranked.reduce((sum, category) => sum + category.minor, 0)
  if (total === 0) return { total: 0, segments: [] }
  const unit = 10 ** decimals
  const segments: Segment[] = ranked
    .slice(0, TOP)
    .map((category, index) =>
      segmentOf(category.id, category.name, category.minor, total, unit, COLORS[index] ?? 'others', decimals),
    )
  const rest = ranked.slice(TOP)
  if (rest.length > 0) {
    const others = rest.reduce((sum, category) => sum + category.minor, 0)
    segments.push(segmentOf('others', null, others, total, unit, 'others', decimals))
  }
  return { total: total / unit, segments }
}

/** A short amount as data: the screen adds the suffix and the decimal comma. */
export type ShortAmount =
  /** `value` is the amount exactly as given. */
  | { unit: 'none'; value: number }
  /** `value` is a whole number of thousands. */
  | { unit: 'thousand'; value: number }
  /** `value` is a whole number of tenths of a million: 10 reads 1,0 and 12346 reads 1234,6. */
  | { unit: 'million'; value: number }

/** Below 1,000 the full amount; from 1,000 whole thousands, half up; from 999,500 millions with one
 * decimal. The rounding is done first, in integers, and the unit is picked from the rounded figure,
 * so 999,499 is 999 thousands and 999,500 is 1,0 millions. */
export function shortAmount(amount: number, decimals: number): ShortAmount {
  const unit = 10 ** decimals
  const minor = toMinor(amount, decimals)
  if (minor < 1000 * unit) return { unit: 'none', value: amount }
  const thousands = Math.floor((minor + 500 * unit) / (1000 * unit))
  if (thousands < 1000) return { unit: 'thousand', value: thousands }
  return { unit: 'million', value: Math.floor((minor + 50000 * unit) / (100000 * unit)) }
}

/** Newest date first, then the higher id first. */
export function expenseOrder(a: Expense, b: Expense): number {
  if (a.spent_on !== b.spent_on) return a.spent_on < b.spent_on ? 1 : -1
  return b.id - a.id
}

export interface LatestRow {
  expense: Expense
  categoryName: string
}

/** Every expense of the month, newest first, each with its category's name: the "Latest" list. */
export function latestExpenses(view: MonthlyView): LatestRow[] {
  return view.categories
    .flatMap((category) => category.expenses.map((expense) => ({ expense, categoryName: category.name })))
    .sort((a, b) => expenseOrder(a.expense, b.expense))
}

export type MutedPart =
  | { kind: 'category'; name: string }
  | { kind: 'day'; day: RelativeDay }
  | { kind: 'method'; name: string }

/** The parts of a row's muted line, in order, with no separators: so the line can never start or end
 * with a dot. The method is absent when the expense has none. */
export function mutedLine(expense: Expense, categoryName: string, todayIso: string): readonly MutedPart[] {
  const parts: MutedPart[] = [
    { kind: 'category', name: categoryName },
    { kind: 'day', day: relativeDay(expense.spent_on, todayIso) },
  ]
  if (expense.payment_method !== null) parts.push({ kind: 'method', name: expense.payment_method.name })
  return parts
}
