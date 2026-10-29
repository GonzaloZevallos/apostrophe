import '@testing-library/jest-dom/vitest'
import { configure } from '@testing-library/react'
import { afterEach, beforeEach } from 'vitest'
// The app's one i18next instance, installed through the i18n folder's own test helper (as
// `main.tsx` installs it for the app): a component test renders keys
// through it without any module outside `i18n/` importing the instance.
import './i18n/testing'
import { ASYNC_UTIL_TIMEOUT } from './test/asyncTimeout'
import { assertNoEnglishMisses, clearMissingKeys, missingKeys } from './i18n/missingKeys'

// The ceiling of every `findBy*` and `waitFor`: the library's own 1000 ms only holds
// on an idle machine. Rule: `testTimeout` in `vite.config.ts` is at least 3x this
// value (a test may await up to three sequential `findBy*`) and at least 2x the
// longest passing test measured under load. A call site sets its own timeout only to
// make it longer than this, with a comment saying why, never shorter.
configure({ asyncUtilTimeout: ASYNC_UTIL_TIMEOUT })

// jsdom has no scrolling: it prints "Not implemented" for `window.scrollTo`, which the screens
// call to come back to their place after Record payment. A test that cares spies on it.
if (typeof window !== 'undefined') window.scrollTo = () => undefined

// Translation keys that were asked for and not found are recorded by `src/i18n/missingKeys.ts`
// (the instance installs its handler under the test runner). Each test starts with none, and a
// test that leaves an English miss fails: English is the language every key is written in.
beforeEach(clearMissingKeys)
afterEach(() => assertNoEnglishMisses(missingKeys()))
