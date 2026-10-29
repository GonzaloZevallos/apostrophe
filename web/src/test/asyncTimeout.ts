/**
 * The ceiling of every `findBy*` and `waitFor` in the web tests, in a module with no side
 * effects so `test-setup.ts` (which installs it) and the async-timeout scanner (which
 * judges call sites against it) read the same number.
 */
export const ASYNC_UTIL_TIMEOUT = 10_000
