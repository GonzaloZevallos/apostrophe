import { CUSTOMERS, HOME, INVITATION, LOGIN, RESET, pathTo } from './routes'
import { QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import * as client from './api/client'
import i18n from './i18n'
import { applyShownLanguage, resetToBootLanguage, setLocaleLoader } from './i18n/language'
import { loadLocale } from './i18n/resources'
import {
  acceptInvitation,
  changePassword,
  handleUnauthorized,
  login,
  logOut,
  openInvitation,
  openResetLink,
  submitReset,
  type SessionActions,
} from './session'

vi.mock('./api/client', () => ({
  post: vi.fn(),
  get: vi.fn(),
}))

function actions(): SessionActions & { navigate: ReturnType<typeof vi.fn> } {
  const queryClient = new QueryClient()
  queryClient.setQueryData(['me'], { businessName: 'x' })
  const navigate = vi.fn<(path: string) => void>()
  return { queryClient, navigate }
}

async function showGerman(): Promise<void> {
  setLocaleLoader(() => Promise.resolve({ common: { hello: 'Hallo' } }))
  await applyShownLanguage('de')
  expect(i18n.language).toBe('de')
}

afterEach(() => {
  setLocaleLoader(loadLocale)
  resetToBootLanguage()
})

beforeEach(() => {
  vi.mocked(client.post).mockReset().mockResolvedValue(undefined)
  vi.mocked(client.get).mockReset()
})

describe('login', () => {
  test('clears the whole cache before landing on Inicio', async () => {
    const session = actions()

    await login(session, 'ana@x.com', 'secreta123')

    expect(session.queryClient.getQueryData(['me'])).toBeUndefined()
    expect(session.navigate).toHaveBeenCalledWith(HOME)
  })

  test('never returns the response body: the client never reads the token', async () => {
    const session = actions()

    const result = await login(session, 'ana@x.com', 'secreta123')

    expect(result).toBeUndefined()
  })
})

describe('acceptInvitation', () => {
  test('a join accept clears the cache and lands on Inicio, already signed in', async () => {
    const session = actions()

    await acceptInvitation(session, 'tok123', { email: 'ana@x.com', password: 'secreta123' }, 'join_business')

    expect(session.queryClient.getQueryData(['me'])).toBeUndefined()
    expect(session.navigate).toHaveBeenCalledWith(HOME)
  })

  test('a new-business accept lands in the Onboarding', async () => {
    const session = actions()

    await acceptInvitation(
      session,
      'tok123',
      { email: 'ana@x.com', password: 'secreta123', business_name: 'La Huerta' },
      'new_business',
    )

    expect(session.navigate).toHaveBeenCalledWith('/onboarding')
  })
})

describe('logOut', () => {
  test('clears the cache and lands on Entrar', async () => {
    const session = actions()

    await logOut(session)

    expect(session.queryClient.getQueryData(['me'])).toBeUndefined()
    expect(session.navigate).toHaveBeenCalledWith(LOGIN)
  })
})

describe('openInvitation', () => {
  test('logs out, then clears the cache, then looks the invitation up — in that order', async () => {
    const session = actions()
    const order: string[] = []
    vi.mocked(client.post).mockImplementation(async () => {
      order.push('logout')
    })
    const clearSpy = vi.spyOn(session.queryClient, 'clear').mockImplementation(() => {
      order.push('clear')
    })
    const view = {
      kind: 'join_business' as const,
      business_name: 'La Esquina',
      expires_at: '2026-10-09T00:00:00Z',
    }
    vi.mocked(client.get).mockImplementation(async () => {
      order.push('lookup')
      return view
    })

    const result = await openInvitation(session, 'tok123')

    expect(order).toEqual(['logout', 'clear', 'lookup'])
    expect(client.post).toHaveBeenCalledWith('/auth/logout')
    expect(client.get).toHaveBeenCalledWith('/invitations/tok123')
    expect(result).toEqual(view)
    expect(session.navigate).not.toHaveBeenCalled()
    clearSpy.mockRestore()
  })

  test('the cache is empty by the time the lookup runs', async () => {
    const session = actions()
    vi.mocked(client.get).mockImplementation(async () => {
      // If logout-then-clear had not already run, this would still see the stale
      // 'me' entry seeded by `actions()`.
      expect(session.queryClient.getQueryData(['me'])).toBeUndefined()
      return { kind: 'new_business', business_name: null, expires_at: '2026-10-09T00:00:00Z' }
    })

    await openInvitation(session, 'tok123')
  })
})

describe('handleUnauthorized', () => {
  test('a 401 on a gated route clears the cache and sends the person to Entrar', () => {
    const session = actions()

    handleUnauthorized(session, CUSTOMERS)

    expect(session.queryClient.getQueryData(['me'])).toBeUndefined()
    expect(session.navigate).toHaveBeenCalledWith(LOGIN)
  })

  test('a 401 on a public route does nothing', () => {
    const session = actions()

    handleUnauthorized(session, LOGIN)
    handleUnauthorized(session, pathTo(INVITATION, { token: 'tok123' }))
    handleUnauthorized(session, pathTo(RESET, { token: 'tok123' }))

    expect(session.queryClient.getQueryData(['me'])).toEqual({ businessName: 'x' })
    expect(session.navigate).not.toHaveBeenCalled()
  })
})

describe('changePassword', () => {
  test('posts to /auth/password and never returns the response body', async () => {
    const result = await changePassword('vieja123456', 'nueva123456')

    expect(client.post).toHaveBeenCalledWith('/auth/password', {
      current_password: 'vieja123456',
      new_password: 'nueva123456',
    })
    expect(result).toBeUndefined()
  })
})

describe('openResetLink', () => {
  test('logs out, then clears the cache, then looks the link up — in that order', async () => {
    const session = actions()
    const order: string[] = []
    vi.mocked(client.post).mockImplementation(async () => {
      order.push('logout')
    })
    const clearSpy = vi.spyOn(session.queryClient, 'clear').mockImplementation(() => {
      order.push('clear')
    })
    vi.mocked(client.get).mockImplementation(async () => {
      order.push('lookup')
    })

    await openResetLink(session, 'tok123')

    expect(order).toEqual(['logout', 'clear', 'lookup'])
    expect(client.post).toHaveBeenCalledWith('/auth/logout')
    expect(client.get).toHaveBeenCalledWith('/reset-links/tok123')
    clearSpy.mockRestore()
  })
})

describe('submitReset', () => {
  test('posts the new password and lands on Inicio, cache cleared', async () => {
    const session = actions()

    await submitReset(session, 'tok123', 'nueva123456')

    expect(client.post).toHaveBeenCalledWith('/reset-links/tok123', { new_password: 'nueva123456' })
    expect(session.queryClient.getQueryData(['me'])).toBeUndefined()
    expect(session.navigate).toHaveBeenCalledWith(HOME)
  })
})

describe('the boot language at every session boundary', () => {
  test('login, accept, logout and reset submit restore it', async () => {
    const boundaries = [
      (session: SessionActions) => login(session, 'ana@x.com', 'secreta123'),
      (session: SessionActions) =>
        acceptInvitation(session, 'tok', { email: 'ana@x.com', password: 'secreta123' }, 'join_business'),
      (session: SessionActions) => logOut(session),
      (session: SessionActions) => submitReset(session, 'tok', 'secreta123'),
    ]
    for (const run of boundaries) {
      await showGerman()

      await run(actions())

      expect(i18n.language).toBe('en')
      expect(document.documentElement.lang).toBe('en')
    }
  })

  test('the invitation lookup restores it before the lookup answers', async () => {
    await showGerman()
    vi.mocked(client.get).mockImplementation(() => {
      expect(i18n.language).toBe('en')
      return Promise.resolve({ kind: 'join_business', business_name: null, expires_at: 'x' })
    })

    await openInvitation({ queryClient: new QueryClient() }, 'tok')

    expect(i18n.language).toBe('en')
  })

  test('opening a reset link restores it', async () => {
    await showGerman()
    vi.mocked(client.get).mockResolvedValue(undefined)

    await openResetLink({ queryClient: new QueryClient() }, 'tok')

    expect(i18n.language).toBe('en')
  })

  test('a 401 on a gated screen restores it; on a public screen nothing changes', async () => {
    await showGerman()
    handleUnauthorized(actions(), LOGIN)
    expect(i18n.language).toBe('de')

    handleUnauthorized(actions(), CUSTOMERS)

    expect(i18n.language).toBe('en')
  })

  test('a password change is no boundary: the shown language stays', async () => {
    await showGerman()

    await changePassword('vieja12345', 'nueva12345')

    expect(i18n.language).toBe('de')
  })

  test('a response that lands after the sign-out leaves <html lang> at the boot value', async () => {
    let answer: (bundle: Record<string, never>) => void = () => undefined
    setLocaleLoader(() => new Promise((resolve) => { answer = resolve }))
    const pending = applyShownLanguage('de')

    await logOut(actions())
    answer({})
    await pending

    expect(i18n.language).toBe('en')
    expect(document.documentElement.lang).toBe('en')
  })
})
