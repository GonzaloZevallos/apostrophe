import { describe, expect, test } from 'vitest'
import { matchesQuery } from '../components/selectorSearch'
import {
  highlightRanges,
  matchCustomers,
  RECENT_ROWS,
  resolveRecent,
  type SearchableCustomer,
} from './customerSearch'

function customer(id: number, name: string, phone: string | null = null): SearchableCustomer {
  return { id, name, phone_display: phone }
}

function ids(found: readonly SearchableCustomer[]): number[] {
  return found.map((entry) => entry.id)
}

describe('matchCustomers', () => {
  const perez = customer(1, 'Pérez, Luis')

  test('finds a name ignoring accents and capitals', () => {
    expect(ids(matchCustomers([perez], 'perez'))).toEqual([1])
    expect(ids(matchCustomers([perez], 'PEREZ'))).toEqual([1])
    expect(ids(matchCustomers([customer(2, 'Luis Perez')], 'pérez'))).toEqual([2])
  })

  test('a query of only spaces counts as empty and matches nothing', () => {
    expect(matchCustomers([perez, customer(2, 'Ana', '099 123 456')], '   ')).toEqual([])
    expect(matchCustomers([perez], '')).toEqual([])
  })

  test('a query with no digits matches no phone', () => {
    const phoned = customer(1, 'Ana', '099 123 456')
    expect(matchCustomers([phoned], '- +')).toEqual([])
    expect(matchCustomers([phoned], 'zzz')).toEqual([])
  })

  test('a phone matches on the query digits, ignoring spaces, dashes and plus', () => {
    const phoned = customer(1, 'Ana', '+598 99 123-456')
    expect(ids(matchCustomers([phoned], '99-123 4'))).toEqual([1])
    expect(ids(matchCustomers([phoned], '+598'))).toEqual([1])
    expect(matchCustomers([customer(2, 'Bea', null)], '123')).toEqual([])
  })

  test('a phone-only match goes after a name-prefix match, whatever the alphabet says', () => {
    const phoneOnly = customer(1, 'Aaron', '099 123 456')
    const prefix = customer(2, '123 Zoe')
    expect(ids(matchCustomers([phoneOnly, prefix], '123'))).toEqual([2, 1])
  })

  test('a name that holds the query but does not start with it goes in the second group', () => {
    const inside = customer(1, 'Ana Marta')
    const prefix = customer(2, 'Marta Zeta')
    expect(ids(matchCustomers([inside, prefix], 'marta'))).toEqual([2, 1])
  })

  test('each group is alphabetical ignoring accents and capitals', () => {
    const list = [
      customer(1, 'álvaro'),
      customer(2, 'Alberto'),
      customer(3, 'ana'),
      customer(4, 'Zoila Al'),
      customer(5, 'Beatriz al'),
    ]
    expect(ids(matchCustomers(list, 'al'))).toEqual([2, 1, 5, 4])
  })

  test('identical folded names come out the same in either input order', () => {
    const accented = customer(1, 'José')
    const plain = customer(2, 'Jose')
    const again = customer(3, 'Jose')
    const forward = ids(matchCustomers([accented, plain, again], 'jose'))
    const backward = ids(matchCustomers([again, plain, accented], 'jose'))
    expect(forward).toEqual(backward)
    expect(forward).toEqual([2, 3, 1])
  })

  test('"ana 12" matches the phone holding 12, not the name Ana Pérez', () => {
    const named = customer(1, 'Ana Pérez', '099 777 888')
    const phoned = customer(2, 'Bruno', '099 912 345')
    expect(ids(matchCustomers([named, phoned], 'ana 12'))).toEqual([2])
  })
})

