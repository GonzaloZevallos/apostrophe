/** The front's icon map against the backend's `CustomerTypeIcon` enum in the OpenAPI snapshot. */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'
import { ICON_NAMES } from '../../components/Icono'
import enCustomerTypes from '../../copy/locales/en/customerTypes.json'
import { CUSTOMER_TYPE_ICONS, CUSTOMER_TYPE_ICON_ORDER } from './customerTypeIcons'

interface Snapshot {
  components: { schemas: { CustomerTypeIcon: { enum: string[] } } }
}

const SNAPSHOT_PATH = resolve(process.cwd(), '..', 'tests', 'fixtures', 'openapi_snapshot.json')

const namesOf = (record: Record<string, unknown>): string[] => Object.entries(record).map(([name]) => name)

test('the map has exactly the keys of the backend enum', () => {
  const snapshot = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) as Snapshot
  const backend = snapshot.components.schemas.CustomerTypeIcon.enum
  expect(namesOf(CUSTOMER_TYPE_ICONS).sort()).toEqual([...backend].sort())
  expect([...CUSTOMER_TYPE_ICON_ORDER].sort()).toEqual([...backend].sort())
})

test('a key the backend dropped or added would fail the comparison', () => {
  const backend = ['circle', 'star']
  expect(namesOf(CUSTOMER_TYPE_ICONS).sort()).not.toEqual([...backend].sort())
})

test('every key is drawn by Icono and has an accessible name', () => {
  for (const [name, glyph] of Object.entries(CUSTOMER_TYPE_ICONS)) {
    expect(ICON_NAMES).toContain(glyph)
    expect(namesOf(enCustomerTypes.icon)).toContain(name)
  }
})
