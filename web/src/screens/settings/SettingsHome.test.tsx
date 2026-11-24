/**
 * `SettingsHome`, the phone Settings home, mounted through the real route table under a memory
 * router with `fetch` faked: the Business card (name, initial, count slot), the composed first
 * paint while both reads are held, and the one-tap walk to every row's page and back. Names,
 * headings and addresses come from the registry and the copy, never from a literal here.
 */

import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { EMPTY_STATE_KEYS } from '../../copy/emptyStates'
import { testT } from '../../i18n/testing'
import { queryClient } from '../../queryClient'
import App from '../../App'
import { router } from '../../router'
import { HOME, kindOf, SCREENS, SETTINGS } from '../../routes'
import { stubViewport } from '../../test-viewport'
import {
  SETTINGS_GROUP_LABEL_KEYS,
  SETTINGS_GROUPS,
  SETTINGS_ROWS,
  SHORTCUTS,
  shortcutTarget,
  shownRowsByGroup,
  type SettingsRow,
} from './settingsRows'

const ME = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02', money: { symbol: '$', decimals: 0 } }

type Read = 'held' | 'failed' | object

interface Served {
  readonly business: Read
  readonly pricing: Read
  readonly me?: object
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function answer(read: Read): Promise<Response> {
  if (read === 'held') return new Promise(() => undefined)
  if (read === 'failed') return Promise.resolve(json({ detail: 'boom' }, 500))
  return Promise.resolve(json(read))
}

function users(count: number) {
  return { users: Array.from({ length: count }, (_, index) => ({ email: `u${index}@x.com` })), selectable_languages: ['en'] }
}

async function open(served: Served, path = SETTINGS) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/auth/me')) return Promise.resolve(json(served.me ?? ME))
      if (url.includes('/pricing-settings')) return answer(served.pricing)
      if (url.includes('/business')) return answer(served.business)
      if (url.includes('/pinned-catalog')) return Promise.resolve(json({ token_saved_on: null, own_chat: null, channel_chat: null }))
      return Promise.resolve(json([]))
    }),
  )
  await act(() => router.navigate(path))
  render(<App />)
  return router
}

/** The card: the nearest `div` around the business name. It has no role to find it by. */
async function card(name: string = ME.business_name): Promise<HTMLElement> {
  const holder = (await screen.findByText(name)).closest('div')
  if (holder === null) throw new Error('no card around the business name')
  return holder
}

/** Every link inside a group's section: the rows, not the shortcuts nor the shell's. */
function rowLinksUnderHeadings(): HTMLElement[] {
  return screen.getAllByRole('heading', { level: 2 }).flatMap((heading) => {
    const region = heading.closest('section')
    if (region === null) throw new Error('no section around a group heading')
    return within(region).getAllByRole('link')
  })
}

function nameOf(row: SettingsRow): string {
  return `${testT(row.labelKey)} ${testT(row.descriptionKey)}`
}

function rowOf(key: SettingsRow['key']): SettingsRow {
  const found = SETTINGS_ROWS.find((candidate) => candidate.key === key)
  if (found === undefined) throw new Error(`no row ${key}`)
  return found
}

/**
 * How a row's page hands the seller back to Settings home. Only a card shows "‹ Settings"
 * (`chrome.ts`: `backArrow` is `kind === 'card'`); a form shows "Close", which goes back through
 * history, so it lands on the same place.
 */
function leaveButtonName(row: SettingsRow): string {
  const screen = SCREENS.find((candidate) => candidate.path === row.to)
  if (screen === undefined) throw new Error(`no screen at ${row.to}`)
  return kindOf(screen, 'phone') === 'card' ? BACK_TO_SETTINGS : 'Close'
}

const BACK_TO_SETTINGS = `‹ ${testT('settings:home.title')}`

beforeEach(() => stubViewport('phone'))

afterEach(async () => {
  cleanup()
  vi.unstubAllGlobals()
  queryClient.clear()
  await act(() => router.navigate(HOME))
})

