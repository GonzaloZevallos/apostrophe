/**
 * The front's `SaleBill` key lists against the server's own contract: the OpenAPI
 * snapshot (`tests/fixtures/openapi_snapshot.json`) is the truth, so a mismatch is
 * fixed on the front (plan, "Decisions that hold across subtasks").
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'
import {
  BILL_RULES,
  BILL_STATES,
  SALE_BILL_KEYS,
  SALE_BILL_LINE_KEYS,
  SALE_BILL_PAYMENT_KEYS,
} from './sales'

interface Schema {
  properties?: Record<string, SchemaProperty>
}
interface SchemaProperty {
  enum?: string[]
  anyOf?: SchemaProperty[]
}

const snapshot = JSON.parse(
  readFileSync(resolve(__dirname, '../../../tests/fixtures/openapi_snapshot.json'), 'utf8'),
) as { components: { schemas: Record<string, Schema> } }

function schema(name: string): Schema {
  const found = snapshot.components.schemas[name]
  if (found === undefined) throw new Error(`${name} is not in the OpenAPI snapshot`)
  return found
}

function propertyNames(name: string): string[] {
  return Object.keys(schema(name).properties ?? {}).sort()
}

function enumOf(name: string, property: string): string[] {
  const found = schema(name).properties?.[property]
  const values = found?.enum ?? found?.anyOf?.find((branch) => branch.enum !== undefined)?.enum
  if (values === undefined) throw new Error(`${name}.${property} has no enum in the snapshot`)
  return [...values].sort()
}

/** The one comparison the contract tests below make, and the rejection test runs
 * its drifted samples through the same function, so the proof that a drift fails
 * is about the comparison that guards the contract, not a copy of it. */
function drift(front: readonly string[], server: readonly string[]) {
  return {
    missingOnFront: server.filter((value) => !front.includes(value)).sort(),
    extraOnFront: front.filter((value) => !server.includes(value)).sort(),
  }
}

const NO_DRIFT = { missingOnFront: [], extraOnFront: [] }

test('the bill key lists equal the snapshot schemas property for property', () => {
  expect(drift(SALE_BILL_KEYS, propertyNames('SaleBillOut'))).toEqual(NO_DRIFT)
  expect(drift(SALE_BILL_LINE_KEYS, propertyNames('SaleBillLineOut'))).toEqual(NO_DRIFT)
  expect(drift(SALE_BILL_PAYMENT_KEYS, propertyNames('BillPaymentOut'))).toEqual(NO_DRIFT)
})

test('the payment state and rule enums equal the snapshot', () => {
  expect(drift(BILL_STATES, enumOf('BillPaymentOut', 'state'))).toEqual(NO_DRIFT)
  expect(drift(BILL_RULES, enumOf('SaleBillLineOut', 'rule'))).toEqual(NO_DRIFT)
})

test('the sale detail carries the bill', () => {
  expect(propertyNames('SaleDetailOut')).toContain('bill')
})

test('a front list that drifted from the snapshot is rejected', () => {
  const keys = propertyNames('SaleBillOut')
  expect(drift([...SALE_BILL_KEYS, 'note'], keys)).toEqual({ missingOnFront: [], extraOnFront: ['note'] })
  expect(drift(SALE_BILL_KEYS.slice(1), keys)).toEqual({ missingOnFront: ['business_name'], extraOnFront: [] })
  expect(drift([...BILL_STATES, 'refunded'], enumOf('BillPaymentOut', 'state'))).toEqual({
    missingOnFront: [],
    extraOnFront: ['refunded'],
  })
})
