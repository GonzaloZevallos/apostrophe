import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Bundle } from '../../src/i18n/resolve.ts'

/** Where the app's languages live, one folder per tag. */
export const LOCALES_ROOT = join(import.meta.dirname, '../../src/copy/locales')

/**
 * One language's texts from disk, for node and Playwright (the app reads them with
 * `import.meta.glob`): `<root>/<tag>/*.json` as a bundle keyed by namespace. A language with
 * no folder is an empty bundle; a file that is not valid JSON stops, naming the file.
 */
export function loadBundle(tag: string, root: string = LOCALES_ROOT): Bundle {
  const folder = join(root, tag)
  if (!existsSync(folder)) return {}
  const bundle: Record<string, unknown> = {}
  for (const file of readdirSync(folder).filter((name) => name.endsWith('.json')).sort()) {
    try {
      bundle[file.slice(0, -'.json'.length)] = JSON.parse(readFileSync(join(folder, file), 'utf8'))
    } catch (error) {
      throw new Error(`${join(tag, file)}: not valid JSON (${error instanceof Error ? error.message : 'unreadable'})`)
    }
  }
  return bundle
}
