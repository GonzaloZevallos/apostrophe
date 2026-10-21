/**
 * The refusal code → field mapping of "In the catalog"'s form (test-first, plan seam):
 * each of the three catalog refusals lands under its own field, and any other code lands
 * under none, so the form can show it as a general message.
 */

import { expect, test } from 'vitest'
import { fieldOfRefusal } from './catalogFormErrors'

test.each([
  ['catalog.emoji_invalid', 'emoji', 'Enter exactly one emoji'],
  ['catalog.indica_share_invalid', 'indica_share', 'The indica percentage goes from 0 to 100'],
  ['catalog.aroma_too_long', 'aroma', 'The aroma is too long'],
] as const)('%s is shown under the %s field', (code, field, message) => {
  expect(fieldOfRefusal(code)).toEqual({ field, message })
})

test.each(['catalog.variety_not_found', 'stock.threshold_invalid', 'unknown', 'variety.name_taken'])(
  '%s belongs to no field of this form',
  (code) => {
    expect(fieldOfRefusal(code)).toBeNull()
  },
)