describe('resolveRecent', () => {
  const all = [2, 3, 4, 5, 6, 7, 8].map((id) => customer(id, `Customer ${id}`))

  test('drops the unresolved ids before taking the limit', () => {
    const resolved = resolveRecent(all, [1, 2, 3, 4, 5, 6, 7, 8], RECENT_ROWS)
    expect(ids(resolved)).toEqual([2, 3, 4])
  })

  test('keeps the order of the ids, not of the customers', () => {
    expect(ids(resolveRecent(all, [5, 2, 9, 4], RECENT_ROWS))).toEqual([5, 2, 4])
  })

  test('gives only those resolved when fewer than the limit', () => {
    expect(ids(resolveRecent(all, [1, 2, 9, 3], RECENT_ROWS))).toEqual([2, 3])
    expect(ids(resolveRecent(all.slice(0, 2), [1, 2, 3], RECENT_ROWS))).toEqual([2, 3])
  })

  test('gives nothing when none resolves or there are no ids', () => {
    expect(resolveRecent(all, [1, 9, 10], RECENT_ROWS)).toEqual([])
    expect(resolveRecent(all, [], RECENT_ROWS)).toEqual([])
  })

  test('shows three recent rows', () => {
    expect(RECENT_ROWS).toBe(3)
  })
})

describe('highlightRanges', () => {
  test('a decomposed e plus U+0301 covers the mark', () => {
    const shown = 'José Ruiz'
    expect(highlightRanges(shown, 'jose', 'name')).toEqual([0, 5])
    expect(highlightRanges(shown, 'ose', 'name')).toEqual([1, 5])
  })

  test('İ is matched by i and covers only itself', () => {
    expect(highlightRanges('İ', 'i', 'name')).toEqual([0, 1])
  })

  test('a match at the end of the name', () => {
    expect(highlightRanges('Ana Pérez', 'rez', 'name')).toEqual([6, 9])
    expect(highlightRanges('Ana Pérez', 'pérez', 'name')).toEqual([4, 9])
  })

  test('a name that folds by context falls back to the whole label', () => {
    expect(highlightRanges('ΟΔΥΣΣΕΑΣ', 'δυ', 'name')).toEqual([0, 8])
  })

  test('a name has a range exactly when it matches the query', () => {
    const labels = ['Pérez', 'José', 'İstanbul', 'ΟΔΥΣΣΕΑΣ', 'Ñandú', '😀 Ana', 'a.b*c', 'Ana']
    const queries = ['perez', 'ose', 'i', 'στ', 'σσ', 'nan', 'ana', '.', '*c', 'b*', '', '  ', 'zzz', 'Ñ']
    for (const label of labels) {
      for (const query of queries) {
        expect(highlightRanges(label, query, 'name') !== null && query.trim() !== '').toBe(
          matchesQuery(label, query) && query.trim() !== '',
        )
      }
    }
  })

  test('a range never cuts a surrogate pair', () => {
    expect(highlightRanges('😀 Ana', 'ana', 'name')).toEqual([3, 6])
  })

  test('a phone range spans the spaces and dashes between matched digits', () => {
    const shown = '+54 9 11 2345-6789'
    const range = highlightRanges(shown, '1123456', 'phone')
    expect(range).toEqual([6, 15])
    expect(range && shown.slice(range[0], range[1])).toBe('11 2345-6')
  })

  test('a query with spaces, dashes or plus still matches on its digits', () => {
    const shown = '+54 9 11 2345-6789'
    const range = highlightRanges(shown, '11 2345-6', 'phone')
    expect(range && shown.slice(range[0], range[1])).toBe('11 2345-6')
  })

  test('the ungrouped form is walked as sent', () => {
    const shown = '+59899123456'
    const range = highlightRanges(shown, '99123', 'phone')
    expect(range).toEqual([4, 9])
    expect(range && shown.slice(range[0], range[1])).toBe('99123')
  })

  test('query digits longer than the phone give null', () => {
    expect(highlightRanges('099 123', '099123456', 'phone')).toBeNull()
  })

  test('digits that are not a contiguous run give null', () => {
    expect(highlightRanges('099 123 456', '0912', 'phone')).toBeNull()
  })

  test('a query with no digits gives null in phone mode, and no phone gives null', () => {
    expect(highlightRanges('099 123 456', 'ana', 'phone')).toBeNull()
    expect(highlightRanges('099 123 456', ' - + ', 'phone')).toBeNull()
    expect(highlightRanges('', '123', 'phone')).toBeNull()
  })
})
