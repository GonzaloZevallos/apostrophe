/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig, searchForWorkspaceRoot } from 'vite'

// In development, every API path proxies to the backend (`uvicorn`, localhost:8000);
// everything else is the front's own router, served by Vite itself. The list is the
// backend's own route segments (`app/*/adapters/router.py`), not derived at this
// config's load time: a new capability's router adds its segment here too.
const API_SEGMENTS = [
  'auth',
  'business',
  'invitations',
  'customers',
  'varieties',
  'expenses',
  'expense-categories',
  'health',
  'docs',
  'redoc',
  'openapi.json',
]

export default defineConfig({
  plugins: [react()],
  server: {
    // Vite's own default (the workspace root) plus the one design-registry file the front
    // reads outside `web/`: the mobile standard's `registry.ts` imports it as static JSON.
    // Nothing else of `scripts/` is reachable.
    fs: { allow: [searchForWorkspaceRoot(process.cwd()), '../scripts/design/screens.json'] },
    proxy: Object.fromEntries(
      API_SEGMENTS.map((segment) => [`/${segment}`, 'http://localhost:8000']),
    ),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    // The ceiling for a whole test. Rule: at least 3x `asyncUtilTimeout` in
    // `src/test-setup.ts` (a test may await up to three sequential `findBy*`, as
    // `NuevaVenta.shell.test.tsx` does) and at least 2x the longest passing test
    // measured under load. Both ceilings are set only here and there: a call site
    // never sets its own shorter one.
    testTimeout: 40_000,
    // `web/e2e/` is Playwright's own suite (`playwright.config.ts`'s `testDir`),
    // run by the `web-e2e` check; vitest's defaults would otherwise also try to
    // run `flow.spec.ts` as a unit test and collide with Playwright's `test`.
    exclude: ['**/node_modules/**', 'e2e/**'],
    // Vitest turns every `.css` import into an empty module, `?raw` ones included, so
    // the architecture tests that read stylesheets as text (`import.meta.glob(...,
    // { query: '?raw' })`) saw '' and passed on nothing. Only `?raw` loads are let
    // through; component imports of CSS stay empty.
    css: { include: [/styles\/tokens\.css/, /[?&]raw(?:&|$)/] },
  },
})
