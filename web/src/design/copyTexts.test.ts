import { describe, expect, it } from 'vitest'
import { textsOf } from './copyTexts'

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

  it('does not skip a name that only looks like a registry', () => {
    expect(Object.fromEntries(textsOf('a.ts', { NAMESPACE_OF: 'x', LANGUAGES: 'y' }, '?'))).toEqual({ 'a.ts.NAMESPACE_OF': 'x', 'a.ts.LANGUAGES': 'y' })
  })
})
