import '@testing-library/jest-dom/vitest'
import { configure } from '@testing-library/react'

// The ceiling of every `findBy*` and `waitFor`: the library's own 1000 ms only holds
// on an idle machine. Rule: `testTimeout` in `vite.config.ts` is at least 3x this
// value (a test may await up to three sequential `findBy*`) and at least 2x the
// longest passing test measured under load. A call site sets its own timeout only to
// make it longer than this, with a comment saying why, never shorter.
configure({ asyncUtilTimeout: 10_000 })

// jsdom has no scrolling: it prints "Not implemented" for `window.scrollTo`, which the screens
// call to come back to their place after Record payment. A test that cares spies on it.
window.scrollTo = () => undefined
