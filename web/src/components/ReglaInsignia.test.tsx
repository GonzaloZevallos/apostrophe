/**
 * `ReglaInsignia` at the component seam (plan, "Components": "tests for...
 * `ReglaInsignia`'s five words"). The one source of a pricing rule's word and
 * tone (plan, invariants) — `lista` neutral, every other rule accented, the word
 * always visible so the rule is never told by color alone.
 */

import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import Insignia from './Insignia'
import ReglaInsignia from './ReglaInsignia'

test('an Insignia in the debt tone carries its word as content, and the tone class beside it', () => {
  render(<Insignia tono="deuda">owes you</Insignia>)
  expect(screen.getByText('owes you').className).toBe('insignia insignia--deuda')
})

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

test('a type line reads the type name it was priced with, in full, whatever its length', () => {
  const name = 'Mayoristas de la feria del domingo por la mañana'
  render(<ReglaInsignia rule="type" typeName={name} />)
  expect(screen.getByText(name)).toBeInTheDocument()
  expect(screen.queryByLabelText(name)).not.toBeInTheDocument()
})

test('a type line without a name shows no badge rather than a wrong word', () => {
  const { container } = render(<ReglaInsignia rule="type" typeName={null} />)
  expect(container).toBeEmptyDOMElement()
})
