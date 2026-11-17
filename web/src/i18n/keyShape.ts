/**
 * The one definition of a translation key's shape, `namespace:path`, that the guards
 * use. No other module defines a runtime test for it.
 *
 * No English text can have this shape: a namespace glued to a path with a colon and no
 * space, and no punctuation but `.` and `_` in the path, is not a sentence or a label.
 * `keyShape.test.ts` checks that against every value of every locale file.
 *
 * This module imports nothing, so any layer may use it.
 */
const KEY_SHAPE = /^[a-z][A-Za-z0-9]*:[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*$/

export function isKeyShaped(text: string): boolean {
  return KEY_SHAPE.test(text)
}
