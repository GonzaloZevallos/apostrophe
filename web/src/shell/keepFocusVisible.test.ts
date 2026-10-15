import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { startKeepFocusVisible } from './keepFocusVisible'

type Listener = () => void

/** The slice of `VisualViewport` the module uses: `resize` listeners, fired by the test. */
class FakeViewport {
  listeners = new Set<Listener>()
  addEventListener(_type: string, listener: Listener): void {
    this.listeners.add(listener)
  }
  removeEventListener(_type: string, listener: Listener): void {
    this.listeners.delete(listener)
  }
  resize(): void {
    for (const listener of [...this.listeners]) listener()
  }
}

let viewport: FakeViewport
let stop: () => void
const scrollIntoView = vi.fn()

function field(parentClass: string | null, tag: 'input' | 'textarea' | 'select' | 'button' = 'input') {
  const element = document.createElement(tag)
  if (parentClass === null) {
    document.body.append(element)
  } else {
    const parent = document.createElement('div')
    parent.className = parentClass
    parent.append(element)
    document.body.append(parent)
  }
  element.scrollIntoView = scrollIntoView
  return element
}

beforeEach(() => {
  vi.useFakeTimers({ now: new Date('2026-01-05T12:00:00Z') })
  viewport = new FakeViewport()
  Object.defineProperty(window, 'visualViewport', { value: viewport, configurable: true })
  scrollIntoView.mockClear()
  stop = startKeepFocusVisible()
})

afterEach(() => {
  stop()
  document.body.replaceChildren()
  vi.useRealTimers()
  Object.defineProperty(window, 'visualViewport', { value: undefined, configurable: true })
})

test('a field in a sheet scrolls to the centre once the keyboard has resized the viewport', () => {
  field('capa').focus()
  expect(scrollIntoView).not.toHaveBeenCalled()
  viewport.resize()
  expect(scrollIntoView).toHaveBeenCalledTimes(1)
  expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center' })
})

test('without a resize it scrolls after 300 ms', () => {
  field('cliente-sheet', 'textarea').focus()
  vi.advanceTimersByTime(299)
  expect(scrollIntoView).not.toHaveBeenCalled()
  vi.advanceTimersByTime(1)
  expect(scrollIntoView).toHaveBeenCalledTimes(1)
})

test('a form with no bar scrolls its select too', () => {
  field('columna-principal columna-principal--sin-bar', 'select').focus()
  viewport.resize()
  expect(scrollIntoView).toHaveBeenCalledTimes(1)
})

test('a field outside the sheets and the barless forms is never scrolled', () => {
  field(null).focus()
  field('columna-principal').focus()
  viewport.resize()
  vi.advanceTimersByTime(1000)
  expect(scrollIntoView).not.toHaveBeenCalled()
})

test('a button inside a sheet is not a field', () => {
  field('capa', 'button').focus()
  viewport.resize()
  vi.advanceTimersByTime(1000)
  expect(scrollIntoView).not.toHaveBeenCalled()
})

test('one scroll per focus: the resize and the timer do not both fire, and the listener is dropped', () => {
  field('capa').focus()
  viewport.resize()
  viewport.resize()
  vi.advanceTimersByTime(1000)
  expect(scrollIntoView).toHaveBeenCalledTimes(1)
  expect(viewport.listeners.size).toBe(0)
})

test('without visualViewport it does nothing and does not throw', () => {
  stop()
  Object.defineProperty(window, 'visualViewport', { value: undefined, configurable: true })
  stop = startKeepFocusVisible()
  expect(() => field('capa').focus()).not.toThrow()
  vi.advanceTimersByTime(1000)
  expect(scrollIntoView).not.toHaveBeenCalled()
})
