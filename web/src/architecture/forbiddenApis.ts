/**
 * Section 9 holds in the browser too (plan, invariants): no module but
 * `api/client.ts` calls `fetch`, nothing calls `XMLHttpRequest`, and nothing touches
 * `console`, `localStorage`, `sessionStorage`, `indexedDB` or the Cache API. The
 * service worker carries none of these either, and has no `fetch` handler.
 *
 * ADR-0026: only `theme.ts` names `localStorage`, for the one `tema=oscuro` entry.
 *
 * Plan ("Clipboard over plain http"): only `clipboard.ts` names
 * `navigator.clipboard` or `execCommand`, so the home network's plain-http
 * fallback stays in the one module that tests it.
 *
 * Plan (invariants): only `components/useLeaveGuard.ts` names `useBlocker`, so every form
 * or sheet asks its leave question through the one guard.
 *
 * ADR-0063: only `shell/ScrollSync.tsx`, `shell/scrollPlaces.ts`, `shell/scrollFollow.ts` and
 * `components/useReturnToPlace.ts` move the document's scroll or set `history.scrollRestoration`,
 * so the scroll on a change of screen is decided in one place. In-page scrolling of an element
 * (`element.scrollIntoView`) is not the document's and stays allowed.
 *
 * Walks a list of source files handed to it, rather than the filesystem itself, so a
 * test can feed it a fixture that must fail, not only the files that already pass.
 */

export interface SourceFile {
  path: string
  content: string
}

export interface Violation {
  path: string
  rule: string
}

interface Rule {
  name: string
  pattern: RegExp
  allow?: (path: string) => boolean
}

/** The files ADR-0063 lets move the document's scroll. */
const SCROLL_OWNERS: readonly string[] = [
  'src/shell/ScrollSync.tsx',
  'src/shell/scrollPlaces.ts',
  'src/shell/scrollFollow.ts',
  'src/components/useReturnToPlace.ts',
]

const RULES: Rule[] = [
  { name: 'fetch', pattern: /\bfetch\s*\(/, allow: (path) => path.endsWith('api/client.ts') },
  { name: 'XMLHttpRequest', pattern: /\bXMLHttpRequest\b/ },
  { name: 'console', pattern: /\bconsole\s*\./ },
  {
    name: 'localStorage',
    pattern: /\blocalStorage\b/,
    allow: (path) => path === 'src/theme.ts',
  },
  { name: 'sessionStorage', pattern: /\bsessionStorage\b/ },
  { name: 'indexedDB', pattern: /\bindexedDB\b/ },
  { name: 'CacheStorage', pattern: /\bcaches\s*\./ },
  { name: 'fetchHandler', pattern: /addEventListener\(\s*['"]fetch['"]/ },
  {
    name: 'navigatorClipboard',
    pattern: /\bnavigator\s*\??\.\s*clipboard\b|\bnavigator\s*\[\s*(['"])clipboard\1\s*\]/,
    allow: (path) => path === 'src/clipboard.ts',
  },
  {
    name: 'useBlocker',
    pattern: /\buseBlocker\b/,
    allow: (path) => path === 'src/components/useLeaveGuard.ts',
  },
  {
    name: 'documentScroll',
    pattern: new RegExp(
      [
        // window.scrollTo(…), globalThis?.scrollBy(…), document['scroll'](…)
        String.raw`\b(?:window|globalThis|document)\s*(?:\??\.\s*|\[\s*['"])(?:scrollTo|scrollBy|scroll)['"]?\s*\]?\s*\(`,
        // document.documentElement.scrollTop = …, body.scrollLeft += …, document.scrollingElement.scrollTop = …
        String.raw`\b(?:documentElement|body|scrollingElement)\s*\??\.\s*scroll(?:Top|Left)\s*(?:[-+*/]?=(?!=))`,
        // history.scrollRestoration, read or written
        String.raw`\bhistory\s*\??\.\s*scrollRestoration\b`,
      ].join('|'),
    ),
    allow: (path) => SCROLL_OWNERS.includes(path),
  },
  {
    name: 'execCommand',
    pattern: /\bexecCommand\s*\(/,
    allow: (path) => path === 'src/clipboard.ts',
  },
]

export function findForbiddenUsages(files: SourceFile[]): Violation[] {
  const violations: Violation[] = []
  for (const file of files) {
    for (const rule of RULES) {
      if (!rule.pattern.test(file.content)) continue
      if (rule.allow?.(file.path) === true) continue
      violations.push({ path: file.path, rule: rule.name })
    }
  }
  return violations
}
