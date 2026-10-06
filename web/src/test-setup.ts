import '@testing-library/jest-dom/vitest'
import { configure } from '@testing-library/react'

// `findBy*` and `waitFor` give up after 1 s by default. The screen tests wait on a whole
// flow (a save, a navigation, a refetch), and when the web checks run side by side that
// flow can take longer than a second without anything being wrong. A wait that is never
// satisfied still fails, only after 10 s instead of 1 s.
configure({ asyncUtilTimeout: 10_000 })
