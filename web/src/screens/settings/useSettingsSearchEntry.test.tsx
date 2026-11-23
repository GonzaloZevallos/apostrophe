import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode, useState } from 'react'
import { createMemoryRouter, type InitialEntry, MemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { SheetRouterProvider } from '../../components/useSheetStack'
import { isSettingsSearchState, useSettingsSearchEntry } from './useSettingsSearchEntry'

const SETTINGS = '/settings'

function Probe({ label }: { label: string }) {
  const { isOpen, open, close } = useSettingsSearchEntry()
  return (
    <main>
      <h1>{label}</h1>
      <p>{isOpen ? 'search open' : 'search closed'}</p>
      <button type="button" onClick={open}>
        Open search
      </button>
      <button type="button" onClick={close}>
        Cancel
      </button>
    </main>
  )
}

/** A screen that can change the probe's prop without leaving the route. */
function Screen() {
  const [label, setLabel] = useState('Settings')
  return (
    <>
      <button type="button" onClick={() => setLabel('Settings again')}>
        Change prop
      </button>
      <Probe label={label} />
    </>
  )
}

/**
 * Where the router stands in its history: the memory router does not expose the index, so it is
 * followed from the actions it reports. Every entry has its own key, even after a replace.
 */
function followHistory(router: ReturnType<typeof createMemoryRouter>, startAt: number) {
  const keys: string[] = new Array<string>(startAt + 1).fill('')
  keys[startAt] = router.state.location.key
  const position = { index: startAt, length: startAt + 1, pops: 0, replaces: 0 }
  router.subscribe((state) => {
    const key = state.location.key
    if (state.historyAction === 'PUSH') {
      position.index += 1
      keys.length = position.index
      keys.push(key)
    } else if (state.historyAction === 'REPLACE') {
      keys[position.index] = key
      position.replaces += 1
    } else {
      position.pops += 1
      const found = keys.indexOf(key)
      if (found !== -1) position.index = found
    }
    position.length = keys.length
  })
  return position
}

function mount(entries: InitialEntry[], options: { strict?: boolean; index?: number } = {}) {
  const router = createMemoryRouter(
    [
      { path: SETTINGS, element: <Screen /> },
      { path: '/other', element: <h1>Other</h1> },
    ],
    { initialEntries: entries, initialIndex: options.index ?? entries.length - 1 },
  )
  const position = followHistory(router, options.index ?? entries.length - 1)
  const tree = (
    <SheetRouterProvider router={router}>
      <RouterProvider router={router} />
    </SheetRouterProvider>
  )
  render(options.strict === true ? <StrictMode>{tree}</StrictMode> : tree)
  return { router, position }
}

const isOpen = () => screen.queryByText('search open') !== null
const open = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('button', { name: 'Open search' }))
const cancel = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('button', { name: 'Cancel' }))

afterEach(cleanup)

describe('isSettingsSearchState', () => {
  test('is true only for an object whose flag is exactly true', () => {
    expect(isSettingsSearchState({ settingsSearch: true })).toBe(true)
    expect(isSettingsSearchState({ inApp: true, settingsSearch: true })).toBe(true)
  })

  test('rejects everything else', () => {
    for (const state of [undefined, null, 'settingsSearch', 1, true, {}, { settingsSearch: false }, { settingsSearch: 'true' }, { settingsSearch: 1 }, { sheet: 1 }]) {
      expect(isSettingsSearchState(state)).toBe(false)
    }
  })
})

