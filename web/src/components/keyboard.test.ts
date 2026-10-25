import { describe, expect, test } from 'vitest'
import { type KeyboardSnapshot, isKeyboardOpen, isTextEntry } from './keyboard'

function snapshot(change: Partial<KeyboardSnapshot> = {}): KeyboardSnapshot {
  return {
    innerHeight: 800,
    innerWidth: 400,
    viewport: { height: 800, offsetTop: 0, scale: 1 },
    baseline: 800,
    textFocus: false,
    settling: false,
    ...change,
  }
}

describe('isKeyboardOpen', () => {
  test('iOS: a visual viewport more than 120 px short is open, with no focus needed', () => {
    expect(isKeyboardOpen(snapshot({ viewport: { height: 480, offsetTop: 0, scale: 1 } }))).toBe(true)
    expect(isKeyboardOpen(snapshot({ viewport: { height: 680, offsetTop: 0, scale: 1 } }))).toBe(false)
  })

  test('Android: innerHeight more than 120 px below the baseline is open while a text control has focus', () => {
    const dropped = { innerHeight: 500, viewport: { height: 500, offsetTop: 0, scale: 1 } }
    expect(isKeyboardOpen(snapshot({ ...dropped, textFocus: true }))).toBe(true)
    expect(isKeyboardOpen(snapshot({ ...dropped, textFocus: false }))).toBe(false)
    expect(isKeyboardOpen(snapshot({ ...dropped, settling: true }))).toBe(true)
  })

  test('an address-bar change under 120 px is not open, even with focus', () => {
    const bar = { innerHeight: 740, viewport: { height: 740, offsetTop: 0, scale: 1 }, textFocus: true }
    expect(isKeyboardOpen(snapshot(bar))).toBe(false)
  })

  test('pinch-zoom is never open, whatever the numbers say', () => {
    expect(isKeyboardOpen(snapshot({ viewport: { height: 300, offsetTop: 0, scale: 2 }, textFocus: true }))).toBe(false)
    expect(isKeyboardOpen(snapshot({ innerHeight: 400, viewport: { height: 400, offsetTop: 0, scale: 1.5 }, textFocus: true }))).toBe(false)
  })

  test('without a visual viewport, focus on a text control is open and nothing else is', () => {
    expect(isKeyboardOpen(snapshot({ viewport: null, textFocus: true }))).toBe(true)
    expect(isKeyboardOpen(snapshot({ viewport: null, textFocus: false }))).toBe(false)
  })
})

describe('isTextEntry', () => {
  function input(type?: string): HTMLInputElement {
    const element = document.createElement('input')
    if (type !== undefined) element.type = type
    return element
  }

  test.each(['text', 'search', 'email', 'tel', 'url', 'password', 'number'])('an input of type %s is text entry', (type) => {
    expect(isTextEntry(input(type))).toBe(true)
  })

  test('an untyped input and a textarea are text entry', () => {
    expect(isTextEntry(input())).toBe(true)
    expect(isTextEntry(document.createElement('textarea'))).toBe(true)
  })

  test.each(['date', 'time', 'checkbox', 'radio', 'range', 'color', 'file', 'button', 'submit'])(
    'an input of type %s is not',
    (type) => {
      expect(isTextEntry(input(type))).toBe(false)
    },
  )

  test('a select, a button and nothing are not', () => {
    expect(isTextEntry(document.createElement('select'))).toBe(false)
    expect(isTextEntry(document.createElement('button'))).toBe(false)
    expect(isTextEntry(null)).toBe(false)
  })
})
