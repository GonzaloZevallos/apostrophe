/**
 * `PinPublish` at the screen seam: Publish's disabled reason and the link to Integrations
 * come only from `publish_blocked_by`; the status line never shows the link and never
 * disables Publish. The API is faked at `fetch`.
 */

import { SETTINGS_INTEGRATIONS } from '../routes'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { PINNED_CATALOG_REASON_LABEL } from '../copy/refusals'
import { copyProblems, measure } from '../copy/limits'
import PinPublish from './PinPublish'
import { expectIconAndTextRule } from '../test/iconAndTextRule'
import * as catalogCopy from '../copy/catalog'
import type { PinReason } from '../copy/refusals'
import {
  INTEGRATIONS_LINK_WORD,
  LIMITED_COPY,
  LONG_REFUSALS,
  OUT_OF_DATE_LINES,
  NOT_READY_LINE,
  CHANNEL_MISSING_LINE,
} from '../copy/catalog'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const UP_TO_DATE = { state: 'up_to_date', reason: null, last_published_on: '2026-09-29' }

function renderPin(
  pinned: unknown,
  overrides?: (url: string, init?: RequestInit) => Response | undefined,
) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) =>
    Promise.resolve(overrides?.(url, init) ?? jsonResponse(200, pinned)),
  )
  vi.stubGlobal('fetch', fetchMock)
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <PinPublish />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

