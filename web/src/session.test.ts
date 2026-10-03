import { QueryClient } from '@tanstack/react-query'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import * as client from './api/client'
import { acceptInvitation, handleUnauthorized, login, logOut, type SessionActions } from './session'

vi.mock('./api/client', () => ({
  post: vi.fn(),
}))

function actions(): SessionActions & { navigate: ReturnType<typeof vi.fn> } {
  const queryClient = new QueryClient()
  queryClient.setQueryData(['me'], { businessName: 'x' })
  const navigate = vi.fn<(path: string) => void>()
  return { queryClient, navigate }
}

beforeEach(() => {
  vi.mocked(client.post).mockReset().mockResolvedValue(undefined)
})

describe('login', () => {
  test('clears the whole cache before landing on Inicio', async () => {
    const session = actions()

    await login(session, 'ana@x.com', 'secreta123')

    expect(session.queryClient.getQueryData(['me'])).toBeUndefined()
    expect(session.navigate).toHaveBeenCalledWith('/')
  })

  test('never returns the response body: the client never reads the token', async () => {
    const session = actions()

    const result = await login(session, 'ana@x.com', 'secreta123')

    expect(result).toBeUndefined()
  })
})

describe('acceptInvitation', () => {
  test('clears the cache and lands on Inicio, already signed in', async () => {
    const session = actions()

    await acceptInvitation(session, 'tok123', { email: 'ana@x.com', password: 'secreta123' })

    expect(session.queryClient.getQueryData(['me'])).toBeUndefined()
    expect(session.navigate).toHaveBeenCalledWith('/')
  })
})

describe('logOut', () => {
  test('clears the cache and lands on Entrar', async () => {
    const session = actions()

    await logOut(session)

    expect(session.queryClient.getQueryData(['me'])).toBeUndefined()
    expect(session.navigate).toHaveBeenCalledWith('/entrar')
  })
})

describe('handleUnauthorized', () => {
  test('a 401 on a gated route clears the cache and sends the person to Entrar', () => {
    const session = actions()

    handleUnauthorized(session, '/clientes')

    expect(session.queryClient.getQueryData(['me'])).toBeUndefined()
    expect(session.navigate).toHaveBeenCalledWith('/entrar')
  })

  test('a 401 on a public route does nothing', () => {
    const session = actions()

    handleUnauthorized(session, '/entrar')
    handleUnauthorized(session, '/invitation/tok123')

    expect(session.queryClient.getQueryData(['me'])).toEqual({ businessName: 'x' })
    expect(session.navigate).not.toHaveBeenCalled()
  })
})
