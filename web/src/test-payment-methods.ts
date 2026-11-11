/**
 * A test `fetch` that also answers the business's methods list (`GET /api/payment-methods`) the way
 * the API does, and hands every other request to the test's own handler untouched.
 */

type Handler = (path: string, init?: RequestInit) => Promise<Response>

export const METHODS_ANSWER = [
  { id: 1, name: 'Cash', icon: 'banknote', position: 1, in_use: false },
  { id: 2, name: 'Transfer', icon: 'bank', position: 2, in_use: false },
]

export function withPaymentMethods(handler: (...args: never[]) => unknown): Handler {
  const inner = handler as unknown as Handler
  return (path, init) =>
    String(path) === '/api/payment-methods' && (init?.method ?? 'GET') === 'GET'
      ? Promise.resolve(
          new Response(JSON.stringify(METHODS_ANSWER), { status: 200, headers: { 'Content-Type': 'application/json' } }),
        )
      : inner(path, init)
}
