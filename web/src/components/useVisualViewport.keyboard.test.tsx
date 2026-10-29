import { act, render } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { COMPUTER_QUERY } from '../format/breakpoints'
import { FOCUS_SETTLE_MS } from './keyboard'
import { useVisualViewport } from './useVisualViewport'

class FakeVisualViewport extends EventTarget {
  offsetTop = 0
  height = 800
  scale = 1
}

function Probe({ fixedForm }: { fixedForm?: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null)
  useVisualViewport(ref, fixedForm === undefined ? undefined : { fixedForm })
  return (
    <div data-testid="pinned" ref={ref}>
      <input data-testid="a" type="text" />
      <input data-testid="b" type="text" />
      <input data-testid="date" type="date" />
      <select data-testid="select">
        <option>x</option>
      </select>
    </div>
  )
}

function setWindow(height: number, width = 400) {
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height })
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
}

/** An Android resize: the layout viewport shrinks, the visual one follows it. */
function resizeTo(height: number, width = 400) {
  setWindow(height, width)
  if (window.visualViewport) (window.visualViewport as unknown as FakeVisualViewport).height = height
  act(() => {
    window.dispatchEvent(new Event('resize'))
  })
}

function pinned(): HTMLElement {
  const node = document.querySelector<HTMLElement>('[data-testid="pinned"]')
  if (!node) throw new Error('the probe is not mounted')
  return node
}

function control(id: string): HTMLElement {
  const node = document.querySelector<HTMLElement>(`[data-testid="${id}"]`)
  if (!node) throw new Error(`no ${id}`)
  return node
}

function focus(id: string) {
  act(() => control(id).focus())
}

function blur(id: string) {
  act(() => control(id).blur())
}

const open = () => pinned().getAttribute('data-teclado') === 'abierto'

beforeEach(() => {
  vi.useFakeTimers()
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: new FakeVisualViewport() })
  setWindow(800)
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      matches: query === COMPUTER_QUERY && false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  })
})

afterEach(() => {
  document.documentElement.classList.remove('html--formulario-fijo')
  Reflect.deleteProperty(window, 'visualViewport')
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('the keyboard on iOS', () => {
  test('a gap between innerHeight and the visual viewport is open, with no focus', () => {
    render(<Probe />)
    act(() => {
      const viewport = window.visualViewport as unknown as FakeVisualViewport
      viewport.height = 450
      viewport.dispatchEvent(new Event('resize'))
    })
    expect(open()).toBe(true)
  })

  test('scale 2 with a small height is not open and removes the pin', () => {
    render(<Probe />)
    act(() => {
      const viewport = window.visualViewport as unknown as FakeVisualViewport
      viewport.scale = 2
      viewport.height = 300
      viewport.dispatchEvent(new Event('resize'))
    })
    expect(open()).toBe(false)
    expect(pinned().style.getPropertyValue('--vv-alto')).toBe('')
  })
})

describe('the keyboard on Android (resizes-content)', () => {
  test('a drop in innerHeight with a text control focused is open, and returns when it rises', () => {
    render(<Probe />)
    focus('a')
    resizeTo(480)
    expect(open()).toBe(true)
    blur('a')
    resizeTo(800)
    expect(open()).toBe(false)
  })

  test('a drop with no focus is not open', () => {
    render(<Probe />)
    resizeTo(480)
    expect(open()).toBe(false)
  })

  test('a control already focused at mount still leaves the baseline right', () => {
    const outside = document.createElement('input')
    document.body.append(outside)
    outside.focus()
    render(<Probe />)
    resizeTo(480)
    expect(open()).toBe(true)
    outside.remove()
  })

  test('an address-bar change under 120 px is not open', () => {
    render(<Probe />)
    focus('a')
    resizeTo(700)
    expect(open()).toBe(false)
  })

  test('a width change resets the baseline: a rotation is not a keyboard', () => {
    render(<Probe />)
    focus('a')
    resizeTo(360, 800)
    expect(open()).toBe(false)
  })

  test('a shrink with no focus, then focus, is not open: the baseline followed', () => {
    render(<Probe />)
    resizeTo(500)
    focus('a')
    expect(open()).toBe(false)
  })

  test('field A blurs, a resize comes in, field B takes focus within the window: still open', () => {
    render(<Probe />)
    focus('a')
    resizeTo(480)
    blur('a')
    resizeTo(470)
    act(() => vi.advanceTimersByTime(FOCUS_SETTLE_MS - 100))
    focus('b')
    expect(open()).toBe(true)
  })

  test('a blur, then a resize after the window: the baseline follows and it is not open', () => {
    render(<Probe />)
    focus('a')
    resizeTo(480)
    blur('a')
    act(() => vi.advanceTimersByTime(FOCUS_SETTLE_MS + 100))
    resizeTo(470)
    expect(open()).toBe(false)
    focus('b')
    expect(open()).toBe(false)
  })

  test('an orientation change resets the baseline', () => {
    const orientation = new EventTarget()
    Object.defineProperty(screen, 'orientation', { configurable: true, value: orientation })
    render(<Probe />)
    focus('a')
    setWindow(360, 400)
    act(() => {
      orientation.dispatchEvent(new Event('change'))
      window.dispatchEvent(new Event('resize'))
    })
    expect(open()).toBe(false)
    Reflect.deleteProperty(screen, 'orientation')
  })
})

describe('without window.visualViewport', () => {
  beforeEach(() => {
    Reflect.deleteProperty(window, 'visualViewport')
  })

  test('focus on a text control is open', () => {
    render(<Probe />)
    focus('a')
    expect(open()).toBe(true)
    blur('a')
    expect(open()).toBe(false)
  })

  test.each(['date', 'select'])('focus on %s is not open', (id) => {
    render(<Probe />)
    focus(id)
    expect(open()).toBe(false)
  })
})

describe('the store lifecycle', () => {
  test('a second mount with a different fake viewport follows the new one', () => {
    render(<Probe />)
    const second = new FakeVisualViewport()
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: second })
    const other = render(<Probe />)
    act(() => {
      second.height = 400
      second.dispatchEvent(new Event('resize'))
    })
    const nodes = document.querySelectorAll<HTMLElement>('[data-testid="pinned"]')
    expect(nodes[1]?.getAttribute('data-teclado')).toBe('abierto')
    other.unmount()
  })

  test('an unmount then a remount starts from a fresh baseline', () => {
    const first = render(<Probe />)
    focus('a')
    resizeTo(480)
    expect(open()).toBe(true)
    first.unmount()
    // The keyboard-sized window is now the first one the store sees: a fresh baseline, not open.
    render(<Probe />)
    focus('a')
    expect(open()).toBe(false)
  })

  test('fixedForm false leaves <html> alone', () => {
    render(<Probe fixedForm={false} />)
    expect(document.documentElement.classList.contains('html--formulario-fijo')).toBe(false)
  })

  test('fixedForm defaults to true', () => {
    render(<Probe />)
    expect(document.documentElement.classList.contains('html--formulario-fijo')).toBe(true)
  })
})
