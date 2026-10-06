/**
 * The only module that calls `fetch` (plan, invariants): every screen reaches the
 * backend through the functions here, never through `fetch` or `XMLHttpRequest`
 * directly. The front never reads a response's `detail` (plan, "Refusals"): only its
 * `code`, carried by `ApiError`.
 */

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  constructor(status: number, code: string) {
    super(`request refused: ${code}`)
    this.status = status
    this.code = code
  }
}

/** The network dropped, or the server never answered: never an `ApiError`, which
 * carries a rule the backend itself refused. */
export class NetworkError extends Error {
  constructor() {
    super('network error')
  }
}

interface ErrorBody {
  code?: unknown
}

/** `ApiError.code` when the response body carried no recognised `code` field — a
 * 500 above all, never a modelled business refusal. Exported so a screen tells
 * a server error apart by name, not by repeating this literal (open review
 * finding: a renamed sentinel would otherwise silently fall through unnoticed). */
export const UNKNOWN_CODE = 'unknown'

async function send<T>(method: string, path: string, body?: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      method,
      credentials: 'include',
      headers:
        body === undefined
          ? { Accept: 'application/json' }
          : { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new NetworkError()
  }
  if (!response.ok) {
    const parsed: ErrorBody = await response.json().catch(() => ({}) as ErrorBody)
    const code = typeof parsed.code === 'string' ? parsed.code : UNKNOWN_CODE
    throw new ApiError(response.status, code)
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export function get<T>(path: string): Promise<T> {
  return send<T>('GET', path)
}

export function post<T>(path: string, body?: unknown): Promise<T> {
  return send<T>('POST', path, body ?? {})
}

export function patch<T>(path: string, body: unknown): Promise<T> {
  return send<T>('PATCH', path, body)
}

export function put<T>(path: string, body: unknown): Promise<T> {
  return send<T>('PUT', path, body)
}

export function del<T>(path: string): Promise<T> {
  return send<T>('DELETE', path)
}
