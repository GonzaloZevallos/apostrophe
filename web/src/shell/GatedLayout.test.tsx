/**
 * `GatedLayout` at the screen seam: `GET /auth/me` is the gated branch's one query
 * (plan, "Session"). A dropped network shows "Sin conexión" instead of a blank page
 * that never recovers; a server error shows the generic retry, never a refusal
 * (`accounts.md`, "No network" / "Feedback"). A successful `me` renders whatever is
 * nested under it.
 */

import { HOME } from '../routes'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'
import { Profiler, useLayoutEffect } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { keys } from '../api/keys'
import { getMe } from '../api/me'
import i18n from '../i18n'
import {
  LANGUAGE_LOAD_TIMEOUT_MS,
  resetToBootLanguage,
  setLocaleLoader,
} from '../i18n/language'
import { logOut } from '../session'
import { missingKeys } from '../i18n/missingKeys'
import { loadLocale, type LocaleBundle } from '../i18n/resources'
import { SIN_CONEXION_MENSAJE } from '../copy/common'
import { ERROR_GENERICO_MENSAJE } from '../components/ErrorGenerico'
import GatedLayout from './GatedLayout'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function renderGated() {
  // `retry: false`: a failed `me` must settle into `isError` on the first try, not
  // after react-query's default exponential-backoff retries — the state under test.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[HOME]}>
        <Routes>
          <Route element={<GatedLayout />}>
            <Route index element={<div>contenido del negocio</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  setLocaleLoader(loadLocale)
  resetToBootLanguage()
})

test('a dropped network on GET /auth/me shows "Sin conexión", not a blank page', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

  renderGated()

  expect(await screen.findByText(SIN_CONEXION_MENSAJE)).toBeInTheDocument()
  expect(screen.queryByText('contenido del negocio')).not.toBeInTheDocument()
})

test('a server error on GET /auth/me shows the generic retry, not a blank page', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('internal error', { status: 500 })))

  renderGated()

  expect(await screen.findByText(ERROR_GENERICO_MENSAJE)).toBeInTheDocument()
  expect(screen.queryByText('contenido del negocio')).not.toBeInTheDocument()
})

test('a successful "me" renders what is nested under the gated layout', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      jsonResponse(200, { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02' }),
    ),
  )

  renderGated()

  expect(await screen.findByText('contenido del negocio')).toBeInTheDocument()
})

// The language of the business: what `GatedLayout` waits for before it mounts the outlet.
const events: string[] = []

function MeProbe() {
  const { data } = useQuery({ queryKey: keys.me(), queryFn: getMe })
  useLayoutEffect(() => {
    if (data !== undefined) events.push('me')
  }, [data])
  return null
}

function Content() {
  useLayoutEffect(() => {
    events.push('outlet')
  }, [])
  return <div>contenido del negocio</div>
}

function renderLanguageGated() {
  events.length = 0
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <Profiler id="tree" onRender={() => events.push('commit')}>
        <MeProbe />
        <MemoryRouter initialEntries={[HOME]}>
          <Routes>
            <Route element={<GatedLayout />}>
              <Route index element={<Content />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </Profiler>
    </QueryClientProvider>,
  )
  return queryClient
}

function answerMe(language: string): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(() =>
      Promise.resolve(
        jsonResponse(200, { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02', shown_language: language }),
      ),
    ),
  )
}

function lateLoader() {
  const requested: string[] = []
  const answers: { resolve: (bundle: LocaleBundle) => void; reject: (error: Error) => void }[] = []
  setLocaleLoader((tag) => {
    requested.push(tag)
    return new Promise<LocaleBundle>((resolve, reject) => {
      answers.push({ resolve, reject })
    })
  })
  return { requested, answers }
}

const GERMAN: LocaleBundle = { common: { hello: 'Hallo' } }

test('an English business mounts the outlet in the same commit its "me" arrives in', async () => {
  answerMe('en')

  renderLanguageGated()

  expect(await screen.findByText('contenido del negocio')).toBeInTheDocument()
  const between = events.slice(events.indexOf('me'), events.indexOf('outlet'))
  expect(events).toContain('outlet')
  expect(between).not.toContain('commit')
})

