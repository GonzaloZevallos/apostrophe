/**
 * Transitional: while `copy/refusals.ts` still holds the texts, each of them equals the English
 * of its key. The refusal-readers subtask deletes this file with `copy/refusals.ts`; the
 * permanent proof that English is unchanged is `scripts/i18n/refusals.baseline.test.ts`.
 */

import { describe, expect, test } from 'vitest'
import enRefusals from '../copy/locales/en/refusals.json'
import { REFUSAL_BY_CODE, REFUSAL_TEXT } from '../copy/refusals'
import { isKeyOf } from '../i18n/refusalKeys'
import { resolveKey } from '../i18n/resolve'
import { PIN_REASON_KEY, REFUSAL_KEY, type RefusalCode } from './refusals'

const en = { refusals: enRefusals }

function codesOf(table: Record<string, string>): RefusalCode[] {
  return Object.keys(REFUSAL_KEY).filter((code): code is RefusalCode => Object.hasOwn(table, code))
}

describe('REFUSAL_BY_CODE against the keys', () => {
  test('every code answers in en the text it answers today', () => {
    expect(codesOf(REFUSAL_BY_CODE)).toHaveLength(Object.keys(REFUSAL_KEY).length)
    for (const code of codesOf(REFUSAL_BY_CODE)) {
      expect(resolveKey(en, REFUSAL_KEY[code])).toBe(REFUSAL_BY_CODE[code])
    }
  })
})

describe('REFUSAL_TEXT against the keys', () => {
  test('every plain leaf is the English of the key of the same name', () => {
    const plain = Object.entries(REFUSAL_TEXT).flatMap(([name, text]) => (typeof text === 'string' ? [[name, text]] : []))

    expect(plain.length).toBeGreaterThan(10)
    for (const [name, text] of plain) {
      const leaf = name === 'pinnedGeneric' ? 'generic' : name
      expect(resolveKey(en, `refusals:${leaf}`)).toBe(text)
    }
  })

  test('every pin reason is the English of its key', () => {
    const reasons = Object.entries(PIN_REASON_KEY)

    expect(reasons).toHaveLength(Object.keys(REFUSAL_TEXT.pinReason).length)
    for (const [reason, key] of reasons) {
      if (!isKeyOf(REFUSAL_TEXT.pinReason, reason)) throw new Error('a pin reason with no text')
      expect(resolveKey(en, key)).toBe(REFUSAL_TEXT.pinReason[reason])
    }
  })

  test('every withdrawal text is the English of the key of its code', () => {
    const table: Record<string, string> = REFUSAL_TEXT.withdrawal

    for (const code of codesOf(table)) expect(resolveKey(en, REFUSAL_KEY[code])).toBe(table[code])
    expect(codesOf(table)).toHaveLength(Object.keys(table).length)
  })
})
