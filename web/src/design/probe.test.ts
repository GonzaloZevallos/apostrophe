import { describe, expect, it } from 'vitest'
import { pageProbe } from '../../../scripts/design/probe.mjs'
import {
  SETTLE_BOUND,
  SETTLE_FRAMES,
  SETTLE_REASON_UNSETTLED,
  settleWith,
  signatureOf,
  type SettleFrame,
  type SettlePort,
} from '../../../scripts/design/settle.mjs'

// What a page script sees of a `Response` here: headers have arrived, the body is read later.
type FakeResponse = {
  clone(): FakeResponse
  arrayBuffer(): Promise<ArrayBuffer>
  json(): Promise<unknown>
}

type FakeWindow = {
  fetch: (...args: unknown[]) => Promise<FakeResponse>
  __captureQuiet: () => Promise<boolean>
  __captureMutated: () => boolean
  __captureSignature: unknown
  MutationObserver: new (callback: () => void) => FakeObserver
  document: object
}

// What the probe asks of a `MutationObserver`: to watch a node with options, and to hand over
// records the browser has queued but not yet delivered to the callback.
type FakeObserver = {
  observe(target: object, options: Record<string, boolean>): void
  takeRecords(): unknown[]
}

// A page's observer: `mutate()` queues a record and, as the browser does, delivers it to the
// callback on a later microtask, so a frame can read the flag between the two.
function fakeObservers() {
  const state = {
    observed: [] as Array<{ target: object; options: Record<string, boolean> }>,
    queued: [] as unknown[],
    callbacks: [] as Array<() => void>,
    mutate() {
      state.queued.push({})
      queueMicrotask(() => {
        if (state.queued.length === 0) return
        state.queued = []
        for (const callback of state.callbacks) callback()
      })
    },
  }
  class Observer implements FakeObserver {
    constructor(callback: () => void) {
      state.callbacks.push(callback)
    }
    observe(target: object, options: Record<string, boolean>) {
      state.observed.push({ target, options })
    }
    takeRecords() {
      const taken = state.queued
      state.queued = []
      return taken
    }
  }
  return { state, Observer }
}

// One real macrotask: the body of a response arrives on a turn later than its headers.
const turn = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

// A response whose body is read once per object, as a real one is; `clone()` of a body that
// was already read throws. A null body (a 204) reads as empty.
function responseOf(body: unknown): FakeResponse {
  let used = false
  const read = async <T>(value: T): Promise<T> => {
    if (used) throw new TypeError('body used already')
    used = true
    await turn()
    return value
  }
  return {
    clone: () => {
      if (used) throw new TypeError('body used already')
      return responseOf(body)
    },
    arrayBuffer: () => read(new ArrayBuffer(0)),
    json: () => read(body),
  }
}

// The probe installed exactly as the capture installs it: its source, serialised, run with
// `window` bound to a plain object. Nothing outside the function is in scope for it.
function install(fetch: FakeWindow['fetch'], observers = fakeObservers()): FakeWindow {
  const win = { fetch, MutationObserver: observers.Observer, document: { id: 'document' } } as unknown as FakeWindow
  const source = `(${pageProbe.toString()})(${signatureOf.toString()})`
  new Function('window', source)(win)
  return win
}

// A promise the test settles by hand: for a response, `resolve` hands the headers over.
function held<T = FakeResponse>() {
  const state = { resolve: (_value: T): void => undefined, reject: (_error: Error): void => undefined }
  const promise = new Promise<T>((resolve, reject) => {
    state.resolve = resolve
    state.reject = reject
  })
  return { promise, ...state }
}

const isPending = async (promise: Promise<unknown>) => {
  const marker = Symbol('pending')
  return (await Promise.race([promise, turn().then(() => marker)])) === marker
}

// The paused clock of the capture: timers run only when the clock is advanced, in order.
function fakeClock() {
  let now = 0
  let sequence = 0
  const timers: Array<{ at: number; sequence: number; run: () => void }> = []
  return {
    setTimeout(run: () => void, ms: number) {
      sequence += 1
      timers.push({ at: now + ms, sequence, run })
    },
    runFor(ms: number) {
      const end = now + ms
      for (;;) {
        const due = timers.filter((t) => t.at <= end).sort((a, b) => a.at - b.at || a.sequence - b.sequence)
        const next = due.at(0)
        if (next === undefined) break
        timers.splice(timers.indexOf(next), 1)
        now = next.at
        next.run()
      }
      now = end
    },
  }
}

