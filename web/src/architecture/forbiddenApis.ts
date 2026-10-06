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
 * Plan (Compartir): only `share.ts` names `navigator.share`, so the one place that
 * tells a cancel from a failure, and that never logs, is the only one that can reach
 * the native share sheet.
 *
 * Invariant 7 (ADR-0022): only `api/catalog.ts` names the catalog query key, so every
 * reader shares one set of freshness options.
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
    name: 'navigatorShare',
    pattern: /\bnavigator\s*\??\.\s*share\b|\bnavigator\s*\[\s*(['"])share\1\s*\]/,
    allow: (path) => path === 'src/share.ts',
  },
  // Invariant 7: only `catalogQueryOptions` (`api/catalog.ts`) names the catalog query key.
  {
    name: 'catalogQueryKey',
    pattern: /\bkeys\s*\.\s*catalog\b|\[\s*(['"])catalog\1\s*[,\]]/,
    allow: (path) => path === 'src/api/catalog.ts' || path === 'src/api/keys.ts',
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
