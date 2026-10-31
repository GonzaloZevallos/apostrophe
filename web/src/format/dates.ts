import type { TFunction } from 'i18next'
import { DATES_TEXT } from '../copy/dates'
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

function splitMonth(month: string): { year: string; monthNumber: number } {
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

/** `"2026-10-09"` → `"09/10"`, with no "today" to compare against: for a footer
 * written while signed out (an invitation link), where there is no session to read
 * one from. */
export function formatDateShort(iso: string): string {
  const { day, month } = parseDate(iso)
  return `${day}/${month}`
}

/** The "Rige desde" chip's text: `"Hoy 15/10"` for today, else `"02/10"` (no year, no
 * "Hoy"). Equality is the whole date, so the same day of another year is not today. The caller
 * passes its `t`, so the word "Hoy" is resolved on that render and follows a language switch. */
export function chipDate(iso: string, todayIso: string, t: TFunction): string {
  return iso === todayIso ? t('common:todayWith', { date: formatDateShort(iso) }) : formatDateShort(iso)
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
  DATES_TEXT.enero, DATES_TEXT.febrero, DATES_TEXT.marzo, DATES_TEXT.abril, DATES_TEXT.mayo, DATES_TEXT.junio,
  DATES_TEXT.julio, DATES_TEXT.agosto, DATES_TEXT.septiembre, DATES_TEXT.octubre, DATES_TEXT.noviembre, DATES_TEXT.diciembre,
]

const SEARCH_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

/** The month Gastos shows: the first `month` value of the search that is a valid
 * `YYYY-MM`, else the month of `today`. The one reader of `?month=` (future months
 * stay allowed). */
export function parseMonth(search: URLSearchParams, today: string): string {
  const valid = search.getAll('month').find((value) => SEARCH_MONTH_RE.test(value))
  return valid ?? today.slice(0, 7)
}

/** `"2026-10"` → `"Octubre 2026"`, for Gastos's month header. */
export function formatMonthLong(month: string): string {
  const { year, monthNumber } = splitMonth(month)
  return `${MONTH_NAMES[monthNumber - 1]} ${year}`
}

/** The month before or after `month` (`delta` in either direction), for moving
 * between months in Gastos. */
export function shiftMonth(month: string, delta: number): string {
  const { year, monthNumber } = splitMonth(month)
  const total = Number(year) * 12 + (monthNumber - 1) + delta
  const shiftedYear = Math.floor(total / 12)
  const shiftedMonth = ((total % 12) + 12) % 12
  return `${String(shiftedYear).padStart(4, '0')}-${String(shiftedMonth + 1).padStart(2, '0')}`
}

/* ------------------------------------------------------------------ */
/* Periods (plan, invariants): Hoy, Semana, Mes, Fechas' defaults and the form's max   */
/* date are all computed here, on an API date's digits alone, from `me.today`, never  */
/* `new Date()` or `Date.parse`. The day-count conversion below is Howard Hinnant's    */
/* "days from/to civil" algorithm (proleptic Gregorian, integer arithmetic only), the  */
/* same shape used to implement `Date` itself, just without constructing one.         */
/* ------------------------------------------------------------------ */

export interface DateRange {
  start: string
  end: string
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0')
}

function formatIso(year: number, month: number, day: number): string {
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`
}

/** Days since 1970-01-01, proleptic Gregorian, for a `year`/`month`(1-12)/`day`. */
function daysFromCivil(year: number, month: number, day: number): number {
  const y = month <= 2 ? year - 1 : year
  const era = Math.floor((y >= 0 ? y : y - 399) / 400)
  const yoe = y - era * 400 // [0, 399]
  const mp = (month + 9) % 12 // [0, 11]: Mar=0 .. Feb=11
  const doy = Math.floor((153 * mp + 2) / 5) + day - 1 // [0, 365]
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy // [0, 146096]
  return era * 146097 + doe - 719468
}

/** The inverse of `daysFromCivil`. */
function civilFromDays(z: number): { year: number; month: number; day: number } {
  const zAdj = z + 719468
  const era = Math.floor((zAdj >= 0 ? zAdj : zAdj - 146096) / 146097)
  const doe = zAdj - era * 146097 // [0, 146096]
  const yoe =
    Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365) // [0, 399]
  const y = yoe + era * 400
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100)) // [0, 365]
  const mp = Math.floor((5 * doy + 2) / 153) // [0, 11]
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1 // [1, 31]
  const month = mp < 10 ? mp + 3 : mp - 9 // [1, 12]
  const year = month <= 2 ? y + 1 : y
  return { year, month, day }
}

function addDays(iso: string, delta: number): string {
  const { year, month, day } = parseDate(iso)
  const days = daysFromCivil(Number(year), Number(month), Number(day)) + delta
  const civil = civilFromDays(days)
  return formatIso(civil.year, civil.month, civil.day)
}

/** Monday = 0 .. Sunday = 6, from an API date's digits, with no `Date`. */
function weekday(iso: string): number {
  const { year, month, day } = parseDate(iso)
  const days = daysFromCivil(Number(year), Number(month), Number(day))
  // 1970-01-01 (days = 0) was a Thursday, index 3 in a Monday-first week.
  return (((days + 3) % 7) + 7) % 7
}

/** "Hoy": today to today. */
export function todayRange(todayIso: string): DateRange {
  return { start: todayIso, end: todayIso }
}

/** "Semana": the Monday-to-Sunday week containing `todayIso`. */
export function weekRange(todayIso: string): DateRange {
  const start = addDays(todayIso, -weekday(todayIso))
  const end = addDays(start, 6)
  return { start, end }
}

/** "Mes", and the range Fechas opens with: the calendar month containing `todayIso`,
 * first day to last. */
export function monthRange(todayIso: string): DateRange {
  const { year, month } = parseDate(todayIso)
  const y = Number(year)
  const m = Number(month)
  const start = formatIso(y, m, 1)
  // The day before the first of next month is always this month's last day.
  const nextMonthFirst = m === 12 ? daysFromCivil(y + 1, 1, 1) : daysFromCivil(y, m + 1, 1)
  const lastDay = civilFromDays(nextMonthFirst - 1)
  const end = formatIso(lastDay.year, lastDay.month, lastDay.day)
  return { start, end }
}

/** The form's own date field can never be later than today (sales.md: a sale cannot
 * be dated in the future). */
export function maxSaleDate(todayIso: string): string {
  return todayIso
}

const MS_PER_MINUTE = 60_000
const MS_PER_DAY = 86_400_000

/**
 * The wall clock of a zone at an instant, "dd/mm HH:MM", from `epochMs` (the API's
 * `now_epoch_ms`) and the zone's UTC offset in minutes **at that instant** (the API's
 * `utc_offsets_minutes`, which settles daylight saving). Pure arithmetic: no `Date`, no
 * `Intl` (ADR-0049) and no wall clock (the screen never reads one). `null` offset (a zone the
 * server could not load) gives `null`, so the screen shows no preview rather than a wrong one.
 */
export function localDateTimeIn(epochMs: number, offsetMinutes: number | null): string | null {
  if (offsetMinutes === null) {
    return null
  }
  const local = epochMs + offsetMinutes * MS_PER_MINUTE
  const days = Math.floor(local / MS_PER_DAY)
  const minutesOfDay = Math.floor((local - days * MS_PER_DAY) / MS_PER_MINUTE)
  const { month, day } = civilFromDays(days)
  const hour = Math.floor(minutesOfDay / 60)
  return `${pad(day, 2)}/${pad(month, 2)} ${pad(hour, 2)}:${pad(minutesOfDay % 60, 2)}`
}
