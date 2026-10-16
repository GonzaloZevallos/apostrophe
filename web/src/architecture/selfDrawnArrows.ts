/**
 * The scan behind "exactly one ‹ per card" (GH-135, navigation.md, "Chrome and back"): the shell
 * draws a card's back arrow from the registry, so no screen draws one of its own. It reads source
 * text, one line per offence, comments blanked first (newlines kept, so a line number is the
 * file's own):
 *
 * - `variant="back"` on a `Boton` or `BotonLink`;
 * - a literal `‹` (in JSX text or in a string a screen hands to its own arrow);
 * - the `flecha-atras` class.
 *
 * It is a ratchet, not a proof: an arrow drawn through a helper component in another module
 * escapes it. `selfDrawnArrows.test.ts` feeds it the six offenders it ended (as `.txt` fixtures)
 * and a legitimate "Volver a …" action, and runs it over `screens/` against a shrink-only allowlist.
 */

import { withoutComments } from './closingGuards'

const BACK_VARIANT = /<(?:Boton|BotonLink)\b(?:[^>]|=>)*?variant="back"/g
const CHEVRON = /‹/g
const ARROW_CLASS = /flecha-atras/g

function lineOf(text: string, index: number): number {
  return text.slice(0, index).split('\n').length
}

export function findSelfDrawnBackArrows(text: string): string[] {
  const clean = withoutComments(text)
  const found: { line: number; reason: string }[] = []
  for (const match of clean.matchAll(BACK_VARIANT)) {
    found.push({ line: lineOf(clean, match.index), reason: 'a Boton or BotonLink with variant="back"' })
  }
  for (const match of clean.matchAll(CHEVRON)) found.push({ line: lineOf(clean, match.index), reason: 'a literal ‹' })
  for (const match of clean.matchAll(ARROW_CLASS)) {
    found.push({ line: lineOf(clean, match.index), reason: 'the flecha-atras class' })
  }
  return found
    .sort((a, b) => a.line - b.line)
    .map(({ line, reason }) => `line ${line}: draws its own back arrow (${reason}), the shell draws it`)
}
