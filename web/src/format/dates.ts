/**
 * Formats API dates (`"YYYY-MM-DD"` strings, the business day, ADR-0001) and API
 * months (`"YYYY-MM"`). The front never turns an API date into `Date` or passes it
 * to `Date.parse` (plan, invariants): every function here works on the string's
 * digits alone, and "today" always comes in as a parameter, read from `GET /auth/me`,
 * never from the device's clock.
 */

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const MONTH_RE = /^(\d{4})-(\d{2})$/

function parseDate(iso: string): { year: string; month: string; day: string } {
  const match = DATE_RE.exec(iso)
  if (match === null) throw new Error(`not an API date: ${iso}`)
  const [, year, month, day] = match
  return { year: year ?? '', month: month ?? '', day: day ?? '' }
}

function parseMonth(month: string): { year: string; monthNumber: number } {
  const match = MONTH_RE.exec(month)
  if (match === null) throw new Error(`not an API month: ${month}`)
  const [, year, monthPart] = match
  const monthNumber = Number(monthPart)
  if (monthNumber < 1 || monthNumber > 12) throw new Error(`not an API month: ${month}`)
  return { year: year ?? '', monthNumber }
}

/** `"2026-10-02"` → `"02/10"`, or `"14/12/2025"` when its year differs from
 * `todayIso`'s. */
export function formatDate(iso: string, todayIso: string): string {
  const { year, month, day } = parseDate(iso)
  const base = `${day}/${month}`
  return year === parseDate(todayIso).year ? base : `${base}/${year}`
}

/** Always with the year: for a card or a detail with no "today" to compare against. */
export function formatDateLong(iso: string): string {
  const { year, month, day } = parseDate(iso)
  return `${day}/${month}/${year}`
}

/** `"desde el 02/10"`, for a price's "Rige desde". */
export function sinceWhen(iso: string, todayIso: string): string {
  return `desde el ${formatDate(iso, todayIso)}`
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

/** `"2026-10"` → `"Octubre 2026"`, for Gastos's month header. */
export function formatMonthLong(month: string): string {
  const { year, monthNumber } = parseMonth(month)
  return `${MONTH_NAMES[monthNumber - 1]} ${year}`
}

/** The month before or after `month` (`delta` in either direction), for moving
 * between months in Gastos. */
export function shiftMonth(month: string, delta: number): string {
  const { year, monthNumber } = parseMonth(month)
  const total = Number(year) * 12 + (monthNumber - 1) + delta
  const shiftedYear = Math.floor(total / 12)
  const shiftedMonth = ((total % 12) + 12) % 12
  return `${String(shiftedYear).padStart(4, '0')}-${String(shiftedMonth + 1).padStart(2, '0')}`
}
