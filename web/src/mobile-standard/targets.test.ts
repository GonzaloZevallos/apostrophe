import { describe, expect, test } from 'vitest'
import { nameTargets, shorten, type RawTarget } from './targets.ts'

const cell = { screen: 'Ventas', size: '375x812', theme: 'claro' } as const
const raw = (over: Partial<RawTarget>): RawTarget => ({ testid: '', role: 'button', label: 'x', identity: '', ...over })
const named = (items: (RawTarget | null)[]) =>
  nameTargets(items.map((r) => ({ rule: r === null ? 'h-scroll' : 'contrast', raw: r })), cell).map((v) => v.target)

describe('nameTargets', () => {
  test('a testid names the element, else its role and label with digits as #, cut to 60', () => {
    expect(named([raw({ testid: 'fila-3' })])).toEqual(['fila-#'])
    expect(named([raw({ role: 'p', label: '$ 999.999.999' })])).toEqual(['p:$ #.#.#'])
    expect(shorten('a'.repeat(80))).toHaveLength(60)
  })

  test('a page rule has no target', () => {
    expect(named([null])).toEqual([''])
  })

  test('a repeated target takes its identity, then a position when still repeated', () => {
    expect(named([raw({ identity: 'uno' }), raw({ identity: 'dos' })])).toEqual(['button:x@uno', 'button:x@dos'])
    expect(named([raw({}), raw({})])).toEqual(['button:x[1]', 'button:x[2]'])
    expect(named([raw({ label: 'solo' }), raw({ identity: 'fila' }), raw({ identity: 'fila' })])).toEqual([
      'button:solo',
      'button:x@fila[1]',
      'button:x@fila[2]',
    ])
  })
})
