import { expect, test } from 'vitest'
import snapshot from '../../../tests/fixtures/openapi_snapshot.json'
import { CUSTOMER_TYPE_ICONS, glyphOf } from './icons'

const ENUM: string[] = snapshot.components.schemas.CustomerTypeIcon.enum

function sameSet(left: string[], right: string[]): boolean {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort())
}

test('the icon map has exactly the keys of the API enum, each with a glyph and a name', () => {
  expect(sameSet(Object.keys(CUSTOMER_TYPE_ICONS), ENUM)).toBe(true)
  for (const { glyph, name } of Object.values(CUSTOMER_TYPE_ICONS)) {
    expect(glyph).not.toBe('')
    expect(name).not.toBe('')
  }
  expect(glyphOf('star')).toBe(CUSTOMER_TYPE_ICONS.star.glyph)
})

test('the comparison rejects a map missing a key or holding an extra one', () => {
  const keysOfMap = Object.keys(CUSTOMER_TYPE_ICONS)
  expect(sameSet(keysOfMap.filter((icon) => icon !== 'bell'), ENUM)).toBe(false)
  expect(sameSet([...keysOfMap, 'flame'], ENUM)).toBe(false)
})
