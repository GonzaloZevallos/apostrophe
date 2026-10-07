import '@testing-library/jest-dom/vitest'
import { configure } from '@testing-library/react'

// Ninety-odd jsdom files share the machine's cores when the suite runs whole; a screen
// that renders in well under a second alone can need several under that load. Testing
// Library's `findBy*` and `waitFor` wait 1 s by default, so they get room to finish.
configure({ asyncUtilTimeout: 8000 })
