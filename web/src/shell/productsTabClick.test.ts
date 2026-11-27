/** `isPlainPrimaryClick`: only the left button alone, not handled, on a link that stays in the window. */

import { describe, expect, test } from 'vitest'
import { isPlainPrimaryClick, type ClickLike } from './productsTabClick'

const PLAIN: ClickLike = {
  button: 0,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  defaultPrevented: false,
  currentTarget: { target: '' },
}

describe('isPlainPrimaryClick', () => {
  test.each<[string, Partial<ClickLike>, boolean]>([
    ['a plain left click', {}, true],
    ['a left click on a link targeting _self', { currentTarget: { target: '_self' } }, true],
    ['the middle button', { button: 1 }, false],
    ['the right button', { button: 2 }, false],
    ['meta held', { metaKey: true }, false],
    ['ctrl held', { ctrlKey: true }, false],
    ['shift held', { shiftKey: true }, false],
    ['alt held', { altKey: true }, false],
    ['an already prevented click', { defaultPrevented: true }, false],
    ['a link targeting _blank', { currentTarget: { target: '_blank' } }, false],
    ['a link targeting a named window', { currentTarget: { target: 'other' } }, false],
  ])('%s', (_name, change, expected) => {
    expect(isPlainPrimaryClick({ ...PLAIN, ...change })).toBe(expected)
  })
})
