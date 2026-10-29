/**
 * `startFollow` at its seam: a fake frame queue, clock and page, so the loop is driven one
 * frame at a time.
 */

import { expect, test } from 'vitest'
import { FOLLOW_CAP_MS, startFollow, type FollowDeps } from './scrollFollow'

function fakePage(initial: { scrollY?: number; maxScroll: number }) {
  const state = { scrollY: initial.scrollY ?? 0, maxScroll: initial.maxScroll, clock: 0, listeners: new Set<() => void>() }
  const queue: Array<() => void> = []
  const scrolls: number[] = []
  const deps: FollowDeps = {
    frame: (callback) => queue.push(callback),
    cancelFrame: () => queue.splice(0, queue.length),
    now: () => state.clock,
    scrollY: () => state.scrollY,
    maxScroll: () => state.maxScroll,
    scrollTo: (top) => {
      scrolls.push(top)
      state.scrollY = top
    },
    onSellerInput: (listener) => {
      state.listeners.add(listener)
      return () => state.listeners.delete(listener)
    },
  }
  /** One frame, 16 ms on. */
  const frame = () => {
    state.clock += 16
    queue.splice(0, queue.length).forEach((callback) => callback())
  }
  return { state, queue, scrolls, deps, frame }
}

test('a target the page already reaches is applied at once and nothing stays scheduled', () => {
  const page = fakePage({ maxScroll: 2000 })
  startFollow(600, page.deps)
  expect(page.scrolls).toEqual([600])
  expect(page.queue).toHaveLength(0)
  expect(page.state.listeners.size).toBe(0)
})

test('a short page is followed down as its content loads, and stops at the target', () => {
  const page = fakePage({ maxScroll: 100 })
  startFollow(600, page.deps)
  expect(page.scrolls).toEqual([100])
  page.frame()
  expect(page.scrolls).toEqual([100])
  page.state.maxScroll = 350
  page.frame()
  page.state.maxScroll = 5000
  page.frame()
  expect(page.scrolls).toEqual([100, 350, 600])
  expect(page.queue).toHaveLength(0)
  expect(page.state.listeners.size).toBe(0)
})

test('a page that never gets tall enough is given up on after the cap', () => {
  const page = fakePage({ maxScroll: 100 })
  startFollow(600, page.deps)
  let frames = 0
  while (page.queue.length > 0 && frames < 1000) {
    page.frame()
    frames += 1
  }
  expect(page.state.clock).toBeGreaterThanOrEqual(FOLLOW_CAP_MS)
  expect(page.state.clock).toBeLessThan(FOLLOW_CAP_MS + 100)
  expect(page.scrolls).toEqual([100])
  expect(page.state.listeners.size).toBe(0)
})

test('the seller touching the page stops it, and the next frames do not drag the page', () => {
  const page = fakePage({ maxScroll: 100 })
  startFollow(600, page.deps)
  page.state.scrollY = 40
  page.state.listeners.forEach((listener) => listener())
  page.state.maxScroll = 5000
  page.frame()
  expect(page.scrolls).toEqual([100])
  expect(page.state.scrollY).toBe(40)
  expect(page.queue).toHaveLength(0)
  expect(page.state.listeners.size).toBe(0)
})

test('cancel (the next location change) stops it and can be called twice', () => {
  const page = fakePage({ maxScroll: 100 })
  const cancel = startFollow(600, page.deps)
  cancel()
  cancel()
  page.state.maxScroll = 5000
  page.frame()
  expect(page.scrolls).toEqual([100])
  expect(page.queue).toHaveLength(0)
  expect(page.state.listeners.size).toBe(0)
})
