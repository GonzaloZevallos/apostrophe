/**
 * `IntegrationsGroup` at the screen seam, under a memory data router (the leave guard
 * needs one), with the API faked at `fetch`: the saved token is never shown, Probarlo is
 * the only save, a refusal keeps everything typed, and there is no pin status nor Publicar.
 */

import { CATALOG, SETTINGS, SETTINGS_INTEGRATIONS } from '../../routes'
import { inAppState } from '../../components/inAppState'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import IntegrationsGroup from './IntegrationsGroup'
import { iconAndTextProblems } from '../../test/iconAndTextRule'
import { LIMITED_COPY, OWN_CHAT_HELP, OWN_CHAT_INFO, PREVIOUS_PIN_NOTICE } from '../../copy/settings'
import { LIMITS } from '../../copy/limits'

vi.mock('../../shell/useViewport', () => ({ useViewport: () => 'phone' }))

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const SAVED = {
  token_saved_on: '2026-08-12',
  own_chat: '123456789',
  channel_chat: '@mi_canal',
  can_publish: true,
  publish_blocked_by: null,
  status: { state: 'out_of_date', reason: 'message_gone', last_published_on: '2026-09-29' },
}
const EMPTY = {
  token_saved_on: null,
  own_chat: null,
  channel_chat: null,
  can_publish: false,
  publish_blocked_by: 'not_tested',
  status: null,
}

function renderGroup(
  initial: unknown,
  onTest?: (init: RequestInit) => Response,
  options: { refetchPending?: boolean; onLookup?: (init: RequestInit) => Promise<Response> } = {},
) {
  let reads = 0
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (url === '/pinned-catalog/test' && init?.method === 'POST') {
      return Promise.resolve((onTest ?? (() => jsonResponse(200, { ...SAVED, previous_pin_left: false })))(init))
    }
    if (url === '/pinned-catalog/own-chat-lookup' && init?.method === 'POST') {
      return (options.onLookup ?? (() => Promise.resolve(jsonResponse(200, { own_chat: '777' }))))(init)
    }
    if (url === '/pinned-catalog') {
      reads += 1
      if (options.refetchPending === true && reads > 1) return new Promise<Response>(() => undefined)
      return Promise.resolve(jsonResponse(200, initial))
    }
    return Promise.resolve(jsonResponse(404, {}))
  })
  vi.stubGlobal('fetch', fetchMock)
  const router = createMemoryRouter(
    [
      { path: SETTINGS, element: <h1>Lista</h1> },
      { path: CATALOG, element: <h1>Catálogo</h1> },
      { path: SETTINGS_INTEGRATIONS, element: <IntegrationsGroup /> },
    ],
    { initialEntries: [SETTINGS, { pathname: SETTINGS_INTEGRATIONS, state: inAppState({ pathname: SETTINGS }) }], initialIndex: 1 },
  )
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return Object.assign(fetchMock, { router })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

test('shows the saved token masked with Cambiar and the saved chats', async () => {
  renderGroup(SAVED)

  expect(await screen.findByText('Guardado el 12/08 · no se muestra más')).toBeInTheDocument()
  expect(screen.getByLabelText('Tu chat')).toHaveValue('123456789')
  expect(screen.getByLabelText('Chat del canal')).toHaveValue('@mi_canal')
  await userEvent.click(screen.getByRole('button', { name: 'Change' }))
  expect(screen.getByLabelText('Token del bot')).toHaveValue('')
})

test('an empty business shows empty fields and no "Guardado" line', async () => {
  renderGroup(EMPTY)

  expect(await screen.findByLabelText('Token del bot')).toHaveValue('')
  expect(screen.getByLabelText('Tu chat')).toHaveValue('')
  expect(screen.getByLabelText('Chat del canal')).toHaveValue('')
  expect(screen.queryByText(/Guardado el/)).not.toBeInTheDocument()
})

test('links to the catalog screen, with no pin status and no Publicar', async () => {
  renderGroup(SAVED)

  await screen.findByLabelText('Tu chat')
  expect(screen.getByRole('link', { name: 'Ir al catálogo' })).toHaveAttribute('href', CATALOG)
  expect(screen.queryByRole('button', { name: 'Publicar' })).not.toBeInTheDocument()
  expect(screen.queryByText('Desactualizado')).not.toBeInTheDocument()
  expect(screen.queryByText('Al día')).not.toBeInTheDocument()
})

