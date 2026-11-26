import { describe, expect, test } from 'vitest'
import { EMPTY_STATE_KEYS } from '../copy/emptyStates.ts'
import type { Bundle } from '../i18n/resolve.ts'
import { resolveKey } from '../i18n/resolve.ts'
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
  test('an en run forbids exactly the fourteen English wordings of the en bundle', () => {
    const english = forbiddenWhileLoading(EN, EN, 'en')
    expect(english).toHaveLength(Object.values(EMPTY_STATE_KEYS).length)
    expect(english).toHaveLength(14)
    expect(english).toContain('Nobody owes you')
    expect(english).toContain('There is nothing to analyze yet.')
    expect(english).toContain("You haven't recorded any sales in this period yet.")
  })

  test('an en-XA run forbids the English wordings and the fourteen en-XA ones, all distinct', () => {
    const english = forbiddenWhileLoading(EN, EN, 'en')
    const forbidden = forbiddenWhileLoading(EN, XA, 'en-XA')
    expect(forbidden).toHaveLength(28)
    expect(new Set(forbidden).size).toBe(28)
    for (const wording of forbidden) expect(wording).not.toBe('')
    expect(forbidden.slice(0, 14)).toEqual(english)
    forbidden.slice(14).forEach((wording, index) => expect(wording).not.toBe(english[index]))
  })

  test('the run bundle is read only for a tag that is not en', () => {
    expect(forbiddenWhileLoading(EN, {}, 'en')).toHaveLength(14)
    expect(() => forbiddenWhileLoading(EN, {}, 'en-XA')).toThrow()
  })

  test.each([
    ['en', EN, 'No customer matches «'],
    ['en-XA', XA, '⟦Ňö çûšťöṁèř ṁåťçĥèš «'],
  ])('a key with a placeholder forbids the fixed part before it in %s, never a rendered line', (tag, bundle, fixed) => {
    const key = EMPTY_STATE_KEYS.customersNoMatch
    const forbidden = forbiddenWhileLoading(EN, bundle, tag)
    const rendered = resolveKey(bundle, key, { name: 'Zzzzz' }, tag)

    expect(forbidden).toContain(fixed)
    expect(rendered).toContain(fixed)
    expect(forbidden.some((entry) => entry.includes('Zzzzz') || entry.includes('{{'))).toBe(false)
    const others = Object.values(EMPTY_STATE_KEYS).filter((other) => other !== key)
    const wordings = [
      resolveKey(bundle, EMPTY_STATE_KEYS.customersList, undefined, tag),
      ...others.map((other) => resolveKey(bundle, other, undefined, tag)),
      resolveKey(bundle, 'sales:card.noCustomer', undefined, tag),
    ]
    for (const wording of wordings) expect(wording).not.toContain(fixed)
  })

  test('a placeholder that opens its text leaves no fixed part and is refused by name', () => {
    const opening = { ...EN, emptyStates: { ...(EN['emptyStates'] as Record<string, string>), customersNoMatch: '{{q}} matches nobody' } }

    expect(() => forbiddenWhileLoading(opening, opening, 'en')).toThrow(
      'emptyStates:customersNoMatch: a placeholder opens the text, so there is no fixed part to forbid',
    )
  })
})