describe('the probe on a page whose late answer is drawn by a timer', () => {
  // The page asks for its settings from a timer that fires in the third frame, reads the
  // body on a later turn and, as react-query's notify does, draws on `setTimeout(0)` of the
  // paused clock. The layout hash changes only when that timer has run.
  function pageWith(fetch: FakeWindow['fetch']) {
    const win = install(fetch)
    const clock = fakeClock()
    const page = { drawn: false }
    clock.setTimeout(() => {
      void (async () => {
        const response = await win.fetch('/pricing-settings')
        await response.json()
        clock.setTimeout(() => {
          page.drawn = true
        }, 0)
      })()
    }, 40)
    const port: SettlePort = {
      advance: (ms) => Promise.resolve(clock.runFor(ms)),
      frame: async (): Promise<SettleFrame> => {
        clock.runFor(16)
        const idle = await win.__captureQuiet()
        await turn()
        return {
          idle,
          unfinishedAnimation: false,
          mutated: false,
          fontsLoaded: true,
          hash: page.drawn ? 'drawn' : 'undrawn',
        }
      },
    }
    return { port, page }
  }
  const options = { advanceMs: 0, frames: SETTLE_FRAMES, bound: SETTLE_BOUND }

  it('does not settle on the page before the late line is drawn, and settles once it is', async () => {
    const { port, page } = pageWith(() => Promise.resolve(responseOf({ is_bulk_pricing: true })))
    expect(await settleWith(port, options)).toBeNull()
    expect(page.drawn).toBe(true)
  })

  it('counts a request in flight until its body is read, not until its headers arrive', async () => {
    const body = held<ArrayBuffer>()
    const response: FakeResponse = {
      clone: () => response,
      arrayBuffer: () => body.promise,
      json: () => body.promise.then(() => ({})),
    }
    const win = install(() => Promise.resolve(response))
    await win.fetch('/pricing-settings')
    const quiet = win.__captureQuiet()
    expect(await isPending(quiet)).toBe(true)
    body.resolve(new ArrayBuffer(0))
    await quiet
  })
})

describe('the probe', () => {
  it('releases the waiters when the count reaches zero, all of them at once', async () => {
    const first = held()
    const second = held()
    const answers = [first, second]
    const win = install(() => {
      const next = answers.shift()
      if (next === undefined) throw new Error('no more answers')
      return next.promise
    })
    const a = win.fetch('/a')
    const b = win.fetch('/b')
    const waiters = [win.__captureQuiet(), win.__captureQuiet()]
    first.resolve(responseOf({}))
    await a
    expect(await isPending(waiters[0]!)).toBe(true)
    second.resolve(responseOf({}))
    await b
    await Promise.all(waiters)
  })

  it('counts a fetch that throws synchronously as done, and rethrows', async () => {
    const win = install(() => {
      throw new Error('blocked')
    })
    expect(() => win.fetch('/x')).toThrow('blocked')
    await win.__captureQuiet()
    expect(await isPending(win.__captureQuiet())).toBe(false)
  })

  it('counts a rejected fetch as done, and the app still sees the rejection', async () => {
    const win = install(() => Promise.reject(new Error('offline')))
    const request = win.fetch('/x')
    await expect(request).rejects.toThrow('offline')
    expect(await isPending(win.__captureQuiet())).toBe(false)
  })

  it('counts a response with no body (a 204) as done', async () => {
    const empty: FakeResponse = {
      clone: () => empty,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      json: () => Promise.reject(new SyntaxError('no body')),
    }
    const win = install(() => Promise.resolve(empty))
    await win.fetch('/x')
    expect(await isPending(win.__captureQuiet())).toBe(false)
  })

  it('counts a response whose body cannot be read as done', async () => {
    const broken: FakeResponse = {
      clone: () => broken,
      arrayBuffer: () => Promise.reject(new TypeError('network error')),
      json: () => Promise.reject(new TypeError('network error')),
    }
    const win = install(() => Promise.resolve(broken))
    await win.fetch('/x')
    expect(await isPending(win.__captureQuiet())).toBe(false)
  })

  it('leaves the body to the app: it reads its own copy after the probe has read a clone', async () => {
    const win = install(() => Promise.resolve(responseOf({ is_vip_customers: true })))
    const response = await win.fetch('/pricing-settings')
    expect(await response.json()).toEqual({ is_vip_customers: true })
  })

  it('answers not quiet on the first call after install, even with nothing requested', async () => {
    const win = install(() => Promise.resolve(responseOf({})))
    expect(await win.__captureQuiet()).toBe(false)
    expect(await win.__captureQuiet()).toBe(true)
  })

  it('answers not quiet once for each stretch in which a request completed', async () => {
    const win = install(() => Promise.resolve(responseOf({})))
    await win.__captureQuiet()
    await (await win.fetch('/a')).json()
    expect(await win.__captureQuiet()).toBe(false)
    expect(await win.__captureQuiet()).toBe(true)
  })

  it('exposes the layout signature it was given', () => {
    expect(install(() => Promise.resolve(responseOf({}))).__captureSignature).toBeTypeOf('function')
  })
})

