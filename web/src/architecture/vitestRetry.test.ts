// @vitest-environment node
/**
 * The unit and census suites retry a failed test once in CI and never locally (GH-563,
 * ADR-0040 addendum). `vite.config.ts` sets `test.retry` at the root `test` level, so both
 * projects inherit it through `extends: true`. The real config is imported, never a copy.
 */

import type { UserConfig } from 'vite'
import { afterEach, describe, expect, it, vi } from 'vitest'

async function loadConfig(ci: string | undefined): Promise<UserConfig> {
  vi.resetModules()
  if (ci === undefined) vi.stubEnv('CI', undefined)
  else vi.stubEnv('CI', ci)
  const loaded = await import('../../vite.config')
  return loaded.default
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('the vitest retry', () => {
  it('is 0 when CI is unset, so a local run never retries', async () => {
    const cfg = await loadConfig(undefined)
    expect(cfg.test?.retry).toBe(0)
  })

  it('is exactly 1 when CI is set, so a test that fails twice stays red', async () => {
    const cfg = await loadConfig('true')
    expect(cfg.test?.retry).toBe(1)
  })

  it('is set at the root, never in a project, so unit and census inherit it', async () => {
    const cfg = await loadConfig('true')
    for (const project of cfg.test?.projects ?? []) {
      if (typeof project === 'object' && 'test' in project) {
        expect(project.test?.retry).toBeUndefined()
        expect('extends' in project && project.extends).toBe(true)
      }
    }
  })
})
