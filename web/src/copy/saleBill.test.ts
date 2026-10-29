import { describe, expect, test } from 'vitest'
import { SALE_BILL_TEXT } from './sales'

describe('the saleBill copy group', () => {
  test('the fixed words read as the PRD writes them', () => {
    expect(SALE_BILL_TEXT.share).toBe('Share')
    expect(SALE_BILL_TEXT.copy).toBe('Copy')
    expect(SALE_BILL_TEXT.copied).toBe('Bill copied')
    expect(SALE_BILL_TEXT.shareFailed).toBe("Couldn't share. Tap Copy and paste it into the chat.")
    expect(SALE_BILL_TEXT.copyFailed).toBe("Couldn't copy. Select the text below and copy it by hand.")
    expect(SALE_BILL_TEXT.blockName).toBe('Sale bill')
    expect(SALE_BILL_TEXT.paidCash).toBe('Paid in cash')
    expect(SALE_BILL_TEXT.paidTransfer).toBe('Paid by transfer')
    expect(SALE_BILL_TEXT.paid).toBe('Paid')
    expect(SALE_BILL_TEXT.unit).toBe('g')
  })

  test('the templates fill their placeholders with the separator " · "', () => {
    expect(SALE_BILL_TEXT.header('Flores Test', '18/09')).toBe('Flores Test\n18/09')
    expect(SALE_BILL_TEXT.item('Aurora', '3,5', 'g', '$ 35.000')).toBe('Aurora 3,5 g · $ 35.000')
    expect(SALE_BILL_TEXT.bulk('Luna', '10', 'g', '$ 9.000', '$ 90.000')).toBe(
      'Luna 10 g · bulk price $ 9.000/g · $ 90.000',
    )
    expect(SALE_BILL_TEXT.gift('Mora', '1', 'g')).toBe('Mora 1 g · Gift · $ 0')
    expect(SALE_BILL_TEXT.shipping('$ 2.000')).toBe('Shipping · $ 2.000')
    expect(SALE_BILL_TEXT.total('$ 127.000')).toBe('Total · $ 127.000')
    expect(SALE_BILL_TEXT.stillOwed('$ 27.000')).toBe('Still owed on this sale: $ 27.000')
    expect(SALE_BILL_TEXT.balance('$ 41.000')).toBe('Your balance: $ 41.000')
    expect(SALE_BILL_TEXT.credit('$ 3.000')).toBe('In your favor: $ 3.000')
  })

  test('no fixed word holds a markdown mark', () => {
    const fixed = [
      SALE_BILL_TEXT.header('', ''),
      SALE_BILL_TEXT.item('', '', '', ''),
      SALE_BILL_TEXT.bulk('', '', '', '', ''),
      SALE_BILL_TEXT.gift('', '', ''),
      SALE_BILL_TEXT.shipping(''),
      SALE_BILL_TEXT.total(''),
      SALE_BILL_TEXT.paidCash,
      SALE_BILL_TEXT.paidTransfer,
      SALE_BILL_TEXT.paid,
      SALE_BILL_TEXT.stillOwed(''),
      SALE_BILL_TEXT.balance(''),
      SALE_BILL_TEXT.credit(''),
      SALE_BILL_TEXT.unit,
    ].join('\n')
    expect(fixed).not.toMatch(/[*_`]/)
  })
})
