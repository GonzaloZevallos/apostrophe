// @vitest-environment node
/**
 * The shape of the e2e run (GH-251, ADR-0040 amendment): one Playwright phase, every spec
 * in exactly one project, the browser zone and locale pinned once, and the evidence of a
 * red run written to a directory the config reads from `PLAYWRIGHT_OUTPUT_DIR`.
 *
 * The real `playwright.config.ts` is imported, and the patterns tested are the `RegExp`s it
 * holds, never a copy of them. Nothing here spawns Playwright.
 */

import { readdirSync } from 'node:fs'
import * as path from 'node:path'
import type { PlaywrightTestConfig } from '@playwright/test'
import { afterEach, describe, expect, it, vi } from 'vitest'
import config from '../../playwright.config'

// Vitest runs with `web/` as its root (`npm --prefix web test`).
const E2E_DIR = path.join(process.cwd(), 'e2e')
const OUTPUT_DIR_VARIABLE = 'PLAYWRIGHT_OUTPUT_DIR'
const DEFAULT_OUTPUT_DIR = 'test-results/local'

type Project = NonNullable<PlaywrightTestConfig['projects']>[number]
type Pattern = NonNullable<Project['testMatch']>

/** The `RegExp`s of a `testMatch`/`testIgnore` value; anything else is returned as `bad`. */
function patternsOf(value: Pattern | undefined): { regexps: RegExp[]; bad: unknown[] } {
  if (value === undefined) return { regexps: [], bad: [] }
  const items: unknown[] = Array.isArray(value) ? value : [value]
  return {
    regexps: items.filter((item): item is RegExp => item instanceof RegExp),
    bad: items.filter((item) => !(item instanceof RegExp)),
  }
}

/** The projects of `cfg` that would run `specFile`, by the config's own patterns. */
function projectsRunning(cfg: PlaywrightTestConfig, specFile: string): string[] {
  return (cfg.projects ?? [])
    .filter((project) => {
      const match = patternsOf(project.testMatch)
      const ignore = patternsOf(project.testIgnore)
      const matched = match.regexps.length === 0 || match.regexps.some((re) => re.test(specFile))
      const ignored = ignore.regexps.some((re) => re.test(specFile))
      return matched && !ignored
    })
    .map((project) => project.name ?? '')
}

function specFiles(): string[] {
  return readdirSync(E2E_DIR).filter((name) => name.endsWith('.spec.ts'))
}

async function loadConfig(outputDir: string | undefined): Promise<PlaywrightTestConfig> {
  vi.resetModules()
  if (outputDir === undefined) vi.stubEnv(OUTPUT_DIR_VARIABLE, undefined)
  else vi.stubEnv(OUTPUT_DIR_VARIABLE, outputDir)
  const loaded = await import('../../playwright.config')
  return loaded.default
}

function junitPathOf(cfg: PlaywrightTestConfig): unknown {
  const reporters = Array.isArray(cfg.reporter) ? cfg.reporter : []
  const junit = reporters.find((entry) => Array.isArray(entry) && entry[0] === 'junit')
  if (!Array.isArray(junit)) return undefined
  const options: unknown = junit[1]
  if (typeof options !== 'object' || options === null) return undefined
  return 'outputFile' in options ? options.outputFile : undefined
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('the projects of the e2e run', () => {
  it('has no timed project: the run is one phase', () => {
    const names = (config.projects ?? []).map((project) => project.name)
    expect(names).not.toContain('timed')
    // The phone check's two projects (GH-80) run in the same single phase.
    expect(names).toEqual(['secure-origin', 'insecure-origin', 'mobile-setup', 'mobile'])
  })

  it('selects specs only with RegExp values taken from the config', () => {
    for (const project of config.projects ?? []) {
      expect(patternsOf(project.testMatch).bad).toEqual([])
      expect(patternsOf(project.testIgnore).bad).toEqual([])
    }
  })

  it('puts every spec file in exactly one project', () => {
    const files = specFiles()
    expect(files.length).toBeGreaterThan(20)
    const misplaced = files
      .map((file) => ({ file, projects: projectsRunning(config, file) }))
      .filter(({ projects }) => projects.length !== 1)
    expect(misplaced).toEqual([])
  })

  it('runs sales.spec.ts in secure-origin and the insecure-origin spec in its own project', () => {
    expect(projectsRunning(config, 'sales.spec.ts')).toEqual(['secure-origin'])
    expect(projectsRunning(config, 'catalogInsecureOrigin.spec.ts')).toEqual(['insecure-origin'])
  })

  it('rejects a config that keeps a spec out of every project, or in two', () => {
    const none = { projects: [{ name: 'a', testMatch: /^nothing$/ }] }
    const twice = { projects: [{ name: 'a' }, { name: 'b' }] }
    expect(projectsRunning(none, 'sales.spec.ts')).toEqual([])
    expect(projectsRunning(twice, 'sales.spec.ts')).toEqual(['a', 'b'])
  })

  it('names a pattern that is not a RegExp instead of trusting it', () => {
    expect(patternsOf('sales.spec.ts' as Pattern).bad).toEqual(['sales.spec.ts'])
    expect(patternsOf([/a/, 'b'] as Pattern).bad).toEqual(['b'])
  })

  it('pins the browser zone and locale once, in the top-level use', () => {
    expect(config.use?.timezoneId).toBe('America/Argentina/Buenos_Aires')
    expect(config.use?.locale).toBe('es-AR')
    for (const project of config.projects ?? []) {
      expect(project.use?.timezoneId).toBeUndefined()
      expect(project.use?.locale).toBeUndefined()
    }
  })

  it('keeps a trace and a screenshot of a failing test only', () => {
    expect(config.use?.trace).toBe('retain-on-failure')
    expect(config.use?.screenshot).toBe('only-on-failure')
  })

  it('keeps the load settings: three workers, no retries', () => {
    expect(config.workers).toBe(3)
    expect(config.retries).toBe(0)
  })
})

describe('where a run leaves its evidence', () => {
  it('uses the fixed default directory when PLAYWRIGHT_OUTPUT_DIR is unset', async () => {
    const cfg = await loadConfig(undefined)
    expect(cfg.outputDir).toBe(DEFAULT_OUTPUT_DIR)
    expect(junitPathOf(cfg)).toBe(`${DEFAULT_OUTPUT_DIR}/junit.xml`)
  })

  it('uses PLAYWRIGHT_OUTPUT_DIR for the output and the junit file when it is set', async () => {
    const cfg = await loadConfig('test-results/abc1234-20261016T120000Z')
    expect(cfg.outputDir).toBe('test-results/abc1234-20261016T120000Z')
    expect(junitPathOf(cfg)).toBe('test-results/abc1234-20261016T120000Z/junit.xml')
  })

  it('keeps the list reporter beside the junit one', async () => {
    const cfg = await loadConfig(undefined)
    const names = (Array.isArray(cfg.reporter) ? cfg.reporter : []).map((entry) =>
      Array.isArray(entry) ? entry[0] : entry,
    )
    expect(names).toEqual(['list', 'junit'])
  })
})