describe('the Business card', () => {
  test('while /business is held it shows the name and the initial, no digit, and the area is busy', async () => {
    await open({ business: 'held', pricing: 'held' })

    const view = await card()

    expect(within(view).getByText(ME.business_name)).toBeInTheDocument()
    expect(within(view).getByText(ME.business_name.charAt(0))).toBeInTheDocument()
    expect(view.textContent).not.toMatch(/\d/)
    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true')
  })

  test.each([1, 3])('shows the user count for %i', async (count) => {
    await open({ business: users(count), pricing: { is_bulk_pricing: false, is_vip_customers: false } })

    const view = await card()

    expect(await within(view).findByText(testT('settings:card.users', { count }))).toBeInTheDocument()
  })

  test('a failed /business read shows no count and no error', async () => {
    await open({ business: 'failed', pricing: { is_bulk_pricing: false, is_vip_customers: false } })
    const view = await card()

    await waitFor(() => expect(screen.getByRole('main')).not.toHaveAttribute('aria-busy'))

    expect(view.textContent).toBe(`${ME.business_name.charAt(0)}${ME.business_name}`)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  test('an emoji is one initial, and the name is trimmed first', async () => {
    const name = '  🌿 Flores'
    await open({ business: 'held', pricing: 'held', me: { ...ME, business_name: name } })

    const view = await card(name.trim())

    expect(within(view).getByText('🌿', { selector: 'span' })).toBeInTheDocument()
    expect(view.textContent?.startsWith('🌿')).toBe(true)
  })

  test('holds no link and no button', async () => {
    await open({ business: users(2), pricing: { is_bulk_pricing: false, is_vip_customers: true } })
    const view = await card()
    await within(view).findByText(testT('settings:card.users', { count: 2 }))

    expect(within(view).queryAllByRole('link')).toHaveLength(0)
    expect(within(view).queryAllByRole('button')).toHaveLength(0)
  })
})

describe('the first paint while both reads are held', () => {
  test('lists the 11 unconditional rows under their headings, the three shortcuts and no conditional row', async () => {
    await open({ business: 'held', pricing: 'held' })
    await screen.findByRole('heading', { level: 1, name: testT('settings:home.title') })

    const unknown = { selectableLanguages: undefined, isCustomerTypesOn: undefined }
    const groups = shownRowsByGroup(unknown)
    expect(groups.map((group) => group.group)).toEqual(SETTINGS_GROUPS)
    expect(groups.flatMap((group) => group.rows)).toHaveLength(11)
    for (const group of groups) {
      const heading = screen.getByRole('heading', { level: 2, name: testT(SETTINGS_GROUP_LABEL_KEYS[group.group]) })
      const region = heading.closest('section')
      if (region === null) throw new Error('no section around a group heading')
      const links = within(region).getAllByRole('link')
      expect(links.map((link) => link.textContent)).toEqual(group.rows.map((row) => nameOf(row)))
      expect(links.map((link) => link.getAttribute('href'))).toEqual(group.rows.map((row) => row.to))
    }
    for (const shortcut of SHORTCUTS) {
      expect(screen.getByRole('link', { name: testT(shortcut.labelKey) })).toHaveAttribute(
        'href',
        shortcutTarget(shortcut),
      )
    }
    expect(screen.queryByRole('link', { name: nameOf(rowOf('language')) })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: nameOf(rowOf('customerTypes')) })).not.toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true')
  })

  test('with two languages the language row appears, so there are 12 rows', async () => {
    await open({
      business: { ...users(1), selectable_languages: ['en', 'es'] },
      pricing: { is_bulk_pricing: false, is_vip_customers: false },
    })

    expect(await screen.findByRole('link', { name: nameOf(rowOf('language')) })).toBeInTheDocument()
    expect(rowLinksUnderHeadings()).toHaveLength(12)
  })
})

describe('opening a page from Settings home', () => {
  test('Payment methods from its shortcut shows "‹ Settings", and tapping it lands on Settings home', async () => {
    const user = userEvent.setup()
    const router = await open({ business: users(1), pricing: { is_bulk_pricing: false, is_vip_customers: false } })
    const payment = SHORTCUTS.find((shortcut) => shortcut.row === 'paymentMethods')
    if (payment === undefined) throw new Error('no payment methods shortcut')

    await user.click(await screen.findByRole('link', { name: testT(payment.labelKey) }))
    expect(router.state.location.pathname).toBe(shortcutTarget(payment))
    await user.click(await screen.findByRole('button', { name: BACK_TO_SETTINGS }))

    expect(router.state.location.pathname).toBe(SETTINGS)
    expect(await screen.findByRole('heading', { level: 1, name: testT('settings:home.title') })).toBeInTheDocument()
  })

  test.each(SETTINGS_ROWS.map((row) => [row.key] as const))(
    'the %s row opens its page in one tap, and its way back returns to Settings home',
    async (key) => {
      const user = userEvent.setup()
      const router = await open({
        business: { ...users(1), selectable_languages: ['en', 'es'] },
        pricing: { is_bulk_pricing: false, is_vip_customers: true },
      })
      const row = rowOf(key)

      await user.click(await screen.findByRole('link', { name: nameOf(row) }))
      expect(router.state.location.pathname).toBe(row.to)
      await user.click(await screen.findByRole('button', { name: leaveButtonName(row) }))

      expect(router.state.location.pathname).toBe(SETTINGS)
      expect(await screen.findByRole('heading', { level: 1, name: testT('settings:home.title') })).toBeInTheDocument()
    },
    20_000,
  )
})

const QUIET = { business: users(1), pricing: { is_bulk_pricing: false, is_vip_customers: false } }
const SEARCH_LABEL = testT('settings:search.label')
const NOTHING = testT(EMPTY_STATE_KEYS.settingsSearchNothing)
const PAYMENT_LABEL = testT('settings:rows.paymentMethods.label')

