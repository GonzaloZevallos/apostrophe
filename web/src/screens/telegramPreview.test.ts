/**
 * `telegramPreview` at the domain-of-the-front seam (plan, "Front": "'Cómo se ve en
 * Telegram' is rendered only from `telegramPreview(text)`... pairs `**` from left to
 * right and shows a final unpaired `**` literally"). Pure function, no DOM.
 *
 * `telegramPreview.cases.json` is the one fixture shared with the backend's own
 * `tests/pinned_catalog/test_bold.py` (the plan's subtask brief): the same left-to-right
 * pairing, read here as `(plain, spans)` built back from the preview's segments, so the
 * in-app preview and what Telegram bolds can never drift apart (ADR-0021;
 * ADR-0022).
 */

import { expect, test } from 'vitest'
import cases from './telegramPreview.cases.json'
import { telegramPreview } from './telegramPreview'

function utf16Length(text: string): number {
  // `TextEncoder` encodes UTF-16 strings to UTF-8; code-unit length is `text.length`
  // itself in JavaScript, since strings are already sequences of UTF-16 code units.
  return text.length
}

function toPlainAndSpans(text: string): { plain: string; spans: [number, number][] } {
  let plain = ''
  const spans: [number, number][] = []
  for (const segment of telegramPreview(text)) {
    if (segment.bold) {
      spans.push([utf16Length(plain), utf16Length(segment.text)])
    }
    plain += segment.text
  }
  return { plain, spans }
}

test.each(cases)('pairs markers left to right: %j', (testCase) => {
  const { plain, spans } = toPlainAndSpans(testCase.input)

  expect(plain).toEqual(testCase.plain)
  expect(spans).toEqual(testCase.spans)
})

test('text with no markers is a single plain segment', () => {
  expect(telegramPreview('hola')).toEqual([{ text: 'hola', bold: false }])
})

test('a lone ** with nothing around it shows literally', () => {
  expect(telegramPreview('**')).toEqual([{ text: '**', bold: false }])
})

test('empty text yields no segments', () => {
  expect(telegramPreview('')).toEqual([])
})
