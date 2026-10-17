/**
 * What `web/src/mobile-standard/` may not touch: it is the browserless core the Playwright
 * spec imports under `tsconfig.node.json` as well as the app tsconfig, so it takes no DOM
 * types, no React and no `node:` import. Its production modules also take no glob (the
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
const REACT_IMPORT = /(?:from|import)\s*\(?\s*['"]react(?:-dom)?(?:\/[^'"]*)?['"]/
const DOM_TYPE =
  /\b(?:HTMLElement|HTMLInputElement|DOMRect|DOMRectReadOnly|PerformanceObserver|MutationObserver)\b|\b(?:document|window)\./
const GLOB = /import\.meta\.glob/
const ANY = /:\s*any\b|\bas any\b|<any>/

function strip(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line))
    .join('\n')
}

export function importViolations(
  all: Record<string, string>,
): { path: string; rule: 'node' | 'react' | 'dom' | 'glob' | 'any' }[] {
  const out: { path: string; rule: 'node' | 'react' | 'dom' | 'glob' | 'any' }[] = []
  for (const [path, raw] of Object.entries(all)) {
    if (path === OWN_PATH) continue
    const code = strip(raw)
    const isTest = /\.test\.ts$/.test(path)
    if (NODE_IMPORT.test(code)) out.push({ path, rule: 'node' })
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
      './c.ts': 'const el: HTMLElement | null = null',
      './d.ts': "const all = import.meta.glob('./*.json')",
      './e.ts': 'const x: any = 1',
      './f.ts': '// import fs from "node:fs"\nconst fine = 1',
      './g.test.ts': "const all = import.meta.glob('./*.json')",
    }
    expect(importViolations(bad)).toEqual([
      { path: './a.ts', rule: 'node' },
      { path: './b.ts', rule: 'react' },
      { path: './c.ts', rule: 'dom' },
      { path: './d.ts', rule: 'glob' },
      { path: './e.ts', rule: 'any' },
    ])
  })
})
