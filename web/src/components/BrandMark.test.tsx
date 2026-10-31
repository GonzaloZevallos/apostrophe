import { act, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyShownLanguage, resetToBootLanguage } from '../i18n/language'
import BrandMark from './BrandMark'

type Observed = { callback: IntersectionObserverCallback; root: Element | Document | null; target: Element | null }
let observed: Observed[] = []

class FakeObserver {
  private readonly entry: Observed
  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.entry = { callback, root: options?.root ?? null, target: null }
    observed.push(this.entry)
  }
  observe(target: Element): void {
    this.entry.target = target
  }
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return []
  }
}

function see(isIntersecting: boolean): void {
  const entry = observed[observed.length - 1]
  if (entry === undefined || entry.target === null) throw new Error('nothing is observed')
  act(() => {
    entry.callback([{ isIntersecting, target: entry.target } as IntersectionObserverEntry], {} as IntersectionObserver)
  })
}

beforeEach(() => {
  observed = []
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('BrandMark as a lockup', () => {
  it('is named "apostrophe" and draws the mark from the one SVG file, decoratively', () => {
    const { container } = render(<BrandMark variant="lockup" />)

    const lockup = within(container).getByRole('img', { name: 'apostrophe' })
    const mark = lockup.querySelector('img')
    expect(mark).toHaveAttribute('src', '/icons/mark.svg')
    expect(mark).toHaveAttribute('alt', '')
  })

  it('hides the ’ (U+2019) from assistive technology and shows the word before it', () => {
    const { container } = render(<BrandMark variant="lockup" />)

    const apostrophe = within(container).getByText('’')
    expect(apostrophe).toHaveAttribute('aria-hidden', 'true')
    expect(container).toHaveTextContent('apostrophe’')
  })

  it('is not a control', () => {
    const { container } = render(<BrandMark variant="lockup" />)

    expect(within(container).queryByRole('link')).not.toBeInTheDocument()
    expect(within(container).queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('BrandMark as the mark alone', () => {
  it('is hidden from assistive technology when the browser has no IntersectionObserver', () => {
    const { container } = render(<BrandMark variant="mark" />)

    const mark = container.querySelector('img')
    expect(mark).toHaveAttribute('src', '/icons/mark.svg')
    expect(mark).toHaveAttribute('aria-hidden', 'true')
    expect(within(container).queryByRole('img', { name: 'apostrophe' })).not.toBeInTheDocument()
  })

  it('is role=img named "apostrophe" while visible and aria-hidden again once clipped', () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver)
    const root = document.createElement('div')
    document.body.append(root)
    render(<BrandMark variant="mark" clipRoot={{ current: root }} />)

    see(true)
    expect(screen.getByRole('img', { name: 'apostrophe' })).toHaveAttribute('src', '/icons/mark.svg')
    expect(observed[observed.length - 1]?.root).toBe(root)

    see(false)
    expect(screen.queryByRole('img', { name: 'apostrophe' })).not.toBeInTheDocument()
    root.remove()
  })

  it('is not a control', () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver)
    render(<BrandMark variant="mark" />)
    see(true)

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('BrandMark in the Test locale', () => {
  beforeEach(async () => {
    await applyShownLanguage('en-XA')
  })
  afterEach(() => {
    resetToBootLanguage()
  })

  it('still reads "apostrophe", as lockup and as mark', () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver)
    render(
      <>
        <section aria-label="lockup">
          <BrandMark variant="lockup" />
        </section>
        <section aria-label="mark">
          <BrandMark variant="mark" />
        </section>
      </>,
    )
    see(true)

    expect(within(screen.getByRole('region', { name: 'lockup' })).getByRole('img', { name: 'apostrophe' })).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'mark' })).getByRole('img', { name: 'apostrophe' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'lockup' })).toHaveTextContent('apostrophe’')
  })
})
