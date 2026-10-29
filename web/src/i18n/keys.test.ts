import { describe, expectTypeOf, it } from 'vitest'
import type { KeysOf } from './keys'

type Fixture = { fixture: typeof import('./__fixtures__/locales/en/fixture.json') }
type FixtureKey = KeysOf<Fixture>

describe('KeysOf', () => {
  it('accepts a key present in the resource', () => {
    expectTypeOf<'fixture:title'>().toExtend<FixtureKey>()
    expectTypeOf<'fixture:nested.deep'>().toExtend<FixtureKey>()
  })

  it('rejects a key absent from the resource', () => {
    expectTypeOf<'fixture:absent'>().not.toExtend<FixtureKey>()
    expectTypeOf<'other:title'>().not.toExtend<FixtureKey>()
    expectTypeOf<'fixture:nested'>().not.toExtend<FixtureKey>()
  })

  it('is a closed union, not string', () => {
    expectTypeOf<string>().not.toExtend<FixtureKey>()
    expectTypeOf<FixtureKey>().not.toEqualTypeOf<string>()
  })

  it('folds the plural suffixes into the base key', () => {
    expectTypeOf<'fixture:items'>().toExtend<FixtureKey>()
    expectTypeOf<'fixture:nested.list'>().toExtend<FixtureKey>()
    expectTypeOf<'fixture:items_one'>().not.toExtend<FixtureKey>()
    expectTypeOf<'fixture:items_other'>().not.toExtend<FixtureKey>()
  })

  it('yields no key for an empty resource set', () => {
    expectTypeOf<KeysOf<{}>>().toBeNever()
  })
})