describe('the probe\'s mutation flag', () => {
  it('watches the whole document: attributes, child list, character data and the subtree', () => {
    const observers = fakeObservers()
    const win = install(() => Promise.resolve(responseOf({})), observers)
    expect(observers.state.observed).toEqual([
      {
        target: win.document,
        options: { attributes: true, childList: true, characterData: true, subtree: true },
      },
    ])
  })

  it('reads false before anything changed', () => {
    expect(install(() => Promise.resolve(responseOf({}))).__captureMutated()).toBe(false)
  })

  it('reads true once after a mutation and resets in the same call', async () => {
    const observers = fakeObservers()
    const win = install(() => Promise.resolve(responseOf({})), observers)
    observers.state.mutate()
    await turn()
    expect(win.__captureMutated()).toBe(true)
    expect(win.__captureMutated()).toBe(false)
  })

  it('counts a mutation the browser has queued but not yet delivered to the observer', () => {
    const observers = fakeObservers()
    const win = install(() => Promise.resolve(responseOf({})), observers)
    observers.state.mutate()
    expect(win.__captureMutated()).toBe(true)
    expect(win.__captureMutated()).toBe(false)
  })

  it('sends back only a boolean, never what changed', async () => {
    const observers = fakeObservers()
    const win = install(() => Promise.resolve(responseOf({})), observers)
    observers.state.mutate()
    await turn()
    expect(win.__captureMutated()).toBeTypeOf('boolean')
  })

  it('does not settle a page whose switch flips by an attribute that moves no box, until it stops', async () => {
    // The hash is the same in every frame (nothing moves); only the mutation flag tells that the
    // switch was still changing. It flips in the first two frames and then rests.
    const observers = fakeObservers()
    const win = install(() => Promise.resolve(responseOf({})), observers)
    let frame = 0
    const port: SettlePort = {
      advance: () => Promise.resolve(),
      frame: async (): Promise<SettleFrame> => {
        frame += 1
        if (frame <= 2) observers.state.mutate()
        const idle = await win.__captureQuiet()
        await turn()
        return { idle, unfinishedAnimation: false, mutated: win.__captureMutated(), fontsLoaded: true, hash: 'same' }
      },
    }
    expect(await settleWith(port, { advanceMs: 0, frames: SETTLE_FRAMES, bound: SETTLE_BOUND })).toBeNull()
    // frame 1 is not quiet either (first call), 2 mutated, then three calm equal frames: 3, 4, 5.
    expect(frame).toBe(5)
  })

  it('never settles a page that keeps mutating, and fails with the unsettled reason', async () => {
    const observers = fakeObservers()
    const win = install(() => Promise.resolve(responseOf({})), observers)
    const port: SettlePort = {
      advance: () => Promise.resolve(),
      frame: async (): Promise<SettleFrame> => {
        observers.state.mutate()
        const idle = await win.__captureQuiet()
        return { idle, unfinishedAnimation: false, mutated: win.__captureMutated(), fontsLoaded: true, hash: 'same' }
      },
    }
    expect(await settleWith(port, { advanceMs: 0, frames: SETTLE_FRAMES, bound: SETTLE_BOUND })).toBe(
      SETTLE_REASON_UNSETTLED,
    )
  })
})