/** The one polite live region of the screen: the heading slot of the search. */
function slot(): HTMLElement {
  return screen.getByRole('status')
}

function field(): HTMLElement {
  return screen.getByRole('searchbox', { name: SEARCH_LABEL })
}

async function typeInField(text: string): Promise<void> {
  await userEvent.setup().type(await screen.findByRole('searchbox', { name: SEARCH_LABEL }), text)
}

describe('searching the settings', () => {
  test('lists the rows that match with their group name, and the count in the slot', async () => {
    await open(QUIET)

    await typeInField('pay')

    const result = await screen.findByRole('link', {
      name: `${PAYMENT_LABEL} ${testT('settings:groups.paymentsAndStock')}`,
    })
    expect(result).toHaveAttribute('href', rowOf('paymentMethods').to)
    await waitFor(() => expect(slot()).toHaveTextContent(testT('settings:search.results', { count: 1 })))
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument()
    expect(screen.queryByText(ME.business_name)).not.toBeInTheDocument()
  })

  test('a text with several matches shows the plural count', async () => {
    await open(QUIET)

    await typeInField('s')

    await waitFor(() => expect(slot()).toHaveTextContent(/^\d+ results$/))
    expect(within(screen.getByRole('list')).getAllByRole('link').length).toBeGreaterThan(1)
  })

  test('no match shows Nothing found in place of the list', async () => {
    await open(QUIET)

    await typeInField('zzz')

    await waitFor(() => expect(slot()).toHaveTextContent(NOTHING))
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  test('a row the Business hides is never shown: Language with one language, Customer types off', async () => {
    await open(QUIET)
    await screen.findByText(testT('settings:card.users', { count: 1 }))

    await typeInField('language')
    await waitFor(() => expect(slot()).toHaveTextContent(NOTHING))
    await userEvent.setup().clear(field())
    await typeInField('customer types')

    await waitFor(() => expect(slot()).toHaveTextContent(NOTHING))
    expect(screen.queryByRole('link', { name: new RegExp(testT('settings:rows.customerTypes.label')) })).not.toBeInTheDocument()
  })

  test('while /business is held the matches are listed, the slot is empty with no digit and the area is busy', async () => {
    await open({ business: 'held', pricing: QUIET.pricing })

    await typeInField('pay')

    expect(await screen.findByRole('link', { name: new RegExp(PAYMENT_LABEL) })).toBeInTheDocument()
    expect(slot().textContent).toBe('')
    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true')
  })

  test('the slot is the same node before and after the read answers, and it fills', async () => {
    let release: (response: Response) => void = () => undefined
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/auth/me')) return Promise.resolve(json(ME))
        if (url.includes('/pricing-settings')) return Promise.resolve(json(QUIET.pricing))
        if (url.includes('/business')) return new Promise<Response>((resolve) => (release = resolve))
        return Promise.resolve(json([]))
      }),
    )
    await act(() => router.navigate(SETTINGS))
    render(<App />)
    const before = await screen.findByRole('status')

    await typeInField('pay')
    expect(slot().textContent).toBe('')
    await act(async () => release(json(users(1))))

    await waitFor(() => expect(slot()).toHaveTextContent(testT('settings:search.results', { count: 1 })))
    expect(slot()).toBe(before)
  })

  test('the slot also fills when the read fails', async () => {
    await open({ business: 'failed', pricing: QUIET.pricing })

    await typeInField('pay')

    await waitFor(() => expect(slot()).toHaveTextContent(testT('settings:search.results', { count: 1 })))
  })

  test('Clear empties the field, keeps search open and focus, and brings back the groups', async () => {
    await open(QUIET)
    await typeInField('pay')

    await userEvent.setup().click(await screen.findByRole('button', { name: testT('settings:search.clear') }))

    expect(field()).toHaveValue('')
    expect(field()).toHaveFocus()
    expect(screen.getByRole('button', { name: testT('common:cancel') })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: testT('settings:search.clear') })).not.toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(SETTINGS_GROUPS.length)
  })

  test('Cancel closes search and brings back the Business card and the groups', async () => {
    await open(QUIET)
    await typeInField('pay')

    await userEvent.setup().click(await screen.findByRole('button', { name: testT('common:cancel') }))

    expect(await screen.findByText(ME.business_name)).toBeInTheDocument()
    expect(field()).toHaveValue('')
    expect(screen.queryByRole('button', { name: testT('common:cancel') })).not.toBeInTheDocument()
  })

  test('focusing the field alone does not open search', async () => {
    await open(QUIET)
    await screen.findByRole('searchbox', { name: SEARCH_LABEL })

    act(() => field().focus())

    expect(field()).toHaveFocus()
    expect(screen.queryByRole('button', { name: testT('common:cancel') })).not.toBeInTheDocument()
  })
})
