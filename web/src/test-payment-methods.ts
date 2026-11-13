/**
 * A test `fetch` that also answers the business's methods list (`GET /api/payment-methods`) the way
 * the API does, and hands every other request to the test's own handler untouched.
 */

type Handler = (path: string, init?: RequestInit) => Promise<Response>

export const METHODS_ANSWER = [
  { id: 1, name: 'Cash', icon: 'banknote', position: 1, in_use: false },
  { id: 2, name: 'Transfer', icon: 'bank', position: 2, in_use: false },
]

/** `methods` is read at every request, so a test can archive a method between two reads. */
export function withPaymentMethods(
  handler: (...args: never[]) => unknown,
  methods: () => readonly object[] = () => METHODS_ANSWER,
): Handler {
  const inner = handler as unknown as Handler
  return (path, init) =>
    String(path) === '/api/payment-methods' && (init?.method ?? 'GET') === 'GET'
      ? Promise.resolve(
          new Response(JSON.stringify(methods()), { status: 200, headers: { 'Content-Type': 'application/json' } }),
        )
      : inner(path, init)
}
