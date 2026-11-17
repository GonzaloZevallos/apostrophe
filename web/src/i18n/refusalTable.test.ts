import { describe, expect, it } from 'vitest'
import contract from '../api/contract.json' with { type: 'json' }
import { REFUSAL_KEY as REFUSAL_KEY_FROM_API } from '../api/refusals.ts'
import { isRefusalCode, REFUSAL_CODES, REFUSAL_KEY } from './refusalTable.ts'

const CONTRACT_CODES = Object.keys(contract.refusalCodes)

describe('the refusal table', () => {
  it('lists every code of the contract, in its order', () => {
    expect(REFUSAL_CODES).toEqual(CONTRACT_CODES)
  })

  it('has a key for exactly those codes', () => {
    expect(Object.keys(REFUSAL_KEY).sort()).toEqual([...CONTRACT_CODES].sort())
  })

  it('is the very table api/refusals.ts re-exports', () => {
    expect(REFUSAL_KEY_FROM_API).toBe(REFUSAL_KEY)
  })

  it('knows a contract code and refuses anything else', () => {
    expect(isRefusalCode(CONTRACT_CODES[0] ?? '')).toBe(true)
    expect(isRefusalCode('no.such_code')).toBe(false)
    expect(isRefusalCode('toString')).toBe(false)
    expect(isRefusalCode('__proto__')).toBe(false)
  })
})
