/**
 * Home shows no first-use notice (registro-unificado.md), so it must never read the two
 * setup endpoints again: `GET /first-run` (`api/firstRun`) and `GET /onboarding-progress`
 * (`api/onboarding`). The one rule here, as a scan over source files:
 *
 *   1. `screens/Inicio.tsx` and everything under `screens/inicio/` import neither module;
 *   2. outside `api/`, `api/firstRun` has exactly two named readers, the Shell (the "+ New sale"
 *      side rule) and Products (the "Send catalog" side rule).
 *
 * Tests and this folder are not scanned: they name the modules to fake or to check them.
 */

export interface Source {
  path: string
  content: string
}

/** The only product files that may import `api/firstRun`. */
export const FIRST_RUN_READERS = ['src/shell/Shell.tsx', 'src/screens/Variedades.tsx']

const SETUP_MODULE = /(?:from\s+|import\s*\(\s*)['"][^'"]*\/api\/(firstRun|onboarding)['"]/g

function isHome(path: string): boolean {
  return path === 'src/screens/Inicio.tsx' || path.startsWith('src/screens/inicio/')
}

function isProduct(path: string): boolean {
  return !/\.test\.tsx?$/.test(path) && !path.startsWith('src/architecture/') && !path.startsWith('src/api/')
}

function importsOf(content: string): { module: string; line: number }[] {
  return [...content.matchAll(SETUP_MODULE)].map((match) => ({
    module: match[1] ?? '',
    line: content.slice(0, match.index).split('\n').length,
  }))
}

/** One line per offence, `path:line: reason`. */
export function findHomeFirstRunImports(files: Source[]): string[] {
  const out: string[] = []
  for (const { path, content } of files) {
    if (!isProduct(path)) continue
    for (const { module, line } of importsOf(content)) {
      if (isHome(path)) out.push(`${path}:${line}: Home imports api/${module}, but shows no first-use notice`)
      else if (module === 'firstRun' && !FIRST_RUN_READERS.includes(path)) {
        out.push(`${path}:${line}: api/firstRun is read only by ${FIRST_RUN_READERS.join(' and ')}`)
      }
    }
  }
  return out
}