test('not_tested disables Publish, says why and links to Integrations', async () => {
  renderPin({ can_publish: false, publish_blocked_by: 'not_tested', status: null })

  expect(await screen.findByRole('button', { name: 'Publish' })).toBeDisabled()
  expect(screen.getByText(/Send yourself a test first to see how it looks/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Integrations' })).toHaveAttribute(
    'href',
    SETTINGS_INTEGRATIONS,
  )
})

test('channel_missing disables Publish, says the channel is missing and links to Integrations', async () => {
  renderPin({ can_publish: false, publish_blocked_by: 'channel_missing', status: null })

  expect(await screen.findByRole('button', { name: 'Publish' })).toBeDisabled()
  expect(screen.getByText(/The channel is missing: add it in/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Integrations' })).toHaveAttribute(
    'href',
    SETTINGS_INTEGRATIONS,
  )
})

test('null enables Publish and shows neither reason nor link', async () => {
  renderPin({ can_publish: true, publish_blocked_by: null, status: UP_TO_DATE })

  expect(await screen.findByRole('button', { name: 'Publish' })).toBeEnabled()
  expect(screen.queryByRole('link', { name: 'Integrations' })).not.toBeInTheDocument()
  expect(screen.queryByText(/Send yourself a test first/)).not.toBeInTheDocument()
  expect(screen.getByText('Up to date')).toBeInTheDocument()
  expect(screen.getByText(/Last published on 29\/09/)).toBeInTheDocument()
})

test.each([
  ['telegram_unreachable', "Telegram didn't respond"],
  ['bot_cannot_post', "The bot can't post in the channel"],
  ['message_gone', 'The pinned message is gone: publish it again'],
  ['missing_publish', 'It still has to be published with the new bot or channel'],
  ['too_long', "It's too long for Telegram: shorten aromas or hide varieties."],
] as const)(
  'Out of date for %s reads its reason, shows no link and keeps Publish enabled',
  async (reason, text) => {
    renderPin({
      can_publish: true,
      publish_blocked_by: null,
      status: { state: 'out_of_date', reason, last_published_on: '2026-09-29' },
    })

    expect(await screen.findByText('Out of date')).toBeInTheDocument()
    expect(screen.getByText(new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Integrations' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Publish' })).toBeEnabled()
  },
)

test('missing_publish shows no "Last published on" line', async () => {
  renderPin({
    can_publish: true,
    publish_blocked_by: null,
    status: { state: 'out_of_date', reason: 'missing_publish', last_published_on: null },
  })

  expect(await screen.findByText('Out of date')).toBeInTheDocument()
  expect(screen.queryByText(/Last published on/)).not.toBeInTheDocument()
})

test('Publish on success shows "Catalog published" and refetches the status', async () => {
  const fetchMock = renderPin(
    { can_publish: true, publish_blocked_by: null, status: UP_TO_DATE },
    (url, init) =>
      url === '/pinned-catalog/publish' && init?.method === 'POST'
        ? jsonResponse(200, { can_publish: true, publish_blocked_by: null, status: UP_TO_DATE })
        : undefined,
  )

  await userEvent.click(await screen.findByRole('button', { name: 'Publish' }))

  expect(await screen.findByText('Catalog published')).toBeInTheDocument()
  const gets = fetchMock.mock.calls.filter(([url, init]) => url === '/pinned-catalog' && init?.method !== 'POST')
  expect(gets.length).toBeGreaterThanOrEqual(2)
})

test('a failed Publish shows its fixed reason', async () => {
  renderPin({ can_publish: true, publish_blocked_by: null, status: UP_TO_DATE }, (url, init) =>
    url === '/pinned-catalog/publish' && init?.method === 'POST'
      ? jsonResponse(422, { detail: 'refused', code: 'pinned_catalog.bot_cannot_post' })
      : undefined,
  )

  await userEvent.click(await screen.findByRole('button', { name: 'Publish' }))

  expect(await screen.findByRole('alert')).toHaveTextContent("The bot can't post in the channel")
})

test('the blocked lines and the out-of-date reasons are the registered, measured bindings', async () => {
  renderPin({ can_publish: false, publish_blocked_by: 'not_tested', status: null })
  await screen.findByRole('button', { name: 'Publish' })
  expect(screen.getByText(/Send yourself a test first/).textContent).toBe(NOT_READY_LINE)

  const registered = LIMITED_COPY.map((entry) => entry.text)
  expect(registered).toContain(NOT_READY_LINE)
  expect(registered).toContain(CHANNEL_MISSING_LINE)
  for (const line of Object.values(OUT_OF_DATE_LINES)) {
    expect(registered.includes(line) || LONG_REFUSALS.includes(line)).toBe(true)
  }
  for (const entry of LIMITED_COPY) expect(measure(entry.text)).toBeLessThanOrEqual(80)
  expect(INTEGRATIONS_LINK_WORD).toBe('Integrations')
})

test('channel_missing renders the registered line, link word included', async () => {
  renderPin({ can_publish: false, publish_blocked_by: 'channel_missing', status: null })
  await screen.findByRole('button', { name: 'Publish' })
  expect(screen.getByText(/The channel is missing/).textContent).toBe(CHANNEL_MISSING_LINE)
})

test.each(Object.keys(PINNED_CATALOG_REASON_LABEL) as PinReason[])(
  'out_of_date with %s renders exactly its registered line, and that line fits or is listed',
  async (reason) => {
    renderOutOfDate(reason)
    await screen.findByRole('button', { name: 'Publish' })
    const shown = document.querySelector('.catalogo__publicar-estado')?.textContent
    const line = OUT_OF_DATE_LINES[reason]
    expect(shown).toBe(line)
    expect(line.startsWith('Out of date · ')).toBe(true)
    if (measure(line) > 80) {
      expect(LONG_REFUSALS).toContain(line)
      expect(LIMITED_COPY.map((entry) => entry.text)).not.toContain(line)
    } else {
      expect(LIMITED_COPY.map((entry) => entry.text)).toContain(line)
    }
  },
)

test('the line too_long makes as shown (the longest) fits 80 in English, so it is limited, not listed as long', () => {
  const line = OUT_OF_DATE_LINES.too_long
  expect(measure(line)).toBeLessThanOrEqual(80)
  expect(LONG_REFUSALS).toEqual([])
  expect(LIMITED_COPY.map((entry) => entry.text)).toContain(line)
  expect(copyProblems('copy/catalog', catalogCopy)).toEqual([])
})

function renderOutOfDate(reason: PinReason) {
  return renderPin({
    can_publish: true,
    publish_blocked_by: null,
    status: { state: 'out_of_date', reason, last_published_on: null },
  })
}

test('"Out of date" carries the hidden attention icon beside its reason; "Up to date" carries none', async () => {
  renderOutOfDate('message_gone')
  const title = await screen.findByText('Out of date')
  const box = title.closest('.catalogo__publicar-estado') as HTMLElement

  expect(box.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  expect(box).toHaveTextContent(`Out of date · ${PINNED_CATALOG_REASON_LABEL.message_gone}`)
  expectIconAndTextRule(document.body)
})

test('Up to date has no attention icon, and Publish is icon + text with its icon hidden', async () => {
  renderPin({ can_publish: true, publish_blocked_by: null, status: UP_TO_DATE })

  const title = await screen.findByText('Up to date')
  expect(title.closest('.catalogo__publicar-estado')?.querySelector('svg')).toBeNull()
  const publish = screen.getByRole('button', { name: 'Publish' })
  expect(publish).toHaveTextContent('Publish')
  expect(publish.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  expectIconAndTextRule(document.body)
})
