/** `isEnteredFromSettings`, the one reader of the Settings entry mark on a history state. */

import { expect, test } from 'vitest'
import { isEnteredFromSettings } from './SettingsPaneContext'

test.each([
  [null, false],
  [undefined, false],
  ['settings', false],
  [{}, false],
  [{ enteredFrom: 'x' }, false],
  [{ enteredFrom: 'settings' }, true],
  [{ enteredFrom: 'settings', other: 1 }, true],
])('isEnteredFromSettings(%j) is %s', (state, expected) => {
  expect(isEnteredFromSettings(state)).toBe(expected)
})
