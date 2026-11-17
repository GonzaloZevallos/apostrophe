import { afterEach, describe, expect, it, vi } from 'vitest'
import { fontsReady, type FaceLoader } from './fontsReady'

afterEach(() => {
  vi.useRealTimers()
})

describe('fontsReady', () => {
  it('waits for every face before it resolves', async () => {
    const pending: Array<() => void> = []
    const fonts: FaceLoader = { load: () => new Promise<void>((resolve) => pending.push(resolve)) }
    let done = false
    const waiting = fontsReady(fonts, ['a', 'b'], 10_000).then(() => {
      done = true
    })
    await Promise.resolve()
    expect(pending).toHaveLength(2)
    pending[0]?.()
    await Promise.resolve()
    await Promise.resolve()
    expect(done).toBe(false)
    pending[1]?.()
    await waiting
    expect(done).toBe(true)
  })

  it('gives up after the cap when a face never arrives', async () => {
    vi.useFakeTimers()
    const fonts: FaceLoader = { load: () => new Promise<void>(() => undefined) }
    const waiting = fontsReady(fonts, ['a'], 1500)
    await vi.advanceTimersByTimeAsync(1500)
    await expect(waiting).resolves.toBeUndefined()
  })

  it('resolves when a face fails to load, and when there is no font API', async () => {
    await expect(fontsReady({ load: () => Promise.reject(new Error('404')) }, ['a'])).resolves.toBeUndefined()
    await expect(fontsReady(undefined)).resolves.toBeUndefined()
  })
})
