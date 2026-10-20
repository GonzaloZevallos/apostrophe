/**
 * The Spanish rule over `web/src/copy/` (ADR-0048). Every section is read, none can opt out;
 * each value is rendered (a function entry is called with the
 * `SAMPLES` the limits use), NFC-normalised, trimmed and case-folded, and fails when:
 *
 * - it equals any value of `fixtures/copyBaseline.es.json` (the Spanish the app had, keys
 *   ignored, so a renamed key keeping "Guardar" is caught), unless the section's own
 *   `SAME_IN_BOTH` lists that value with a reason (a word that is the same in both
 *   languages, "Total" for one);
 * - it trips `spanishMarkers.json` (the accented letters and `¿ ¡`, and a closed stoplist of
 *   unambiguous Spanish words), the list the backend guard shares.
 *
 * A violation names the section and the entry, never the text.
 *
 * It is a ratchet, not a proof: an unaccented Spanish word that is in neither list passes,
 * and review owns it (ADR-0048, known risks).
 */

import baselineFile from './fixtures/copyBaseline.es.json'
import markersFile from './spanishMarkers.json'
import { SAMPLES } from '../copy/limits'

export interface SameInBoth {
  value: string
  reason: string
}

/** What a section of `web/src/copy/` exports besides its texts. */
export interface Section {
  SAME_IN_BOTH?: readonly SameInBoth[]
  [name: string]: unknown
}

/** Exports that repeat texts the section already exports, or are not texts. */
const NOT_TEXT = new Set(['SAME_IN_BOTH', 'LIMITED_COPY', 'LONG_REFUSALS'])

/** The arguments a function entry is rendered with: each placeholder at its worst case,
 * flags both ways, a count of one and of many. Every combination is tried up to three
 * parameters; past that, the uniform profiles only. */
const ARGUMENTS: readonly unknown[] = [
  true,
  false,
  SAMPLES.date,
  SAMPLES.amount,
  SAMPLES.negativeAmount,
  SAMPLES.grams,
  SAMPLES.name,
  SAMPLES.count,
  1,
  2,
  99,
]

function combinations(arity: number): unknown[][] {
  if (arity === 0) return [[]]
  if (arity > 3) return ARGUMENTS.map((value) => Array.from({ length: arity }, () => value))
  return combinations(arity - 1).flatMap((head) => ARGUMENTS.map((value) => [...head, value]))
}

function renderFunction(entry: (...args: unknown[]) => unknown): string[] {
  const rendered: string[] = []
  for (const args of combinations(entry.length)) {
    try {
      const result = entry(...args)
      if (typeof result === 'string') rendered.push(result)
    } catch {
      // A function that cannot take these arguments shows nothing for them.
    }
  }
  return rendered
}

function render(entry: unknown, into: string[], depth = 0): void {
  if (typeof entry === 'string') into.push(entry)
  else if (typeof entry === 'function') into.push(...renderFunction(entry as (...args: unknown[]) => unknown))
  else if (depth < 4 && Array.isArray(entry)) for (const item of entry) render(item, into, depth + 1)
  else if (depth < 4 && typeof entry === 'object' && entry !== null) {
    for (const item of Object.values(entry)) render(item, into, depth + 1)
  }
}

/** Case-folded, trimmed, NFC: the form two texts are compared in. */
export function fold(text: string): string {
  return text.normalize('NFC').trim().toLowerCase()
}

/** Every text of a section as shown, folded, with the entry it came from. */
export function renderedEntries(section: Section): { name: string; text: string }[] {
  const entries: { name: string; text: string }[] = []
  for (const [name, entry] of Object.entries(section)) {
    if (NOT_TEXT.has(name)) continue
    const texts: string[] = []
    render(entry, texts)
    for (const text of texts) entries.push({ name, text: fold(text) })
  }
  return entries
}

const BASELINE: ReadonlySet<string> = new Set(Object.values(baselineFile).map(fold))

/** The marker `text` trips (a character or a stoplist word), or `null`. */
export function spanishMarker(text: string): string | null {
  const folded = fold(text)
  for (const character of folded) {
    if (markersFile.characters.includes(character)) return character
  }
  for (const [token] of folded.matchAll(/\p{L}+/gu)) {
    if (markersFile.words.includes(token)) return token
  }
  return null
}

/** The violations of one section, each a sentence naming the section and the entry. Empty
 * when the section is sound. */
export function spanishProblems(path: string, section: Section, baseline: ReadonlySet<string> = BASELINE): string[] {
  const problems: string[] = []
  const allowed = new Map<string, string>()
  for (const { value, reason } of section.SAME_IN_BOTH ?? []) {
    if (reason.trim() === '') problems.push(`${path}: SAME_IN_BOTH lists a value with no reason`)
    allowed.set(fold(value), reason)
  }
  const entries = renderedEntries(section)
  const shown = new Set(entries.map(({ text }) => text))
  for (const value of allowed.keys()) {
    if (!shown.has(value)) problems.push(`${path}: SAME_IN_BOTH lists a value the section does not show`)
    else if (!baseline.has(value)) problems.push(`${path}: SAME_IN_BOTH lists a value that is not in the Spanish baseline`)
  }
  for (const { name, text } of entries) {
    if (baseline.has(text) && !allowed.has(text)) {
      problems.push(`${path}: ${name} equals a Spanish text of the baseline and is not in SAME_IN_BOTH`)
    }
    // The sample name stands for what a seller typed: seller data is never judged.
    const marker = spanishMarker(text.split(fold(SAMPLES.name)).join(' '))
    if (marker !== null) problems.push(`${path}: ${name} trips the Spanish marker "${marker}"`)
  }
  return problems
}
