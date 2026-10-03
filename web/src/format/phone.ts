/**
 * Formats a stored phone number for display (`formato.ts`'s `telefono`, ported to
 * English): the API's `+5491123456789` becomes `+54 9 11 2345-6789`. Never used to
 * parse or validate — the backend is the only place a phone number is normalised
 * (`customers.md`).
 */

const SHAPE = /^54(9)?(11|\d{2,4})(\d{4})(\d{4})$/

export function formatPhone(value: string): string {
  const digits = value.startsWith('+') ? value.slice(1) : value
  const match = SHAPE.exec(digits)
  if (!match) return value
  const [, nine, area, first, last] = match
  return `+54${nine ? ' 9' : ''} ${area} ${first}-${last}`
}
