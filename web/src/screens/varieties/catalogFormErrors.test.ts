/**
 * The refusal code → field mapping of "En el catálogo"'s form (test-first, plan seam):
 * each of the three catalog refusals lands under its own field, and any other code lands
 * under none, so the form can show it as a general message.
 */

import { expect, test } from 'vitest'
import { fieldOfRefusal } from './catalogFormErrors'

test.each([
  ['catalog.emoji_invalid', 'emoji', 'Poné exactamente un emoji'],
  ['catalog.indica_share_invalid', 'indica_share', 'El porcentaje de índica va de 0 a 100'],
  ['catalog.aroma_too_long', 'aroma', 'El aroma es demasiado largo'],
] as const)('%s is shown under the %s field', (code, field, message) => {
  expect(fieldOfRefusal(code)).toEqual({ field, message })
})

test.each(['catalog.variety_not_found', 'stock.threshold_invalid', 'unknown', 'variety.name_taken'])(
  '%s belongs to no field of this form',
  (code) => {
    expect(fieldOfRefusal(code)).toBeNull()
  },
)
