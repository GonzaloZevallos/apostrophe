import { render, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { applyShownLanguage, resetToBootLanguage } from '../i18n/language'
import BrandMark from './BrandMark'

describe('BrandMark as a lockup', () => {
  it('is named "apostrophe" and draws the mark from the one SVG file, decoratively', () => {
    const { container } = render(<BrandMark />)

    const lockup = within(container).getByRole('img', { name: 'apostrophe' })
    const mark = lockup.querySelector('img')
    expect(mark).toHaveAttribute('src', '/icons/mark.svg')
    expect(mark).toHaveAttribute('alt', '')
  })

  it('hides the ’ (U+2019) from assistive technology and shows the word before it', () => {
    const { container } = render(<BrandMark />)

    const apostrophe = within(container).getByText('’')
    expect(apostrophe).toHaveAttribute('aria-hidden', 'true')
    expect(container).toHaveTextContent('apostrophe’')
  })

  it('is not a control', () => {
    const { container } = render(<BrandMark />)

    expect(within(container).queryByRole('link')).not.toBeInTheDocument()
    expect(within(container).queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('BrandMark in the Test locale', () => {
  beforeEach(async () => {
    await applyShownLanguage('en-XA')
  })
  afterEach(() => {
    resetToBootLanguage()
  })

  it('still reads "apostrophe" as a lockup', () => {
    const { container } = render(<BrandMark />)

    expect(within(container).getByRole('img', { name: 'apostrophe' })).toBeInTheDocument()
    expect(container).toHaveTextContent('apostrophe’')
  })
})
