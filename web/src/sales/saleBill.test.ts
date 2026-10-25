import { describe, expect, test } from 'vitest'
import { SALE_BILL_TEXT } from '../copy/sales'
import type { SaleBill } from '../api/sales'
import cases from './saleBill.cases.json'
import { renderSaleBill } from './saleBill'

interface Case {
  name: string
  bill: SaleBill
  expected: string
}

const REFERENCE = cases as Case[]

describe('renderSaleBill against the hand-written reference set', () => {
  test.each(REFERENCE.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    expect(renderSaleBill(c.bill)).toBe(c.expected)
  })
})