test('a business in another language renders nothing until its chunk is installed, then mounts', async () => {
  answerMe('de')
  const { requested, answers } = lateLoader()

  renderLanguageGated()
  await vi.waitFor(() => expect(requested).toEqual(['de']))
  await act(async () => {
    await Promise.resolve()
  })
  expect(screen.queryByText('contenido del negocio')).not.toBeInTheDocument()

  await act(async () => {
    answers[0]?.resolve(GERMAN)
  })

  expect(await screen.findByText('contenido del negocio')).toBeInTheDocument()
  expect(i18n.language).toBe('de')
  expect(document.documentElement.lang).toBe('de')
})

test('a rejected chunk mounts the outlet in English with one recorded miss', async () => {
  answerMe('de')
  const { answers } = lateLoader()

  renderLanguageGated()
  await vi.waitFor(() => expect(answers).toHaveLength(1))
  await act(async () => {
    answers[0]?.reject(new Error('404'))
  })

  expect(await screen.findByText('contenido del negocio')).toBeInTheDocument()
  expect(i18n.language).toBe('en')
  expect(missingKeys()).toEqual([{ language: 'de', ns: '*', key: '*' }])
  expect(document.documentElement.lang).toBe('en')
})

test('a chunk that never settles mounts the outlet in English after the timeout', async () => {
  vi.useFakeTimers()
  answerMe('de')
  lateLoader()

  renderLanguageGated()
  await act(async () => {
    await vi.advanceTimersByTimeAsync(LANGUAGE_LOAD_TIMEOUT_MS - 1)
  })
  expect(screen.queryByText('contenido del negocio')).not.toBeInTheDocument()
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1)
  })

  expect(screen.getByText('contenido del negocio')).toBeInTheDocument()
  expect(i18n.language).toBe('en')
  expect(missingKeys()).toHaveLength(1)
})

test('a chunk that resolves after the timeout does not change the language', async () => {
  vi.useFakeTimers()
  answerMe('de')
  const { answers } = lateLoader()

  renderLanguageGated()
  await act(async () => {
    await vi.advanceTimersByTimeAsync(LANGUAGE_LOAD_TIMEOUT_MS)
  })
  await act(async () => {
    answers[0]?.resolve(GERMAN)
    await vi.advanceTimersByTimeAsync(0)
  })

  expect(screen.getByText('contenido del negocio')).toBeInTheDocument()
  expect(i18n.language).toBe('en')
  expect(document.documentElement.lang).toBe('en')
})

test('a failed load followed by a "me" refetch records one miss and asks for the chunk once', async () => {
  answerMe('de')
  const { requested, answers } = lateLoader()

  const queryClient = renderLanguageGated()
  await vi.waitFor(() => expect(answers).toHaveLength(1))
  await act(async () => {
    answers[0]?.reject(new Error('404'))
  })
  expect(await screen.findByText('contenido del negocio')).toBeInTheDocument()

  await act(async () => {
    await queryClient.invalidateQueries({ queryKey: keys.me() })
  })

  expect(screen.getByText('contenido del negocio')).toBeInTheDocument()
  expect(requested).toEqual(['de'])
  expect(missingKeys()).toHaveLength(1)
})

test('after "Sign out" nothing asks /auth/me again on the way to Entrar', async () => {
  const fetchMock = vi.fn().mockImplementation((url: string) =>
    Promise.resolve(
      String(url).endsWith('/auth/me')
        ? jsonResponse(200, { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02', shown_language: 'en' })
        : new Response(null, { status: 204 }),
    ),
  )
  vi.stubGlobal('fetch', fetchMock)
  const queryClient = renderLanguageGated()
  expect(await screen.findByText('contenido del negocio')).toBeInTheDocument()
  const meCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/auth/me')).length
  expect(meCalls()).toBe(1)

  // The navigation is a stub, so the layout stays mounted exactly as in the moment before it commits.
  await act(async () => {
    await logOut({ queryClient, navigate: vi.fn() })
    await new Promise((resolve) => setTimeout(resolve, 0))
  })

  expect(meCalls()).toBe(1)
})
