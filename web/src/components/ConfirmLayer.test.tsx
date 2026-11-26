import { act, render, screen } from '@testing-library/react'
import { useLayoutEffect } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { stubViewport } from '../test-viewport'
import ConfirmLayer from './ConfirmLayer'
import { useConfirmLayer, type ConfirmLayerApi } from './confirmLayerContext'

class FakeVisualViewport extends EventTarget {
  offsetTop = 12
  height = 640
  scale = 1
}

let api: ConfirmLayerApi | null = null

/** A fake child that exposes the hook and mounts a root per id it is asked to register. */
function Capture() {
  const layer = useConfirmLayer()
  useLayoutEffect(() => {
    api = layer
  })
  return <button type="button">Opener</button>
}

function host(): HTMLElement {
  const element = document.querySelector<HTMLElement>('.confirm-layer')
  if (!element) throw new Error('no host')
  return element
}

/** The `display: contents` wrapper around the app, found from the content it wraps. */
function wrapper(): HTMLElement {
  const element = screen.getByRole('button', { name: 'Opener', hidden: true }).parentElement
  if (!element) throw new Error('no wrapper')
  return element
}

function open(id: string, root: HTMLElement = document.body) {
  const element = document.createElement('div')
  element.dataset['testid'] = id
  root.appendChild(element)
  act(() => api?.register(id, element))
  return element
}

const locked = () => document.documentElement.classList.contains('html--confirmando')

beforeEach(() => {
  stubViewport('phone')
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: new FakeVisualViewport() })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })
})

afterEach(() => {
  document.documentElement.className = ''
  document.body.innerHTML = ''
  Reflect.deleteProperty(window, 'visualViewport')
  vi.unstubAllGlobals()
  api = null
})

describe('ConfirmLayer', () => {
  test('with nothing open it marks nothing', () => {
    render(
      <ConfirmLayer>
        <Capture />
      </ConfirmLayer>,
    )
    expect(host()).not.toHaveAttribute('data-open')
    expect(wrapper()).not.toHaveAttribute('inert')
    expect(wrapper()).not.toHaveAttribute('aria-hidden')
    expect(document.documentElement.className).toBe('')
  })

  test('on the phone a registration locks the app and the last release frees all of it', () => {
    render(
      <ConfirmLayer>
        <Capture />
      </ConfirmLayer>,
    )
    const root = open('a')
    expect(wrapper()).toHaveAttribute('inert')
    expect(wrapper()).toHaveAttribute('aria-hidden', 'true')
    expect(host()).toHaveAttribute('data-open')
    expect(host()).not.toHaveAttribute('inert')
    expect(locked()).toBe(true)

    act(() => api?.release('a'))
    expect(wrapper()).not.toHaveAttribute('inert')
    expect(wrapper()).not.toHaveAttribute('aria-hidden')
    expect(host()).not.toHaveAttribute('data-open')
    expect(locked()).toBe(false)
    expect(root).not.toHaveAttribute('inert')
  })

  test('closing leaves a class that was already on html, and touches no other class', () => {
    document.documentElement.classList.add('html--formulario-fijo', 'otra')
    render(
      <ConfirmLayer>
        <Capture />
      </ConfirmLayer>,
    )
    open('a')
    expect([...document.documentElement.classList].sort()).toEqual(['html--confirmando', 'html--formulario-fijo', 'otra'])
    act(() => api?.release('a'))
    expect([...document.documentElement.classList].sort()).toEqual(['html--formulario-fijo', 'otra'])
  })

  test('with two open only the top is live, and all is released when both are gone', () => {
    render(
      <ConfirmLayer>
        <Capture />
      </ConfirmLayer>,
    )
    const lower = open('lower')
    const top = open('top')
    expect(lower).toHaveAttribute('inert')
    expect(lower).toHaveAttribute('aria-hidden', 'true')
    expect(top).not.toHaveAttribute('inert')
    expect(top).not.toHaveAttribute('aria-hidden')
    expect(api?.isTop('top')).toBe(true)
    expect(api?.isTop('lower')).toBe(false)

    act(() => api?.release('top'))
    expect(lower).not.toHaveAttribute('inert')
    expect(lower).not.toHaveAttribute('aria-hidden')
    expect(api?.isTop('lower')).toBe(true)
    expect(locked()).toBe(true)
    expect(wrapper()).toHaveAttribute('inert')
    expect(host()).toHaveAttribute('data-open')

    act(() => api?.release('lower'))
    expect(locked()).toBe(false)
    expect(wrapper()).not.toHaveAttribute('inert')
    expect(host()).not.toHaveAttribute('data-open')
  })

  test('registering an id again keeps one entry, and releasing an unknown id changes nothing', () => {
    render(
      <ConfirmLayer>
        <Capture />
      </ConfirmLayer>,
    )
    const root = open('a')
    act(() => api?.register('a', root))
    act(() => api?.release('nope'))
    expect(locked()).toBe(true)
    act(() => api?.release('a'))
    expect(locked()).toBe(false)
  })

  test('a pointerdown on the scrim is cancelled and focus stays where it was', () => {
    render(
      <ConfirmLayer>
        <Capture />
      </ConfirmLayer>,
    )
    const button = document.createElement('button')
    host().appendChild(button)
    button.focus()
    open('a')
    const scrim = new Event('pointerdown', { bubbles: true, cancelable: true })
    act(() => {
      host().dispatchEvent(scrim)
    })
    expect(scrim.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(button)

    const inside = new Event('pointerdown', { bubbles: true, cancelable: true })
    act(() => {
      button.dispatchEvent(inside)
    })
    expect(inside.defaultPrevented).toBe(false)
  })

  test('the host carries the visual viewport on the phone', () => {
    render(
      <ConfirmLayer>
        <Capture />
      </ConfirmLayer>,
    )
    expect(host().style.getPropertyValue('--vv-top')).toBe('12px')
    expect(host().style.getPropertyValue('--vv-alto')).toBe('640px')
  })

  test('on the computer a registration sets no inert and no class', () => {
    stubViewport('computer')
    render(
      <ConfirmLayer>
        <Capture />
      </ConfirmLayer>,
    )
    const root = open('a')
    expect(wrapper()).not.toHaveAttribute('inert')
    expect(root).not.toHaveAttribute('inert')
    expect(host()).not.toHaveAttribute('data-open')
    expect(locked()).toBe(false)
  })

  test('without a provider the hook returns null', () => {
    render(<Capture />)
    expect(api).toBeNull()
  })

})
