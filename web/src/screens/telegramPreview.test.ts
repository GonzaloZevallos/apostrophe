/**
 * `telegramPreview` at the domain-of-the-front seam (plan, "Front": "'Cómo se ve en
 * Telegram' is rendered only from `telegramPreview(text)`... pairs `**` from left to
 * right and shows a final unpaired `**` literally"). Pure function, no DOM.
 */

import { expect, test } from 'vitest'
import { telegramPreview } from './telegramPreview'

test('text with no markers is a single plain segment', () => {
  expect(telegramPreview('hola')).toEqual([{ text: 'hola', bold: false }])
})

test('pairs two markers around a bold span', () => {
  expect(telegramPreview('a **b** c')).toEqual([
    { text: 'a ', bold: false },
    { text: 'b', bold: true },
    { text: ' c', bold: false },
  ])
})

test('pairs markers left to right across more than one bold span', () => {
  expect(telegramPreview('a **b** c **d** e')).toEqual([
    { text: 'a ', bold: false },
    { text: 'b', bold: true },
    { text: ' c ', bold: false },
    { text: 'd', bold: true },
    { text: ' e', bold: false },
  ])
})

test('a final unpaired ** shows literally instead of opening an unclosed bold span', () => {
  expect(telegramPreview('a **b** c **d')).toEqual([
    { text: 'a ', bold: false },
    { text: 'b', bold: true },
    { text: ' c **d', bold: false },
  ])
})

test('a lone ** with nothing around it shows literally', () => {
  expect(telegramPreview('**')).toEqual([{ text: '**', bold: false }])
})

test('empty text yields no segments', () => {
  expect(telegramPreview('')).toEqual([])
})
