/**
 * The only module that calls `fetch` (plan, invariants): every screen reaches the
 * backend through the functions here, never through `fetch` or `XMLHttpRequest`
 * directly. The front never reads a response's `detail` (plan, "Refusals"): only its
 * `code`, carried by `ApiError`.
 */

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  /** The named fields a refusal carries next to its code (ADR-0071), e.g. `count`. */
  readonly fields: Readonly<Record<string, unknown>>
  constructor(status: number, code: string, fields: Readonly<Record<string, unknown>> = {}) {
    super(`request refused: ${code}`)
    this.status = status
    this.code = code
    this.fields = fields
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
  count?: unknown
  field?: unknown
}

/** `ApiError.code` when the response body carried no recognised `code` field — a
 * 500 above all, never a modelled business refusal. Exported so a screen tells
 * a server error apart by name, not by repeating this literal (open review
 * finding: a renamed sentinel would otherwise silently fall through unnoticed). */
export const UNKNOWN_CODE = 'unknown'

/** Calls `fetch` for every path here: a thrown `fetch` is a `NetworkError`, a response
 * that is not ok an `ApiError` built from its JSON `code`/`count`/`field`. */
async function request(path: string, init: RequestInit): Promise<Response> {
  let response: Response
  try {
    response = await fetch(path, init)
  } catch {
    throw new NetworkError()
  }
  if (!response.ok) {
    const parsed: ErrorBody = await response.json().catch(() => ({}) as ErrorBody)
    const code = typeof parsed.code === 'string' ? parsed.code : UNKNOWN_CODE
    throw new ApiError(response.status, code, {
      ...(typeof parsed.count === 'number' ? { count: parsed.count } : {}),
      ...(typeof parsed.field === 'string' ? { field: parsed.field } : {}),
    })
  }
  return response
}

async function send<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await request(path, {
    method,
    credentials: 'include',
    // Always JSON: the server serves the app shell on a few paths it shares with the
    // API only to a request that accepts text/html (docs/adr/0024).
    headers:
      body === undefined
        ? { Accept: 'application/json' }
        : { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

/** A binary read: the answer is an image, never JSON. `no-store` so a re-read after a
 * change never shows the old bytes. `text/html` is never accepted (docs/adr/0024). */
export async function getBlob(path: string): Promise<Blob> {
  const response = await request(path, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers: { Accept: 'image/png, image/jpeg, application/json' },
  })
  return response.blob()
}

/** A raw upload: `body` goes to `fetch` as it is, never stringified, with the caller's
 * `Content-Type`. */
export async function putBody(path: string, body: Blob, contentType: string): Promise<void> {
  await request(path, {
    method: 'PUT',
    credentials: 'include',
    headers: { Accept: 'application/json', 'Content-Type': contentType },
    body,
  })
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
