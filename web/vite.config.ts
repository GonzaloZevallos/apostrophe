/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

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
    proxy: Object.fromEntries(
      API_SEGMENTS.map((segment) => [`/${segment}`, 'http://localhost:8000']),
    ),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    // Vitest replaces every stylesheet with an empty string, `?raw` reads included.
    // `architecture/installShell.test.ts` reads the tokens' own text, so that one file
    // keeps its content; every other stylesheet stays as vitest treats it by default.
    css: { include: [/styles\/tokens\.css/] },
    // `web/e2e/` is Playwright's own suite (`playwright.config.ts`'s `testDir`),
    // run by the `web-e2e` check; vitest's defaults would otherwise also try to
    // run `flow.spec.ts` as a unit test and collide with Playwright's `test`.
    exclude: ['**/node_modules/**', 'e2e/**'],
  },
})
