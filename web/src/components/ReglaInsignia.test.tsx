/**
 * `ReglaInsignia` at the component seam (plan, "Components": "tests for...
 * `ReglaInsignia`'s five words"). The one source of a pricing rule's word and
 * tone (plan, invariants) — `lista` neutral, every other rule accented, the word
 * always visible so the rule is never told by color alone.
 */

import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import ReglaInsignia from './ReglaInsignia'

test('list reads "list", neutral', () => {
  render(<ReglaInsignia rule="list" />)
  const badge = screen.getByText('list')
  expect(badge.className).toBe('insignia')
})

test('bulk reads "bulk", accented', () => {
  render(<ReglaInsignia rule="bulk" />)
  const badge = screen.getByText('bulk')
  expect(badge.className).toBe('insignia insignia--acento')
})

test('vip reads "VIP", accented', () => {
  render(<ReglaInsignia rule="vip" />)
  expect(screen.getByText('VIP').className).toBe('insignia insignia--acento')
})

test('gift reads "gift", accented', () => {
  render(<ReglaInsignia rule="gift" />)
  expect(screen.getByText('gift').className).toBe('insignia insignia--acento')
})

test('special reads "special", accented', () => {
  render(<ReglaInsignia rule="special" />)
  expect(screen.getByText('special').className).toBe('insignia insignia--acento')
})
