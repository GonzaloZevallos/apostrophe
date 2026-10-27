/**
 * What `web/src/mobile-standard/` may not touch: it is the browserless core the Playwright
 * spec imports under `tsconfig.node.json` as well as the app tsconfig, so it takes no DOM
 * types, no React, no `node:` import and nothing from `web/scripts/` (a bundle read from disk is
 * passed in by `e2e/`). Its production modules also take no glob (the
 * offender table is one static JSON import per rule) and no `any`.
 */

import { describe, expect, test } from 'vitest'

const files = import.meta.glob('./**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const OWN_PATH = './imports.test.ts'

const NODE_IMPORT = /(?:from|import)\s*\(?\s*['"]node:/
const REACT_IMPORT = /(?:from|import)\s*\(?\s*['"]react(?:-[\w-]+)?(?:\/[^'"]*)?['"]/
const DOM_TYPE =
  /\b(?:HTMLElement|HTMLInputElement|DOMRect|DOMRectReadOnly|PerformanceObserver|MutationObserver)\b|\b(?:document|window)\./
const SPECIFIER = /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g
const GLOB = /import\.meta\.glob/
const ANY = /(?:[:<,|&]|\bas|=>)\s*any\b/

const SLASH = '\u002f'

type Rule = 'node' | 'react' | 'dom' | 'glob' | 'any' | 'scripts'

/** `a/b/../c` as `a/c`; a leading `..` is kept. */
function normalize(path: string): string {
  const out: string[] = []
  for (const part of path.split(SLASH)) {
    if (part === '' || part === '.') continue
    if (part === '..' && out.length > 0 && out[out.length - 1] !== '..') out.pop()
    else out.push(part)
  }
  return out.join(SLASH)
}

/** Whether a relative import from `path` (a file of this folder) lands in `web/scripts/`. */
function importsWebScripts(path: string, code: string): boolean {
  const folder = path.split(SLASH).slice(0, -1).join(SLASH)
  return [...code.matchAll(SPECIFIER)].some((match) => {
    const specifier = match[1] ?? ''
    return specifier.startsWith('.') && normalize([folder, specifier].join(SLASH)).startsWith('../../scripts/')
  })
}

function strip(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line))
    .join('\n')
}

export function importViolations(
  all: Record<string, string>,
): { path: string; rule: Rule }[] {
  const out: { path: string; rule: Rule }[] = []
  for (const [path, raw] of Object.entries(all)) {
    if (path === OWN_PATH) continue
    const code = strip(raw)
    const isTest = /\.test\.ts$/.test(path)
    if (NODE_IMPORT.test(code)) out.push({ path, rule: 'node' })
    if (importsWebScripts(path, code)) out.push({ path, rule: 'scripts' })
    if (REACT_IMPORT.test(code)) out.push({ path, rule: 'react' })
    if (DOM_TYPE.test(code)) out.push({ path, rule: 'dom' })
    if (!isTest && GLOB.test(code)) out.push({ path, rule: 'glob' })
    if (!isTest && ANY.test(code)) out.push({ path, rule: 'any' })
  }
  return out
}

describe('the mobile-standard folder', () => {
  test('its modules and guards import no node:, React or DOM type, and its modules no glob or any', () => {
    expect(Object.keys(files).length).toBeGreaterThan(8)
    expect(importViolations(files)).toEqual([])
  })

  test('the scan rejects each forbidden import, DOM type, glob and any', () => {
    const bad = {
      './a.ts': "import { readFileSync } from 'node:fs'",
      './b.ts': "import { useState } from 'react'",
      './b2.ts': "import { createBrowserRouter } from 'react-router'",
      './b3.ts': "import type { RouteObject } from 'react-router/dom'",
      './e2.ts': 'const xs: Record<string, any> = {}',
      './c.ts': 'const el: HTMLElement | null = null',
      './d.ts': "const all = import.meta.glob('./*.json')",
      './e.ts': 'const x: any = 1',
      './f.ts': '// import fs from "node:fs"\nconst fine = 1',
      './g.test.ts': "const all = import.meta.glob('./*.json')",
      './h.ts': "import { loadBundle } from '../../scripts/i18n/loadBundle.ts'",
      './sub/i.ts': "import { loadBundle } from '../../../scripts/i18n/loadBundle.ts'",
      './j.ts': "import registry from '../../../scripts/design/screens.json' with { type: 'json' }",
    }
    expect(importViolations(bad)).toEqual([
      { path: './a.ts', rule: 'node' },
      { path: './b.ts', rule: 'react' },
      { path: './b2.ts', rule: 'react' },
      { path: './b3.ts', rule: 'react' },
      { path: './e2.ts', rule: 'any' },
      { path: './c.ts', rule: 'dom' },
      { path: './d.ts', rule: 'glob' },
      { path: './e.ts', rule: 'any' },
      { path: './h.ts', rule: 'scripts' },
      { path: './sub/i.ts', rule: 'scripts' },
    ])
  })
})
