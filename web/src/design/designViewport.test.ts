import { describe, expect, it } from 'vitest'
import { assertScreens, PHONE, viewportsOf } from '../../../scripts/design/screens.mjs'
import screens from '../../../scripts/design/screens.json'

type Row = { screen: string; viewport?: number[]; design_viewport?: number[] }
const rows = screens.screens as Row[]

describe('viewportsOf', () => {
  it('gives the built side viewport ?? PHONE on every registry row', () => {
    for (const row of rows) {
      expect(viewportsOf(row).built, row.screen).toEqual(row.viewport ?? PHONE)
    }
  })

  it('gives the design side the built size on every row without a design_viewport', () => {
    for (const row of rows.filter((r) => r.design_viewport === undefined)) {
      expect(viewportsOf(row).design, row.screen).toEqual(viewportsOf(row).built)
    }
  })

  it('gives the design side design_viewport, and the built side its own viewport, when both are set', () => {
    const row = { screen: 'X', viewport: [320, 844], design_viewport: [414, 844] }
    expect(viewportsOf(row)).toEqual({ design: [414, 844], built: [320, 844] })
  })

  it('falls back to the phone when a row names no viewport at all', () => {
    expect(viewportsOf({ screen: 'X' })).toEqual({ design: PHONE, built: PHONE })
    expect(viewportsOf({ screen: 'X', design_viewport: [414, 844] })).toEqual({ design: [414, 844], built: PHONE })
  })
})

describe('assertScreens design_viewport', () => {
  it('accepts two positive integers', () => {
    expect(() => assertScreens([{ screen: 'Inicio', design_viewport: [414, 844] }])).not.toThrow()
  })

  it.each([
    ['one number', [414]],
    ['three numbers', [414, 844, 1]],
    ['zero', [0, 844]],
    ['a negative', [414, -844]],
    ['a non-integer', [414.5, 844]],
    ['a string', '414x844'],
    ['a string inside', ['414', 844]],
  ])('refuses %s', (_name, value) => {
    expect(() => assertScreens([{ screen: 'Inicio', design_viewport: value }])).toThrow(
      /^Inicio: design_viewport must be two positive integers, width and height$/,
    )
  })
})
