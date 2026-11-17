import { describe, expect, it } from 'vitest'
import { isKeyShaped } from '../i18n/keyShape'
import { copyModules, en as realEn, PROBE } from '../architecture/i18nOffenders/scan'
import { REGISTRIES, textsOf, wordsOf } from './copyTexts'

describe('textsOf', () => {
  it('yields no text from the registries a copy file exports, keyed ones included', () => {
    const registries = {
      LANGUAGE: 'en',
      LIMITED_COPY: [{ kind: 'notice', key: 'common:offline' }],
      LONG_REFUSALS: ['common:long'],
      NAMESPACE: 'common',
      MOVED_TO_KEYS: ['COMMON_TEXT'],
      BASELINE_ARGS: { 'COMMON_TEXT.settingsFor': [['Rosa']] },
    }

    expect([...textsOf('a.ts', registries, '?').keys()]).toEqual([])
  })

  it('still finds a string export, an object field and a function beside the registries', () => {
    const mod = { NAMESPACE: 'common', MOVED_TO_KEYS: ['T'], TITLE: 'Title', T: { home: 'Home', hi: (name: string) => `Hi ${name}` } }

    expect(Object.fromEntries(textsOf('a.ts', mod, '?'))).toEqual({
      'a.ts.TITLE': 'Title',
      'a.ts.T.home': 'Home',
      'a.ts.T.hi': 'Hi ?',
    })
  })

  it('throws when a copy function throws on the probe, so it never drops out quietly', () => {
    const mod = {
      T: {
        broken: (name: string) => {
          throw new Error(`cannot write with ${name}`)
        },
      },
    }

    expect(() => textsOf('a.ts', mod, '?')).toThrow(/^cannot write with \?$/)
  })

  it('does not skip a name that only looks like a registry', () => {
    expect(Object.fromEntries(textsOf('a.ts', { NAMESPACE_OF: 'x', LANGUAGES: 'y' }, '?'))).toEqual({ 'a.ts.NAMESPACE_OF': 'x', 'a.ts.LANGUAGES': 'y' })
  })
})

const bundle = {
  a: {
    title: 'Title',
    hi: 'Hi {{name}}',
    sale_one: '{{count}} sale',
    sale_other: '{{count}} sales',
    group: { x: 'y' },
    nested: '$t(a:title)',
  },
}

describe('wordsOf', () => {
  it('pins the registries to their six names', () => {
    expect([...REGISTRIES].sort()).toEqual(['BASELINE_ARGS', 'LANGUAGE', 'LIMITED_COPY', 'LONG_REFUSALS', 'MOVED_TO_KEYS', 'NAMESPACE'])
  })

  it('skips the registries, keyed ones included', () => {
    const registries = { LANGUAGE: 'en', NAMESPACE: 'common', LIMITED_COPY: [{ key: 'a:title' }], MOVED_TO_KEYS: ['T'], LONG_REFUSALS: ['a:nope'], BASELINE_ARGS: { x: 'plain words' } }
    expect(wordsOf('a.ts', registries, '?', bundle)).toEqual({ words: new Map(), findings: [] })
  })

  it('keeps plain words in walk order and drops the keys that resolve', () => {
    const mod = { TITLE: 'Title', T: { home: 'Home', ok: 'a:title', hi: (name: string) => `Hi ${name}` } }
    const { words, findings } = wordsOf('a.ts', mod, '?', bundle)
    expect([...words]).toEqual([
      ['a.ts.TITLE', 'Title'],
      ['a.ts.T.home', 'Home'],
      ['a.ts.T.hi', 'Hi ?'],
    ])
    expect(findings).toEqual([])
  })

  it('probes a function with a default parameter and a rest parameter once each', () => {
    const mod = { T: { def: (name = 'Rosa') => `Hola ${name}`, rest: (...names: string[]) => names.join('+') } }
    expect(Object.fromEntries(wordsOf('a.ts', mod, '?', bundle).words)).toEqual({ 'a.ts.T.def': 'Hola ?', 'a.ts.T.rest': '?' })
  })

  it('probes a function with one copy of the probe per declared parameter', () => {
    const mod = { T: { two: (a: string, b: string) => `${a}-${b}` } }
    expect(Object.fromEntries(wordsOf('a.ts', mod, '?', bundle).words)).toEqual({ 'a.ts.T.two': '?-?' })
  })

  it('reports a function that throws when probed and goes on with the walk', () => {
    const mod = {
      T: {
        boom: () => {
          throw new Error('no')
        },
        after: 'After',
      },
    }
    const { words, findings } = wordsOf('a.ts', mod, '?', bundle)
    expect(findings).toEqual(['unreadable export a.ts.T.boom'])
    expect([...words.keys()]).toEqual(['a.ts.T.after'])
  })

  it('reports a key that is not in the bundle, by its place in the module', () => {
    const mod = { T: { ok: 'a:title', gone: 'a:missing', nsGone: 'zz:title' } }
    const { words, findings } = wordsOf('a.ts', mod, '?', bundle)
    expect(findings).toEqual(['unresolved key a.ts.T.gone', 'unresolved key a.ts.T.nsGone'])
    expect(words.size).toBe(0)
  })

  it('resolves a plural key that has only its _one and _other forms', () => {
    expect(wordsOf('a.ts', { T: { n: 'a:sale' } }, '?', bundle)).toEqual({ words: new Map(), findings: [] })
  })

  it('resolves a function that returns a key with a placeholder', () => {
    const mod = { T: { hi: (_name: string) => 'a:hi', hiToo: (_name: string) => 'a:hi' } }
    expect(wordsOf('a.ts', mod, '?', bundle)).toEqual({ words: new Map(), findings: [] })
  })

  it('reports a key that holds an object, or a nested $t(, as unusable', () => {
    const mod = { T: { group: 'a:group', nested: 'a:nested' } }
    expect(wordsOf('a.ts', mod, '?', bundle).findings).toEqual(['unusable key a.ts.T.group', 'unusable key a.ts.T.nested'])
  })

  it('returns its findings sorted and without repeats', () => {
    const mod = { T: { b: 'a:missing', a: 'a:missing' }, U: () => 'a:missing' }
    expect(wordsOf('a.ts', mod, '?', bundle).findings).toEqual(['unresolved key a.ts.T.a', 'unresolved key a.ts.T.b', 'unresolved key a.ts.U'])
  })

  it('refuses a probe that is shaped like a key, which is a mistake of the caller', () => {
    expect(() => wordsOf('a.ts', {}, 'a:title', bundle)).toThrow('probe')
  })

  it('uses a probe that is not shaped like a key', () => {
    expect(isKeyShaped(PROBE)).toBe(false)
  })
})

const rawCopy = import.meta.glob('/src/copy/*.ts', { query: '?raw', import: 'default' })

describe('wordsOf over the real copy modules', () => {
  it('reads every copy module the shared scan names, and finds nothing unresolved or unreadable', () => {
    const modules = copyModules()
    expect(Object.keys(modules).length).toBeGreaterThan(15)
    for (const file of Object.keys(modules)) expect(Object.keys(rawCopy)).toContain(`/src/copy/${file}`)
    const findings = Object.entries(modules).flatMap(([file, mod]) => wordsOf(file, mod, PROBE, realEn).findings)
    expect(findings).toEqual([])
  })
})
