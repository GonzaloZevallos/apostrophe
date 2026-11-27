import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'
import { SearchField } from './SearchField'

function Controlled({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial)
  return (
    <SearchField
      label="Search products"
      placeholder="Search products"
      clearLabel="Clear"
      value={value}
      onChange={setValue}
    />
  )
}

describe('SearchField', () => {
  test('the input is a searchbox named by the hidden label', () => {
    render(<Controlled />)
    const input = screen.getByRole('searchbox', { name: 'Search products' })
    expect(input).toHaveAttribute('placeholder', 'Search products')
  })

  test('the input asks the phone keyboard for search', () => {
    render(<Controlled />)
    const input = screen.getByRole('searchbox', { name: 'Search products' })
    expect(input).toHaveAttribute('type', 'search')
    expect(input).toHaveAttribute('autocomplete', 'off')
    expect(input).toHaveAttribute('enterkeyhint', 'search')
    expect(input).toHaveAttribute('inputmode', 'search')
  })

  test('the magnifier is hidden from assistive technology', () => {
    const { container } = render(<Controlled />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg?.closest('[aria-hidden="true"]')).not.toBeNull()
    expect(screen.queryByRole('img')).toBeNull()
  })

  test('there is no Clear button while the value is empty', () => {
    render(<Controlled />)
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull()
  })

  test('the field shows only what value says', () => {
    render(<Controlled initial="rose" />)
    expect(screen.getByRole('searchbox', { name: 'Search products' })).toHaveValue('rose')
    expect(screen.getByRole('button', { name: 'Clear' })).toHaveAttribute('type', 'button')
  })

  test('Clear empties the field, keeps the focus in the input and goes away', async () => {
    const user = userEvent.setup()
    render(<Controlled />)
    const input = screen.getByRole('searchbox', { name: 'Search products' })
    await user.type(input, 'rose')
    expect(input).toHaveValue('rose')
    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect(input).toHaveValue('')
    expect(document.activeElement).toBe(input)
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull()
  })
})
