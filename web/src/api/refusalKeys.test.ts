import { describe, expect, test } from 'vitest'
import enRefusals from '../copy/locales/en/refusals.json'
import pseudoRefusals from '../copy/locales/en-XA/refusals.json'
import refusalKeys from '../copy/refusalKeys.json'
import { resolveKey } from '../i18n/resolve'
import contract from './contract.json'
import { PIN_REASON_KEY, REFUSAL_KEY, type PinReason, type RefusalCode } from './refusals'

const codes = Object.keys(contract.refusalCodes)
const en = { refusals: enRefusals }
const pseudo = { refusals: pseudoRefusals }

describe('refusalKeys.json', () => {
  test('lists exactly the codes of contract.json', () => {
    expect(Object.keys(refusalKeys).sort()).toEqual([...codes].sort())
    expect(Object.keys(REFUSAL_KEY).sort()).toEqual([...codes].sort())
  })

  test.each(Object.entries(refusalKeys))('%s resolves to a non-empty string in en and en-XA', (_code, key) => {
    for (const bundle of [en, pseudo]) {
      const text = resolveKey(bundle, key)
      expect(typeof text).toBe('string')
      expect(text).not.toBe('')
    }
  })

  test('maps every gone code to the gone notice, but the withdrawal line that has words of its own', () => {
    const goneCodes = Object.entries(contract.refusalCodes).filter(
      ([code, { kind }]) => kind === 'gone' && code !== 'stock.withdrawal_variety_not_found',
    )

    expect(goneCodes.length).toBeGreaterThan(10)
    for (const [code] of goneCodes) expect(refusalKeys).toHaveProperty([code], 'refusals:goneNotice')
  })
})

describe('refusals.json', () => {
  test.each([
    ['en', enRefusals],
    ['en-XA', pseudoRefusals],
  ])('%s: no leaf has a dot or is a contract code', (_tag, bundle) => {
    for (const leaf of Object.keys(bundle)) {
      expect(leaf).not.toContain('.')
      expect(codes).not.toContain(leaf)
    }
  })

  test('en-XA holds exactly the leaves of en', () => {
    expect(Object.keys(pseudoRefusals).sort()).toEqual(Object.keys(enRefusals).sort())
  })
})

describe('PIN_REASON_KEY', () => {
  test.each([
    ['too_long', 'pinned_catalog.too_long'],
    ['telegram_unreachable', 'pinned_catalog.telegram_unreachable'],
    ['bot_cannot_post', 'pinned_catalog.bot_cannot_post'],
  ] satisfies [PinReason, RefusalCode][])('%s equals the key of its code', (reason, code) => {
    expect(PIN_REASON_KEY[reason]).toBe(REFUSAL_KEY[code])
  })

  test('resolves every reason in en', () => {
    for (const key of Object.values(PIN_REASON_KEY)) expect(resolveKey(en, key)).not.toBe('')
  })
})
