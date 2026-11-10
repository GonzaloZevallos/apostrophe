import { describe, expect, test } from 'vitest'
import { EMPTY_STATE_KEYS } from '../copy/emptyStates.ts'
import type { Bundle } from '../i18n/resolve.ts'
import { forbiddenWhileLoading } from './emptyStates.ts'

const files = import.meta.glob('../copy/locales/{en,en-XA}/*.json', { import: 'default', eager: true }) as Record<
  string,
  unknown
>

function bundleOf(tag: string): Bundle {
  const out: Record<string, unknown> = {}
  for (const [path, content] of Object.entries(files)) {
    const match = /locales\/([^/]+)\/([^/]+)\.json$/.exec(path)
    if (match?.[1] === tag && match[2] !== undefined) out[match[2]] = content
  }
  return out
}

const EN = bundleOf('en')
const XA = bundleOf('en-XA')

describe('forbiddenWhileLoading', () => {
  test('an en run forbids exactly the ten English wordings of the en bundle', () => {
    const english = forbiddenWhileLoading(EN, EN, 'en')
    expect(english).toHaveLength(Object.values(EMPTY_STATE_KEYS).length)
    expect(english).toHaveLength(10)
    expect(english).toContain('Nobody owes you')
    expect(english).toContain('There is nothing to analyze yet.')
    expect(english).toContain("You haven't recorded any sales in this period yet.")
  })

  test('an en-XA run forbids the English wordings and the ten en-XA ones, all distinct', () => {
    const english = forbiddenWhileLoading(EN, EN, 'en')
    const forbidden = forbiddenWhileLoading(EN, XA, 'en-XA')
    expect(forbidden).toHaveLength(20)
    expect(new Set(forbidden).size).toBe(20)
    for (const wording of forbidden) expect(wording).not.toBe('')
    expect(forbidden.slice(0, 10)).toEqual(english)
    forbidden.slice(10).forEach((wording, index) => expect(wording).not.toBe(english[index]))
  })

  test('the run bundle is read only for a tag that is not en', () => {
    expect(forbiddenWhileLoading(EN, {}, 'en')).toHaveLength(10)
    expect(() => forbiddenWhileLoading(EN, {}, 'en-XA')).toThrow()
  })
})
