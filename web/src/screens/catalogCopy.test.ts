/**
 * `plainCopy` at its pure seam (plan, "Copy and Share hand out the catalog without paired
 * `**`"): what Copiar writes and Compartir hands out is the API's text with every paired
 * `**` removed and every line break kept. Every expected value is a hand-written literal:
 * never computed with `plainCopy` or `telegramPreview` (plan, invariants).
 */

import { expect, test } from 'vitest'
import { plainCopy } from './catalogCopy'

test('a catalog-shaped text loses its paired markers and keeps every line break', () => {
  const apiText =
    '🌿 Catálogo de **La Huerta** 🌿\n\n' +
    '👑 **Sir Jack**\n• 30% indica / 70% sativa\n• Aroma/flavor: incienso, madera y limón\n• Price per gram: $14.000\n• From 10 g: $13.000 each\n\n' +
    '🥇 **24K Gold**\n• Price per gram: $11.000\n\n' +
    '📩 Pedidos por privado.'

  expect(plainCopy(apiText)).toBe(
    '🌿 Catálogo de La Huerta 🌿\n\n' +
      '👑 Sir Jack\n• 30% indica / 70% sativa\n• Aroma/flavor: incienso, madera y limón\n• Price per gram: $14.000\n• From 10 g: $13.000 each\n\n' +
      '🥇 24K Gold\n• Price per gram: $11.000\n\n' +
      '📩 Pedidos por privado.',
  )
})

test('an empty pair leaves nothing behind', () => {
  expect(plainCopy('****')).toBe('')
})

test('an unpaired final marker stays as typed', () => {
  expect(plainCopy('a**b**c**')).toBe('abc**')
})

test('a pair that spans a blank line loses its markers and keeps the blank line', () => {
  expect(plainCopy('x**a\n\nb**y')).toBe('xa\n\nby')
})

test('a text with no markers comes back unchanged', () => {
  expect(plainCopy('line one\nline two\n\nline three')).toBe('line one\nline two\n\nline three')
})

test('a seller-typed tag or ampersand comes back as typed', () => {
  expect(plainCopy('**Fish** <b>& chips</b> a < b')).toBe('Fish <b>& chips</b> a < b')
})

test('the empty text stays empty', () => {
  expect(plainCopy('')).toBe('')
})
