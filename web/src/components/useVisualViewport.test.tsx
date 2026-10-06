import { render } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { COMPUTER_QUERY } from '../format/breakpoints'
import { useVisualViewport } from './useVisualViewport'

class FakeVisualViewport extends EventTarget {
  offsetTop = 0
  height = 800
  scale = 1

  move(change: Partial<Pick<FakeVisualViewport, 'offsetTop' | 'height' | 'scale'>>, type = 'resize') {
    Object.assign(this, change)
    this.dispatchEvent(new Event(type))
  }
}

function Probe() {
  const ref = useRef<HTMLDivElement | null>(null)
  useVisualViewport(ref)
  return <div data-testid="pinned" ref={ref} />
}

let viewport: FakeVisualViewport
let computer: boolean

function pinned(): HTMLElement {
  const node = document.querySelector<HTMLElement>('[data-testid="pinned"]')
  if (!node) throw new Error('the probe is not mounted')
  return node
}

beforeEach(() => {
  viewport = new FakeVisualViewport()
  computer = false
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      matches: query === COMPUTER_QUERY && computer,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  })
})

afterEach(() => {
  document.documentElement.classList.remove('html--formulario-fijo')
  Reflect.deleteProperty(window, 'visualViewport')
  vi.restoreAllMocks()
})

describe('COMPUTER_QUERY', () => {
  test('is the 900 px computer breakpoint Settings has always used', () => {
    expect(COMPUTER_QUERY).toBe('(min-width: 900px)')
  })
})

describe('useVisualViewport at scale 1', () => {
  test('writes the visual viewport geometry on mount and follows resize and scroll', () => {
    viewport.offsetTop = 0
    viewport.height = 700
    render(<Probe />)
    expect(pinned().style.getPropertyValue('--vv-top')).toBe('0px')
    expect(pinned().style.getPropertyValue('--vv-alto')).toBe('700px')

    viewport.move({ height: 500 }, 'resize')
    expect(pinned().style.getPropertyValue('--vv-alto')).toBe('500px')

    viewport.move({ offsetTop: 40 }, 'scroll')
    expect(pinned().style.getPropertyValue('--vv-top')).toBe('40px')
  })

  test('flags the keyboard when more than 120 px are missing, and clears it', () => {
    render(<Probe />)
    expect(pinned().hasAttribute('data-teclado')).toBe(false)

    viewport.move({ height: 480 })
    expect(pinned().getAttribute('data-teclado')).toBe('abierto')

    viewport.move({ height: 800 })
    expect(pinned().hasAttribute('data-teclado')).toBe(false)
  })

  test('a gap of exactly 120 px is not a keyboard', () => {
    render(<Probe />)
    viewport.move({ height: 680 })
    expect(pinned().hasAttribute('data-teclado')).toBe(false)
  })

  test('marks <html> while mounted and unmount cleans everything', () => {
    const { unmount } = render(<Probe />)
    const node = pinned()
    viewport.move({ height: 480 })
    expect(document.documentElement.classList.contains('html--formulario-fijo')).toBe(true)

    unmount()
    expect(document.documentElement.classList.contains('html--formulario-fijo')).toBe(false)
    expect(node.style.getPropertyValue('--vv-top')).toBe('')
    expect(node.style.getPropertyValue('--vv-alto')).toBe('')
    expect(node.hasAttribute('data-teclado')).toBe(false)

    viewport.move({ height: 300 })
    expect(node.style.getPropertyValue('--vv-alto')).toBe('')
    expect(node.hasAttribute('data-teclado')).toBe(false)
  })
})

describe('useVisualViewport while zoomed', () => {
  test.each([1.5, 2])('at scale %s removes the pin and ignores events', (scale) => {
    render(<Probe />)
    viewport.move({ height: 480 })
    expect(pinned().getAttribute('data-teclado')).toBe('abierto')

    viewport.move({ scale, height: 400, offsetTop: 30 })
    expect(pinned().style.getPropertyValue('--vv-top')).toBe('')
    expect(pinned().style.getPropertyValue('--vv-alto')).toBe('')
    expect(pinned().hasAttribute('data-teclado')).toBe(false)

    viewport.move({ height: 350 }, 'scroll')
    expect(pinned().style.getPropertyValue('--vv-alto')).toBe('')
    expect(pinned().hasAttribute('data-teclado')).toBe(false)
  })

  test('a zoomed mount sets nothing, and coming back to 1 restores the pin', () => {
    viewport.scale = 2
    viewport.height = 400
    render(<Probe />)
    expect(pinned().style.getPropertyValue('--vv-alto')).toBe('')
    expect(pinned().hasAttribute('data-teclado')).toBe(false)

    viewport.move({ scale: 1, height: 500 })
    expect(pinned().style.getPropertyValue('--vv-alto')).toBe('500px')
    expect(pinned().getAttribute('data-teclado')).toBe('abierto')
  })
})

describe('useVisualViewport where it must do nothing', () => {
  test('on a computer it sets nothing and adds no class', () => {
    computer = true
    render(<Probe />)
    viewport.move({ height: 400 })
    expect(pinned().style.getPropertyValue('--vv-alto')).toBe('')
    expect(pinned().hasAttribute('data-teclado')).toBe(false)
    expect(document.documentElement.classList.contains('html--formulario-fijo')).toBe(false)
  })

  test('without window.visualViewport it sets nothing and does not throw', () => {
    Reflect.deleteProperty(window, 'visualViewport')
    render(<Probe />)
    expect(pinned().style.getPropertyValue('--vv-alto')).toBe('')
    expect(pinned().hasAttribute('data-teclado')).toBe(false)
  })
})
