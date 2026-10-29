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

/** The one comparison every test below makes, the drift-rejection test included, so a
 * drifted list is proven to fail through the very function that guards the contract. */
function sameSet(front: readonly string[], server: readonly string[]): boolean {
  const left = [...front].sort()
  const right = [...server].sort()
  return left.length === right.length && left.every((value, index) => value === right[index])
}

test('the bill key lists equal the snapshot schemas property for property', () => {
  expect(sameSet(SALE_BILL_KEYS, propertyNames('SaleBillOut'))).toBe(true)
  expect(sameSet(SALE_BILL_LINE_KEYS, propertyNames('SaleBillLineOut'))).toBe(true)
  expect(sameSet(SALE_BILL_PAYMENT_KEYS, propertyNames('BillPaymentOut'))).toBe(true)
})

test('the payment state and rule enums equal the snapshot', () => {
  expect(sameSet(BILL_STATES, enumOf('BillPaymentOut', 'state'))).toBe(true)
  expect(sameSet(BILL_RULES, enumOf('SaleBillLineOut', 'rule'))).toBe(true)
})

test('the sale detail carries the bill', () => {
  expect(propertyNames('SaleDetailOut')).toContain('bill')
})

test('a front list that drifted from the snapshot is rejected', () => {
  expect(sameSet([...SALE_BILL_KEYS, 'note'], propertyNames('SaleBillOut'))).toBe(false)
  expect(sameSet(SALE_BILL_KEYS.slice(1), propertyNames('SaleBillOut'))).toBe(false)
  expect(sameSet([...BILL_STATES, 'refunded'], enumOf('BillPaymentOut', 'state'))).toBe(false)
  expect(sameSet(SALE_BILL_KEYS, propertyNames('SaleBillOut'))).toBe(true)
})
