/**
 * The check scheduler's share of cores (`CHECK_WORKERS`, agentic-system ADR-0070) as a vitest
 * worker cap. Only a positive whole number counts; anything else gives `undefined`, and vitest
 * keeps its own default.
 */
export function checkWorkers(env: Record<string, string | undefined>): number | undefined {
  const value = env.CHECK_WORKERS
  if (value === undefined || !/^[0-9]+$/.test(value)) return undefined
  const count = Number(value)
  return Number.isSafeInteger(count) && count > 0 ? count : undefined
}
