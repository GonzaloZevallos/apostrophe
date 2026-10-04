/**
 * `ReglaInsignia` at the component seam (plan, "Components": "tests for...
 * `ReglaInsignia`'s five words"). The one source of a pricing rule's word and
 * tone (plan, invariants) — `lista` neutral, every other rule accented, the word
 * always visible so the rule is never told by color alone.
 */

import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import ReglaInsignia from './ReglaInsignia'

test('list reads "lista", neutral', () => {
  render(<ReglaInsignia rule="list" />)
  const badge = screen.getByText('lista')
  expect(badge.className).toBe('insignia')
})

test('bulk reads "por cantidad", accented', () => {
  render(<ReglaInsignia rule="bulk" />)
  const badge = screen.getByText('por cantidad')
  expect(badge.className).toBe('insignia insignia--acento')
})

test('vip reads "VIP", accented', () => {
  render(<ReglaInsignia rule="vip" />)
  expect(screen.getByText('VIP').className).toBe('insignia insignia--acento')
})

test('gift reads "regalo", accented', () => {
  render(<ReglaInsignia rule="gift" />)
  expect(screen.getByText('regalo').className).toBe('insignia insignia--acento')
})

test('special reads "especial", accented', () => {
  render(<ReglaInsignia rule="special" />)
  expect(screen.getByText('especial').className).toBe('insignia insignia--acento')
})
