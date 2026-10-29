import { afterEach, describe, expect, it } from 'vitest'
import {
  assertNoEnglishMisses,
  clearMissingKeys,
  missingKeyHandler,
  missingKeys,
} from './missingKeys'

afterEach(clearMissingKeys)

describe('missingKeys', () => {
  it('records the language, namespace and key, and nothing else', () => {
    missingKeyHandler(['de'], 'sales', 'receipt.title', 'Tom & Jerry fallback', false, {
      name: 'Ana Pérez',
    })

    expect(missingKeys()).toEqual([{ language: 'de', ns: 'sales', key: 'receipt.title' }])
    expect(Object.keys(missingKeys()[0] ?? {}).sort()).toEqual(['key', 'language', 'ns'])
    expect(JSON.stringify(missingKeys())).not.toContain('Ana')
    expect(JSON.stringify(missingKeys())).not.toContain('Tom')
  })

  it('clears what was recorded and hands out no handle on the store', () => {
    missingKeyHandler(['en'], 'a', 'b', '', false, {})
    const snapshot = missingKeys()
    clearMissingKeys()

    expect(missingKeys()).toEqual([])
    expect(snapshot).toHaveLength(1)
  })

  it('passes when only a real language missed a key', () => {
    missingKeyHandler(['de'], 'sales', 'x', '', false, {})

    expect(() => assertNoEnglishMisses(missingKeys())).not.toThrow()
  })

  it('rejects an English miss, naming the key and nothing of the text', () => {
    missingKeyHandler(['en'], 'sales', 'receipt.title', 'rendered words', false, {})

    expect(() => assertNoEnglishMisses(missingKeys())).toThrow(/sales:receipt\.title/)
    expect(() => assertNoEnglishMisses(missingKeys())).not.toThrow(/rendered words/)
  })
})
