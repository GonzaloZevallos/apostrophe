/**
 * The old Spanish paths, read from the one file the server redirects from
 * (`app/legacy_front_paths.json`) with `readFileSync`, never through a Vite import: no front
 * code knows them, so a spec that opens one takes it from here instead of writing a literal.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

interface Row {
  old: string
  now: string
}

function isRow(value: unknown): value is Row {
  return (
    typeof value === 'object' &&
    value !== null &&
    'old' in value &&
    'now' in value &&
    typeof value.old === 'string' &&
    typeof value.now === 'string'
  )
}

/** The file writes an id as `{id}`; the registry writes `:id`, which is what `pathTo` fills. */
function asTemplate(path: string): string {
  return path.replace(/\{id\}/g, ':id')
}

function read(): (readonly [old: string, now: string])[] {
  const parsed: unknown = JSON.parse(
    readFileSync(resolve(process.cwd(), '..', 'app/legacy_front_paths.json'), 'utf-8'),
  )
  if (!Array.isArray(parsed) || !parsed.every(isRow)) throw new Error('legacy_front_paths.json: rows of {old, now}')
  return parsed.map((row) => [asTemplate(row.old), asTemplate(row.now)] as const)
}

/** Every old path and the route it moved to, as templates `pathTo` fills (`/…/:id`). */
export const LEGACY_REDIRECTS: readonly (readonly [old: string, now: string])[] = read()

/** The old path that redirects to `now` (a registry template such as `/more`, or `/sales/:id`). */
export function legacyFor(now: string): string {
  const row = LEGACY_REDIRECTS.find(([, target]) => target === now)
  if (row === undefined) throw new Error(`no legacy row redirects to ${now}`)
  return row[0]
}
