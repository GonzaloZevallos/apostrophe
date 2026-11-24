import { byFoldedName, foldForSearch, matchesQuery, matchRange } from '../components/selectorSearch'

/** What the search needs from a customer; the API's `Customer` satisfies it. */
export type SearchableCustomer = { id: number; name: string; phone_display: string | null }

/** How many recent customers the Sheet shows, and how many skeleton rows it draws while they load. */
export const RECENT_ROWS = 3

const DIGIT = /[0-9]/

function digitsOf(text: string): string {
  let digits = ''
  for (const character of text) if (DIGIT.test(character)) digits += character
  return digits
}

/** Where the digits of `query` sit in `display`, as `[start, end)` indices into `display` as the API
 * sent it (already grouped, never regrouped): the range runs from the first matched digit to just
 * after the last, so it spans the spaces and dashes between them. `null` when the query has no digits,
 * there is no phone, or the digits are not a contiguous run of the phone's digits. */
function phoneRange(display: string | null, query: string): [number, number] | null {
  const needle = digitsOf(query)
  if (needle === '' || display === null) return null
  let digits = ''
  const positions: number[] = []
  for (let index = 0; index < display.length; index += 1) {
    const character = display.charAt(index)
    if (!DIGIT.test(character)) continue
    digits += character
    positions.push(index)
  }
  const found = digits.indexOf(needle)
  if (found === -1) return null
  const start = positions[found]
  const last = positions[found + needle.length - 1]
  if (start === undefined || last === undefined) return null
  return [start, last + 1]
}

/** The customers whose name holds the trimmed `query` or whose phone digits hold the query's digits.
 * A blank query matches nothing. Names that start with the query come first, the rest (phone-only
 * matches included) after; each group is alphabetical ignoring accents and capitals. */
export function matchCustomers<C extends SearchableCustomer>(customers: readonly C[], query: string): C[] {
  const trimmed = query.trim()
  if (trimmed === '') return []
  const needle = foldForSearch(trimmed)
  const starting: C[] = []
  const rest: C[] = []
  for (const customer of customers) {
    if (!matchesQuery(customer.name, trimmed) && phoneRange(customer.phone_display, trimmed) === null) continue
    if (foldForSearch(customer.name).startsWith(needle)) starting.push(customer)
    else rest.push(customer)
  }
  return [...starting.sort(byFoldedName), ...rest.sort(byFoldedName)]
}

/** The customers for `ids`, in the order of `ids`: the ids with no customer are dropped first, then
 * the first `limit` are kept. */
export function resolveRecent<C extends SearchableCustomer>(
  customers: readonly C[],
  ids: readonly number[],
  limit: number,
): C[] {
  const byId = new Map<number, C>()
  for (const customer of customers) byId.set(customer.id, customer)
  const resolved: C[] = []
  for (const id of ids) {
    const customer = byId.get(id)
    if (customer !== undefined) resolved.push(customer)
  }
  return resolved.slice(0, limit)
}

/** The `[start, end)` indices into `shown` to highlight for `query`, or `null`. A name goes through
 * `matchRange`; a phone is `phone_display` as the API sent it, matched on the query's digits. */
export function highlightRanges(
  shown: string,
  query: string,
  field: 'name' | 'phone',
): [number, number] | null {
  return field === 'name' ? matchRange(shown, query) : phoneRange(shown, query)
}