describe('useSettingsSearchEntry', () => {
  test('open, Cancel, open again leaves one search entry, open', async () => {
    const user = userEvent.setup()
    const { router, position } = mount([SETTINGS])
    expect(isOpen()).toBe(false)

    await open(user)
    expect(isOpen()).toBe(true)
    expect(position).toMatchObject({ index: 1, length: 2 })

    await cancel(user)
    expect(isOpen()).toBe(false)
    expect(position.index).toBe(0)

    await open(user)
    expect(isOpen()).toBe(true)
    expect(position).toMatchObject({ index: 1, length: 2 })
    expect(router.state.location.state).toEqual({ settingsSearch: true })
  })

  test('open, back, forward, then Cancel', async () => {
    const user = userEvent.setup()
    const { router, position } = mount([SETTINGS])
    await open(user)

    await act(() => router.navigate(-1))
    expect(isOpen()).toBe(false)
    expect(position.index).toBe(0)

    await act(() => router.navigate(1))
    expect(isOpen()).toBe(true)
    expect(position.index).toBe(1)

    await cancel(user)
    expect(isOpen()).toBe(false)
    expect(position.index).toBe(0)
  })

  test('a second open() does nothing, even from the handle the first render gave', async () => {
    const user = userEvent.setup()
    const { position } = mount([SETTINGS])
    await open(user)
    await open(user)
    await open(user)
    expect(isOpen()).toBe(true)
    expect(position).toMatchObject({ index: 1, length: 2 })
  })

  test('Cancel with search closed does nothing', async () => {
    const user = userEvent.setup()
    const { position } = mount([{ pathname: '/other' }, SETTINGS])
    await cancel(user)
    expect(position).toMatchObject({ index: 1, length: 2, pops: 0 })
  })

  test('mounting on an entry that carries the flag shows search closed at the same index', async () => {
    const user = userEvent.setup()
    const { router, position } = mount([{ pathname: SETTINGS, state: { settingsSearch: true } }])
    expect(isOpen()).toBe(false)
    expect(router.state.location.state).toEqual({})
    expect(position).toMatchObject({ index: 0, length: 1, replaces: 1 })

    await cancel(user)
    expect(position).toMatchObject({ index: 0, length: 1, pops: 0 })
  })

  test('a StrictMode mount on a flagged entry gives the same outcome', async () => {
    const user = userEvent.setup()
    const { router, position } = mount([{ pathname: SETTINGS, state: { settingsSearch: true } }], { strict: true })
    expect(isOpen()).toBe(false)
    expect(router.state.location.state).toEqual({})
    expect(position).toMatchObject({ index: 0, length: 1 })

    await cancel(user)
    expect(position).toMatchObject({ index: 0, length: 1, pops: 0 })
  })

  test('a forward onto a flagged entry re-opens search and a re-render does not clear it', async () => {
    const user = userEvent.setup()
    const { router, position } = mount([SETTINGS])
    await open(user)
    await act(() => router.navigate(-1))
    await act(() => router.navigate(1))
    expect(isOpen()).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Change prop' }))
    expect(screen.getByRole('heading', { name: 'Settings again' })).toBeInTheDocument()
    expect(isOpen()).toBe(true)
    expect(position).toMatchObject({ index: 1, length: 2, replaces: 0 })
  })

  test('open, leave for another screen, back: search shows closed', async () => {
    const user = userEvent.setup()
    const { router, position } = mount([SETTINGS])
    await open(user)
    await act(() => router.navigate('/other'))
    expect(screen.getByRole('heading', { name: 'Other' })).toBeInTheDocument()

    await act(() => router.navigate(-1))
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    expect(isOpen()).toBe(false)
    expect(position.index).toBe(1)
    expect(router.state.location.state).toEqual({})
  })

  test('search and hash survive open and Cancel', async () => {
    const user = userEvent.setup()
    const { router } = mount([`${SETTINGS}?x=1#y`])
    await open(user)
    expect(router.state.location).toMatchObject({ pathname: SETTINGS, search: '?x=1', hash: '#y' })
    expect(isOpen()).toBe(true)

    await cancel(user)
    expect(router.state.location).toMatchObject({ pathname: SETTINGS, search: '?x=1', hash: '#y' })
    expect(isOpen()).toBe(false)
  })

  test('search and hash survive the clean-up of a flagged entry', () => {
    const { router } = mount([{ pathname: SETTINGS, search: '?x=1', hash: '#y', state: { settingsSearch: true } }])
    expect(router.state.location).toMatchObject({ pathname: SETTINGS, search: '?x=1', hash: '#y' })
    expect(isOpen()).toBe(false)
  })

  test('inApp and enteredFrom are kept through open, Cancel and the clean-up', async () => {
    const user = userEvent.setup()
    const kept = { inApp: true, enteredFrom: '/home' }
    const { router } = mount([{ pathname: SETTINGS, state: kept }])
    await open(user)
    expect(router.state.location.state).toEqual({ ...kept, settingsSearch: true })

    await cancel(user)
    expect(router.state.location.state).toEqual(kept)

    await open(user)
    await act(() => router.navigate('/other'))
    await act(() => router.navigate(-1))
    expect(isOpen()).toBe(false)
    expect(router.state.location.state).toEqual(kept)
  })
})

describe('useSettingsSearchEntry outside a router handle', () => {
  test('throws a clear message without a SheetRouterProvider', () => {
    const failure = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(() => render(
        <MemoryRouter>
          <Probe label="Settings" />
        </MemoryRouter>,
      )).toThrow('useRouterHandle needs a SheetRouterProvider')
    failure.mockRestore()
  })
})