test('"Ir al catálogo" opens Catálogo as an in-app entry', async () => {
  const { router } = renderGroup(SAVED)

  await userEvent.click(await screen.findByRole('link', { name: 'Ir al catálogo' }))

  expect(router.state.location.pathname).toBe(CATALOG)
  expect(router.state.location.state).toEqual(inAppState({ pathname: SETTINGS_INTEGRATIONS }))
})

test('Probarlo saves, clears the token, shows the toast and the "desfijalo" line', async () => {
  const fetchMock = renderGroup(EMPTY, () =>
    jsonResponse(200, { ...SAVED, previous_pin_left: true }),
  )

  await userEvent.type(await screen.findByLabelText('Token del bot'), '123:secret')
  await userEvent.type(screen.getByLabelText('Tu chat'), '123456789')
  await userEvent.click(screen.getByRole('button', { name: 'Probarlo' }))

  expect(await screen.findByText('Prueba enviada')).toBeInTheDocument()
  expect(
    screen.getByText('El mensaje fijado anterior queda como está; desfijalo vos en Telegram.'),
  ).toBeInTheDocument()
  expect(screen.getByText('Guardado el 12/08 · no se muestra más')).toBeInTheDocument()
  const call = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')
  expect(JSON.parse(call?.[1]?.body as string)).toEqual({
    token: '123:secret',
    own_chat: '123456789',
    channel_chat: null,
  })
  expect(screen.queryByDisplayValue('123:secret')).not.toBeInTheDocument()
})

