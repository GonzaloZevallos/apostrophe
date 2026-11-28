/**
 * `useSaleBillShare` at its hook seam: what a tap does with the share sheet and the clipboard, which
 * answer counts, and what the hook returns. Asserted through calls to `shareText`/`copyText`,
 * `onCopied` and the returned values; the share and clipboard modules are stubbed where the app calls them.
 */

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { SaleBill } from '../api/sales'
import SALE_DETAIL from '../api/fixtures/sale-detail.json'
import type { SaleBillButtonState } from './useSaleBillShare'
import { useSaleBillShare } from './useSaleBillShare'

const BILL = SALE_DETAIL.bill as SaleBill
const READY: SaleBillButtonState = { kind: 'ready', bill: BILL }

const shareText = vi.hoisted(() => vi.fn())
const copyText = vi.hoisted(() => vi.fn())
const canShare = vi.hoisted(() => vi.fn())

vi.mock('../share', () => ({ shareText, canShare }))
vi.mock('../clipboard', () => ({ copyText }))

beforeEach(() => {
  canShare.mockReturnValue(true)
})

afterEach(() => {
  vi.restoreAllMocks()
  shareText.mockReset()
  copyText.mockReset()
  canShare.mockReset()
})

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function setup(state: SaleBillButtonState = READY, onCopied: () => void = () => undefined, refreshing = false) {
  return renderHook(
    (props: { state: SaleBillButtonState; refreshing: boolean }) =>
      useSaleBillShare({ state: props.state, refreshing: props.refreshing, onCopied }),
    { initialProps: { state, refreshing } },
  )
}

test('a late failed answer after unmount changes nothing', async () => {
  const answer = deferred<'shared' | 'cancelled' | 'failed'>()
  shareText.mockReturnValue(answer.promise)
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  const onCopied = vi.fn()
  const { result, unmount } = setup(READY, onCopied)

  act(() => result.current.onTap())
  unmount()
  await act(async () => {
    answer.resolve('failed')
    await answer.promise
  })

  expect(onCopied).not.toHaveBeenCalled()
  expect(consoleError).not.toHaveBeenCalled()
})

test('a newer tap supersedes an older one: the older late failure changes nothing', async () => {
  const first = deferred<'shared' | 'cancelled' | 'failed'>()
  const second = deferred<'shared' | 'cancelled' | 'failed'>()
  shareText.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
  const { result } = setup()

  act(() => result.current.onTap())
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
  act(() => result.current.onTap())
  expect(shareText).toHaveBeenCalledTimes(2)
  await act(async () => {
    first.resolve('failed')
    await first.promise
  })

  expect(result.current.sharing).toBe(true)
  expect(result.current.failure).toBeNull()
})

test('a failed share flips sharing to false and sets the share failure', async () => {
  shareText.mockResolvedValue('failed')
  const { result } = setup()
  expect(result.current.sharing).toBe(true)

  await act(async () => {
    result.current.onTap()
  })

  expect(result.current.sharing).toBe(false)
  expect(result.current.failure).toEqual({ kind: 'share' })
})

test('a failed copy keeps the text for the block, and a copied one calls onCopied', async () => {
  canShare.mockReturnValue(false)
  copyText.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
  const onCopied = vi.fn()
  const { result } = setup(READY, onCopied)

  await act(async () => {
    result.current.onTap()
  })
  expect(result.current.failure?.kind).toBe('copy')
  expect(onCopied).not.toHaveBeenCalled()

  await act(async () => {
    result.current.onTap()
  })
  expect(onCopied).toHaveBeenCalledTimes(1)
  expect(result.current.failure).toBeNull()
})

test('a tap while loading or with a null bill calls nothing, and a later valid tap shares once', () => {
  shareText.mockReturnValue(new Promise(() => undefined))
  const { result, rerender } = setup({ kind: 'loading' })

  act(() => result.current.onTap())
  rerender({ state: { kind: 'ready', bill: null }, refreshing: false })
  act(() => result.current.onTap())
  expect(shareText).not.toHaveBeenCalled()
  expect(copyText).not.toHaveBeenCalled()

  rerender({ state: READY, refreshing: false })
  act(() => result.current.onTap())
  expect(shareText).toHaveBeenCalledTimes(1)
})

test('busy is true while loading or refreshing and false otherwise', () => {
  const { result, rerender } = setup({ kind: 'loading' })
  expect(result.current.busy).toBe(true)
  rerender({ state: READY, refreshing: true })
  expect(result.current.busy).toBe(true)
  rerender({ state: READY, refreshing: false })
  expect(result.current.busy).toBe(false)
})

test('a share that never settles is released when the page is visible again', () => {
  shareText.mockReturnValue(new Promise(() => undefined))
  const { result } = setup()

  act(() => result.current.onTap())
  act(() => result.current.onTap())
  expect(shareText).toHaveBeenCalledTimes(1)

  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
  act(() => result.current.onTap())
  expect(shareText).toHaveBeenCalledTimes(2)
})

test('a Copy while sharing is true calls copyText and never shareText', async () => {
  copyText.mockResolvedValue(true)
  const onCopied = vi.fn()
  const { result } = setup(READY, onCopied)
  expect(result.current.sharing).toBe(true)

  await act(async () => {
    result.current.onCopy()
  })

  expect(copyText).toHaveBeenCalledTimes(1)
  expect(shareText).not.toHaveBeenCalled()
  expect(onCopied).toHaveBeenCalledTimes(1)
})

test('a Copy supersedes a Share that never settles, and that Share answering later changes nothing', async () => {
  const share = deferred<'shared' | 'cancelled' | 'failed'>()
  shareText.mockReturnValue(share.promise)
  copyText.mockResolvedValue(true)
  const onCopied = vi.fn()
  const { result } = setup(READY, onCopied)

  act(() => result.current.onTap())
  await act(async () => {
    result.current.onCopy()
  })
  expect(copyText).toHaveBeenCalledTimes(1)
  expect(onCopied).toHaveBeenCalledTimes(1)

  await act(async () => {
    share.resolve('failed')
    await share.promise
  })
  expect(result.current.failure).toBeNull()
  expect(result.current.sharing).toBe(true)
})

test('a failed Copy sets the copy failure with the text it tried to copy', async () => {
  copyText.mockResolvedValue(false)
  const onCopied = vi.fn()
  const { result } = setup(READY, onCopied)

  await act(async () => {
    result.current.onCopy()
  })

  const text = copyText.mock.calls[0]?.[0] as string
  expect(text.length).toBeGreaterThan(0)
  expect(result.current.failure).toEqual({ kind: 'copy', text })
  expect(onCopied).not.toHaveBeenCalled()
})

test('a double Copy copies once, and a Copy with no bill does nothing', () => {
  copyText.mockReturnValue(new Promise(() => undefined))
  const { result, rerender } = setup({ kind: 'ready', bill: null })

  act(() => result.current.onCopy())
  expect(copyText).not.toHaveBeenCalled()

  rerender({ state: READY, refreshing: false })
  act(() => result.current.onCopy())
  act(() => result.current.onCopy())
  expect(copyText).toHaveBeenCalledTimes(1)
})
