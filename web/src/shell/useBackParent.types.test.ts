/**
 * `useBackParent` accepts only the screens the registry marks `backLabel: 'record'`, and only
 * `tsc` enforces it (`npm run typecheck`): each `Rejected<…>` must be `true` and each
 * `Accepted` `false`, so a hook that grew loose, or one that grew too tight, fails `tsc` with
 * no suppression comment. The runtime test only keeps the file a test file.
 */

import { expect, test } from 'vitest'
import type { RecordLabelledScreen } from '../routes'
import type { BackOverride, useBackParent } from './useBackParent'

type Screen = Parameters<typeof useBackParent>[0]
type Rejected<Id extends string> = [Id] extends [Screen] ? false : true

const unmarkedCard: Rejected<'sale'> = true
const unmarkedRoot: Rejected<'varieties'> = true
const archivedList: Rejected<'varieties-archived'> = true
const withdrawal: Rejected<'withdrawal'> = true
const unknownScreen: Rejected<'nowhere'> = true

const variety: Rejected<'variety'> = false
const prices: Rejected<'variety-prices'> = false
const entries: Rejected<'variety-entries'> = false
const marked: [RecordLabelledScreen] extends [Screen] ? true : false = true

const fixedParent: BackOverride = { parent: 'varieties-archived' }
const anotherParent: [{ parent: 'varieties' }] extends [BackOverride] ? false : true = true
const bareOverride: [{ other: true }] extends [BackOverride] ? false : true = true

test('the marked screens are enforced by tsc, not at run time', () => {
  const checks = [unmarkedCard, unmarkedRoot, archivedList, withdrawal, unknownScreen, anotherParent, bareOverride]
  const accepted = [variety, prices, entries]
  expect(checks.every(Boolean)).toBe(true)
  expect(accepted.some(Boolean)).toBe(false)
  expect(marked).toBe(true)
  expect(fixedParent).toEqual({ parent: 'varieties-archived' })
})