test('a refused Probarlo saves nothing and keeps everything typed, the token included', async () => {
  renderGroup(EMPTY, () =>
    jsonResponse(422, { detail: 'refused', code: 'pinned_catalog.telegram_unreachable' }),
  )

  await userEvent.type(await screen.findByLabelText('Token del bot'), '123:secret')
  await userEvent.type(screen.getByLabelText('Tu chat'), '555')
  await userEvent.type(screen.getByLabelText('Chat del canal'), '@probando')
  await userEvent.click(screen.getByRole('button', { name: 'Probarlo' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Telegram did not respond')
  expect(screen.queryByText('Prueba enviada')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Token del bot')).toHaveValue('123:secret')
  expect(screen.getByLabelText('Tu chat')).toHaveValue('555')
  expect(screen.getByLabelText('Chat del canal')).toHaveValue('@probando')
  expect(screen.queryByText(/Guardado el/)).not.toBeInTheDocument()
})

const PROBARLO_REASONS: [string, string][] = [
  ['pinned_catalog.token_invalid', 'The token is not valid: copy it again from @BotFather.'],
  [
    'pinned_catalog.own_chat_not_started',
    'Open your bot in Telegram and tap Start, then test it again.',
  ],
  [
    'pinned_catalog.own_chat_not_found',
    'We could not find your chat: check the number and tap Start in your bot.',
  ],
  ['pinned_catalog.test_failed', 'We could not send you the test: check the token and your chat.'],
  ['pinned_catalog.telegram_unreachable', 'Telegram did not respond'],
  [
    'pinned_catalog.too_long',
    'It is too long for Telegram: shorten aromas or hide varieties.',
  ],
]

test.each(PROBARLO_REASONS)(
  'a Probarlo refused with %s shows its own reason, keeps the form and never blames the channel',
  async (code, copy) => {
    renderGroup(EMPTY, () => jsonResponse(422, { detail: 'refused', code }))

    await userEvent.type(await screen.findByLabelText('Token del bot'), '123:secret')
    await userEvent.type(screen.getByLabelText('Tu chat'), '555')
    await userEvent.type(screen.getByLabelText('Chat del canal'), '@probando')
    await userEvent.click(screen.getByRole('button', { name: 'Probarlo' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(copy)
    expect(alert).not.toHaveTextContent('The bot cannot post in the channel')
    expect(alert).not.toHaveTextContent('123:secret')
    expect(screen.queryByText('Prueba enviada')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Token del bot')).toHaveValue('123:secret')
    expect(screen.getByLabelText('Tu chat')).toHaveValue('555')
    expect(screen.getByLabelText('Chat del canal')).toHaveValue('@probando')
  },
)

test('an untouched group closes at once; a typed change asks first', async () => {
  renderGroup(SAVED)

  await screen.findByLabelText('Tu chat')
  await userEvent.type(screen.getByLabelText('Chat del canal'), 'x')
  await userEvent.click(screen.getByRole('button', { name: 'Close' }))

  expect(await screen.findByText('Discard the change?')).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Lista' })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Yes, discard it' }))
  expect(await screen.findByRole('heading', { name: 'Lista' })).toBeInTheDocument()
})

test('an untouched group closes with no confirmation', async () => {
  renderGroup(SAVED)

  await screen.findByLabelText('Tu chat')
  await userEvent.click(screen.getByRole('button', { name: 'Close' }))

  expect(await screen.findByRole('heading', { name: 'Lista' })).toBeInTheDocument()
  expect(screen.queryByText('Discard the change?')).not.toBeInTheDocument()
})

test('after saving, Cerrar closes at once even while the refetch is pending', async () => {
  renderGroup(EMPTY, undefined, { refetchPending: true })

  await userEvent.type(await screen.findByLabelText('Token del bot'), '123:secret')
  await userEvent.type(screen.getByLabelText('Tu chat'), '123456789')
  await userEvent.click(screen.getByRole('button', { name: 'Probarlo' }))
  await screen.findByText('Prueba enviada')
  await userEvent.click(screen.getByRole('button', { name: 'Close' }))

  expect(await screen.findByRole('heading', { name: 'Lista' })).toBeInTheDocument()
  expect(screen.queryByText('Discard the change?')).not.toBeInTheDocument()
})

const OWN_CHAT_HELP_LINE = 'Tocá Iniciar en tu bot; tu número lo ves con @userinfobot.'
const CHANNEL_HELP_LINE = 'Es el @usuario o el enlace del canal donde se publica el catálogo.'

function lookupCalls(fetchMock: ReturnType<typeof renderGroup>) {
  return fetchMock.mock.calls.filter(([url]) => url === '/pinned-catalog/own-chat-lookup')
}

function saveCalls(fetchMock: ReturnType<typeof renderGroup>) {
  return fetchMock.mock.calls.filter(([url]) => url === '/pinned-catalog/test')
}

test('the own-chat help line names Iniciar and @userinfobot; the channel line is unchanged', async () => {
  renderGroup(SAVED)

  await screen.findByLabelText('Tu chat')
  expect(screen.getByText(OWN_CHAT_HELP_LINE)).toBeInTheDocument()
  expect(screen.getByText(CHANNEL_HELP_LINE)).toBeInTheDocument()
  expect(screen.queryByText(/escribile cualquier cosa/)).not.toBeInTheDocument()
})

test('Buscar mi chat puts the one chat found in the field over a number already there, saves nothing and arms the leave guard', async () => {
  const fetchMock = renderGroup(SAVED)

  await screen.findByLabelText('Tu chat')
  await userEvent.click(screen.getByRole('button', { name: 'Buscar mi chat' }))

  await waitFor(() => expect(screen.getByLabelText('Tu chat')).toHaveValue('777'))
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(saveCalls(fetchMock)).toHaveLength(0)
  expect(screen.queryByText('Prueba enviada')).not.toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Close' }))
  expect(await screen.findByText('Discard the change?')).toBeInTheDocument()
})

test('with the saved token and nothing typed, Buscar mi chat sends token null', async () => {
  const fetchMock = renderGroup(SAVED)

  await screen.findByLabelText('Tu chat')
  await userEvent.click(screen.getByRole('button', { name: 'Buscar mi chat' }))
  await waitFor(() => expect(lookupCalls(fetchMock)).toHaveLength(1))

  expect(JSON.parse(lookupCalls(fetchMock)[0]?.[1]?.body as string)).toEqual({ token: null })
})

test('a token typed over the saved one is the one Buscar mi chat sends', async () => {
  const fetchMock = renderGroup(SAVED)

  await screen.findByLabelText('Tu chat')
  await userEvent.click(screen.getByRole('button', { name: 'Change' }))
  await userEvent.type(screen.getByLabelText('Token del bot'), '123:typed')
  await userEvent.click(screen.getByRole('button', { name: 'Buscar mi chat' }))
  await waitFor(() => expect(lookupCalls(fetchMock)).toHaveLength(1))

  expect(JSON.parse(lookupCalls(fetchMock)[0]?.[1]?.body as string)).toEqual({ token: '123:typed' })
})

test('a token field opened with Cambiar but left empty sends null', async () => {
  const fetchMock = renderGroup(SAVED)

  await screen.findByLabelText('Tu chat')
  await userEvent.click(screen.getByRole('button', { name: 'Change' }))
  await userEvent.click(screen.getByRole('button', { name: 'Buscar mi chat' }))
  await waitFor(() => expect(lookupCalls(fetchMock)).toHaveLength(1))

  expect(JSON.parse(lookupCalls(fetchMock)[0]?.[1]?.body as string)).toEqual({ token: null })
})

test('with no token typed or saved, Buscar mi chat is disabled and says why in words', async () => {
  const fetchMock = renderGroup(EMPTY)

  await screen.findByLabelText('Token del bot')
  const button = screen.getByRole('button', { name: 'Buscar mi chat' })
  expect(button).toBeDisabled()
  expect(screen.getByText('Cargá el token primero')).toBeInTheDocument()

  await userEvent.type(screen.getByLabelText('Token del bot'), '123:typed')
  expect(button).toBeEnabled()
  expect(screen.queryByText('Cargá el token primero')).not.toBeInTheDocument()
  expect(lookupCalls(fetchMock)).toHaveLength(0)
})

test('a token of only spaces does not enable Buscar mi chat', async () => {
  renderGroup(EMPTY)

  await userEvent.type(await screen.findByLabelText('Token del bot'), '   ')
  expect(screen.getByRole('button', { name: 'Buscar mi chat' })).toBeDisabled()
})

test('Buscar mi chat is disabled while its request runs', async () => {
  let answer: (response: Response) => void = () => undefined
  renderGroup(SAVED, undefined, {
    onLookup: () => new Promise<Response>((resolve) => (answer = resolve)),
  })

  await screen.findByLabelText('Tu chat')
  await userEvent.click(screen.getByRole('button', { name: 'Buscar mi chat' }))
  expect(screen.getByRole('button', { name: 'Buscar mi chat' })).toBeDisabled()

  answer(jsonResponse(200, { own_chat: '777' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Buscar mi chat' })).toBeEnabled())
})

const LOOKUP_REFUSALS: [string, string][] = [
  [
    'pinned_catalog.no_messages',
    'No messages in your bot yet: open it in Telegram, tap Start and look again.',
  ],
  [
    'pinned_catalog.several_chats',
    'Several people wrote to your bot: find your number with @userinfobot, type it.',
  ],
  [
    'pinned_catalog.updates_unreadable',
    "We cannot read your bot's messages: find your number with @userinfobot, type it.",
  ],
  ['pinned_catalog.token_invalid', 'The token is not valid: copy it again from @BotFather.'],
  ['pinned_catalog.telegram_unreachable', 'Telegram did not respond'],
]

test.each(LOOKUP_REFUSALS)(
  'Buscar mi chat refused with %s shows its reason and leaves the field as it was',
  async (code, copy) => {
    const fetchMock = renderGroup(SAVED, undefined, {
      onLookup: () => Promise.resolve(jsonResponse(422, { detail: 'refused', code })),
    })

    await screen.findByLabelText('Tu chat')
    await userEvent.click(screen.getByRole('button', { name: 'Buscar mi chat' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(copy)
    expect(screen.getByLabelText('Tu chat')).toHaveValue('123456789')
    expect(screen.getByLabelText('Chat del canal')).toHaveValue('@mi_canal')
    expect(saveCalls(fetchMock)).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Buscar mi chat' })).toBeEnabled()
  },
)

test('Buscar mi chat with no connection shows the offline notice and keeps the field', async () => {
  renderGroup(SAVED, undefined, { onLookup: () => Promise.reject(new TypeError('offline')) })

  await screen.findByLabelText('Tu chat')
  await userEvent.click(screen.getByRole('button', { name: 'Buscar mi chat' }))

  expect(await screen.findByText(/offline/i)).toBeInTheDocument()
  expect(screen.getByLabelText('Tu chat')).toHaveValue('123456789')
})

test('a lookup reason clears when Probarlo runs, and a Probarlo reason clears when Buscar mi chat runs', async () => {
  renderGroup(SAVED, () => jsonResponse(422, { detail: 'refused', code: 'pinned_catalog.test_failed' }), {
    onLookup: () =>
      Promise.resolve(jsonResponse(422, { detail: 'refused', code: 'pinned_catalog.no_messages' })),
  })

  await screen.findByLabelText('Tu chat')
  await userEvent.click(screen.getByRole('button', { name: 'Buscar mi chat' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('No messages in your bot yet')
  await userEvent.click(screen.getByRole('button', { name: 'Probarlo' }))
  await waitFor(() =>
    expect(screen.getByRole('alert')).toHaveTextContent('We could not send you the test'),
  )
  expect(screen.getAllByRole('alert')).toHaveLength(1)
  await userEvent.click(screen.getByRole('button', { name: 'Buscar mi chat' }))
  await waitFor(() =>
    expect(screen.getByRole('alert')).toHaveTextContent('No messages in your bot yet'),
  )
  expect(screen.getAllByRole('alert')).toHaveLength(1)
})

test('Buscar mi chat is icon + text: the icon is hidden, so the name stays the words', async () => {
  renderGroup(SAVED)

  await screen.findByLabelText('Tu chat')
  const button = screen.getByRole('button', { name: 'Buscar mi chat' })
  const icon = button.querySelector('svg')
  expect(icon).not.toBeNull()
  expect(icon).toHaveAttribute('aria-hidden', 'true')
  expect(button).toHaveTextContent('Buscar mi chat')
})

test('Cambiar stays a text link named Cambiar, with no icon', async () => {
  renderGroup(SAVED)

  const change = await screen.findByRole('button', { name: 'Change' })
  expect(change.querySelector('svg')).toBeNull()
})

test('the help lines, the token hint and the consequence line each fit their limit', async () => {
  renderGroup(SAVED, () => jsonResponse(200, { ...SAVED, previous_pin_left: true }))

  await screen.findByLabelText('Tu chat')
  for (const copy of [OWN_CHAT_HELP_LINE, CHANNEL_HELP_LINE]) {
    expect(Array.from(copy).length).toBeLessThanOrEqual(80)
  }
  await userEvent.type(screen.getByLabelText('Tu chat'), '1')
  await userEvent.click(screen.getByRole('button', { name: 'Probarlo' }))
  const notice = await screen.findByText(/El mensaje fijado anterior/)
  expect(Array.from(notice.textContent ?? '').length).toBeLessThanOrEqual(80)
})

test('the own-chat help is a MasInfo: closed at mount, "More info" opens the longer how and a second tap closes it', async () => {
  renderGroup(SAVED)
  await screen.findByLabelText('Tu chat')

  const more = screen.getByRole('button', { name: 'More info' })
  expect(more).toHaveAttribute('aria-expanded', 'false')
  expect(screen.getByText(OWN_CHAT_HELP)).toBeVisible()
  expect(screen.getByText(OWN_CHAT_INFO.more)).not.toBeVisible()

  await userEvent.click(more)
  expect(more).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByText(OWN_CHAT_INFO.more)).toBeVisible()

  await userEvent.click(more)
  expect(more).toHaveAttribute('aria-expanded', 'false')
  expect(screen.getByText(OWN_CHAT_INFO.more)).not.toBeVisible()
})

test('opening More info is not an unsaved change: Cerrar leaves without asking', async () => {
  renderGroup(SAVED)
  await screen.findByLabelText('Tu chat')

  await userEvent.click(screen.getByRole('button', { name: 'More info' }))
  await userEvent.click(screen.getByRole('button', { name: 'Close' }))

  expect(await screen.findByRole('heading', { name: 'Lista' })).toBeInTheDocument()
  expect(screen.queryByText('Discard the change?')).not.toBeInTheDocument()
})

test('the own-chat line and the consequence line are registered and within their limits; the long how is behind More info only', () => {
  expect(LIMITED_COPY).toContainEqual({ kind: 'help', text: OWN_CHAT_HELP })
  expect(LIMITED_COPY).toContainEqual({ kind: 'notice', text: PREVIOUS_PIN_NOTICE })
  expect(Array.from(OWN_CHAT_HELP).length).toBeLessThanOrEqual(LIMITS.help)
  expect(Array.from(PREVIOUS_PIN_NOTICE).length).toBeLessThanOrEqual(LIMITS.notice)
  expect(LIMITED_COPY.some(({ text }) => text === OWN_CHAT_INFO.more)).toBe(false)
})

test('the group follows the icon and text rule: Cerrar icon-only, Probarlo and Buscar mi chat icon + text', async () => {
  renderGroup(SAVED)
  await screen.findByLabelText('Tu chat')

  const close = screen.getByRole('button', { name: 'Close' })
  expect(close).toHaveClass('boton-icono')
  expect(close).toHaveTextContent('')
  expect(screen.queryByText('Volver')).not.toBeInTheDocument()
  const probarlo = screen.getByRole('button', { name: 'Probarlo' })
  expect(probarlo).toHaveTextContent('Probarlo')
  expect(probarlo.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  // The helper does not know More info's "i" (its own 44 px control, not `.boton-icono`).
  const problems = iconAndTextProblems(document.body, { limits: LIMITS }).filter(
    (problem) => !problem.includes('mas-info__boton'),
  )
  expect(problems).toEqual([])
})

test('Enter in a field still runs Probarlo', async () => {
  const fetchMock = renderGroup(SAVED)

  await userEvent.type(await screen.findByLabelText('Tu chat'), '1{Enter}')

  await waitFor(() => expect(saveCalls(fetchMock)).toHaveLength(1))
})
