import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseColor, ratio, type Rgb } from '../mobile-standard/contrast.ts'

const css = readFileSync(resolve(__dirname, 'tokens.css'), 'utf8')
const darkStart = css.indexOf(":root[data-tema='oscuro'] {")
const themes = {
  claro: css.slice(css.indexOf(':root {'), darkStart),
  oscuro: css.slice(darkStart),
}
const FILLS = ['--grafico1', '--grafico2', '--grafico3', '--grafico4', '--grafico5']

function declared(block: string, token: string): string {
  const match = new RegExp(`^\\s*${token}: (#[0-9a-fA-F]{6});`, 'm').exec(block)
  if (match?.[1] === undefined) throw new Error(`${token} is not a literal #rrggbb in the block`)
  return match[1]
}

function colour(block: string, token: string): Rgb {
  return parseColor(declared(block, token))
}

describe.each(Object.entries(themes))('chart tokens, tema %s', (_theme, block) => {
  it('declares the background and the five fills as opaque literals', () => {
    expect('a' in colour(block, '--fondo-grafico')).toBe(false)
    for (const fill of FILLS) expect(declared(block, fill)).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it.each(FILLS)('%s reaches 3:1 against --fondo-grafico', (fill) => {
    expect(ratio(colour(block, fill), colour(block, '--fondo-grafico'))).toBeGreaterThanOrEqual(3)
  })
})

describe('the token reader', () => {
  it('refuses a token that is not a literal hex', () => {
    expect(() => declared('  --grafico1: var(--acento);', '--grafico1')).toThrow(
      '--grafico1 is not a literal #rrggbb in the block',
    )
  })
})
