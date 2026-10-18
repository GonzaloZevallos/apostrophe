import { describe, expect, test } from 'vitest'
import { checkNoticeCap, NOTICE_CAP, NOTICE_CAP_MEDIA } from './noticeCap'

const fixtures = import.meta.glob('/src/architecture/fixtures/noticeCap/*.txt', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

function fixture(name: string): string {
  const content = fixtures[`/src/architecture/fixtures/noticeCap/${name}.txt`]
  if (content === undefined) throw new Error(`fixture ${name} was not loaded`)
  return content
}

/** The one failure each refused fixture is written to trigger, by a phrase of its message. */
const REFUSED: ReadonlyArray<readonly [string, string]> = [
  ['cap_missing', 'no max-width'],
  ['cap_in_comment', 'no max-width'],
  ['cap_descendant_only', 'no max-width'],
  ['cap_top_level', 'must sit directly inside'],
  ['cap_media_600', 'must sit directly inside'],
  ['cap_max_width_media', 'must sit directly inside'],
  ['cap_second_in_group', 'exactly one is allowed'],
  ['cap_comma_group_only', 'rule alone'],
  ['cap_in_is', 'rule alone'],
  ['cap_in_is_bare', 'rule alone'],
  ['cap_pseudo', 'rule alone'],
  ['cap_ancestor', 'rule alone'],
  ['cap_wrong_value', 'value of'],
]

describe('checkNoticeCap', () => {
  test.each(['shipped', 'shipped_with_descendant', 'apostrophe_in_comment'])(
    'accepts %s',
    (name) => {
      expect(checkNoticeCap(fixture(name))).toEqual([])
    },
  )

  test.each(REFUSED)('refuses %s with one finding: %s', (name, phrase) => {
    const findings = checkNoticeCap(fixture(name))
    expect(findings).toHaveLength(1)
    expect(findings[0]).toContain(phrase)
  })

  test.each(REFUSED)('%s names both places the value lives', (name) => {
    for (const finding of checkNoticeCap(fixture(name))) {
      expect(finding).toContain('app.css')
      expect(finding).toContain(NOTICE_CAP_MEDIA)
      expect(finding).toContain('NOTICE_CAP')
      expect(finding).toContain(NOTICE_CAP)
    }
  })

  test.each(['brace_in_string', 'brace_in_url'])('throws on %s', (name) => {
    expect(() => checkNoticeCap(fixture(name))).toThrow(
      'noticeCap: a brace inside a string or url(); the checker cannot count blocks',
    )
  })

  test('the cap is the one the design draws', () => {
    expect(NOTICE_CAP).toBe('560px')
    expect(NOTICE_CAP_MEDIA).toBe('(min-width: 900px)')
  })
})
