import type { SAMPLES } from '../copy/limits.ts'

/**
 * The placeholders a copy key may hold, each mapped to the kind of worst-case sample the
 * length checks fill it with (`SAMPLES` in `../copy/limits.ts`, the only place a sample
 * value is defined). A name missing here is a problem for `copyProblems` and for the keyed
 * baseline check.
 *
 * Naming rule: a placeholder is named by the CONTEXT.md term it holds, in camelCase
 * (`variety`, `customer`, `date`, `amount`, `grams`). It takes a role prefix only when one
 * string holds two of the same term (`fromDate`, `toDate`). The plural count is always
 * `count`. One line per name, in alphabetical order.
 */
export const PLACEHOLDERS: Record<string, keyof typeof SAMPLES> = {
  amount: 'amount',
  business: 'name',
  count: 'count',
  customer: 'name',
  date: 'date',
  fromDate: 'date',
  grams: 'grams',
  name: 'name',
  negativeAmount: 'negativeAmount',
  parent: 'name',
  toDate: 'date',
}
