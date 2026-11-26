/**
 * The front's advisory check of a chosen logo file, before it is sent. The server stays the
 * authority: it reads the bytes and enforces the same cap while reading the body.
 */

/** The most bytes a logo may have; the one place this number is written. */
export const MAX_LOGO_BYTES = 1_048_576

const LOGO_TYPES: readonly string[] = ['image/png', 'image/jpeg']

export type LogoRefusal = 'too_big' | 'wrong_type'

/** Why a file is refused, or `null`. An empty `type` is not refused: the browser could not
 * name it, and the server decides by content. */
export function logoRefusal({ size, type }: { size: number; type: string }): LogoRefusal | null {
  if (size > MAX_LOGO_BYTES) return 'too_big'
  if (type !== '' && !LOGO_TYPES.includes(type)) return 'wrong_type'
  return null
}
