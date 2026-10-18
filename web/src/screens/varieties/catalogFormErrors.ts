/**
 * "En el catálogo"'s form: which of its fields a refusal of `PUT /catalog/varieties/{id}`
 * is shown under. The one table from the server's code to a field and its fixed Spanish
 * message; a code that is not one of the three belongs to no field (the form words it as a
 * general message). The rules themselves (one emoji, 0 to 100, 200 characters) are the
 * backend's alone.
 */

import { AROMA_TOO_LONG_MESSAGE, EMOJI_INVALID_MESSAGE, INDICA_SHARE_INVALID_MESSAGE } from '../../copy/varieties'

export type CatalogField = 'emoji' | 'indica_share' | 'aroma'

export { AROMA_TOO_LONG_MESSAGE, EMOJI_INVALID_MESSAGE, INDICA_SHARE_INVALID_MESSAGE }

const FIELD_OF_CODE = new Map<string, { field: CatalogField; message: string }>([
  ['catalog.emoji_invalid', { field: 'emoji', message: EMOJI_INVALID_MESSAGE }],
  ['catalog.indica_share_invalid', { field: 'indica_share', message: INDICA_SHARE_INVALID_MESSAGE }],
  ['catalog.aroma_too_long', { field: 'aroma', message: AROMA_TOO_LONG_MESSAGE }],
])

export function fieldOfRefusal(code: string): { field: CatalogField; message: string } | null {
  return FIELD_OF_CODE.get(code) ?? null
}
