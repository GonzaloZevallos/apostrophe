import { beforeEach, describe, expect, it } from 'vitest'
import { scrollTopInPage } from '../../../scripts/design/shot-page.mjs'

// jsdom lays nothing out, so a scroller's offset is set by hand: what the function must do is pick
// the one element and zero its `scrollTop`.
function scroller(style: string, ...children: (Node | string)[]): HTMLElement {
  const element = document.createElement('div')
  element.setAttribute('style', style)
  element.append(...children)
  element.scrollTop = 40
  return element
}

function heading(text: string): HTMLElement {
  const element = document.createElement('h3')
  element.textContent = text
  return element
}

describe('scrollTopInPage', () => {
  beforeEach(() => {
    document.body.replaceChildren()
  })

  it('resets the nearest scrolling ancestor only, not a sibling scroller nor an outer one', () => {
    const near = scroller('overflow-y: auto', heading('Other things to record'))
    const inner = document.createElement('section')
    inner.append(near)
    const sibling = scroller('overflow-y: scroll', 'Something else')
    const outer = scroller('overflow-y: auto', inner, sibling)
    document.body.append(outer)

    scrollTopInPage('Other things to record')

    expect(near.scrollTop).toBe(0)
    expect(sibling.scrollTop).toBe(40)
    expect(outer.scrollTop).toBe(40)
  })

  it('skips an ancestor that does not scroll and resets the first that does', () => {
    const scrolling = scroller('overflow-y: scroll')
    const hidden = scroller('overflow-y: hidden', heading('Other things to record'))
    scrolling.append(hidden)
    document.body.append(scrolling)

    scrollTopInPage('Other things to record')

    expect(scrolling.scrollTop).toBe(0)
    expect(hidden.scrollTop).toBe(40)
  })

  it('finds the text through a wrapper that holds nothing else', () => {
    const wrapper = document.createElement('div')
    wrapper.append(heading('Other things to record'))
    const only = scroller('overflow-y: auto', wrapper)
    document.body.append(only)

    scrollTopInPage('Other things to record')

    expect(only.scrollTop).toBe(0)
  })

  it('refuses a text no element has, without naming it', () => {
    document.body.append(scroller('overflow-y: auto', heading('Another heading')))
    expect(() => scrollTopInPage('Secret text')).toThrow(/^scroll_top: no element has exactly that text$/)
  })

  it('refuses a text two elements have, and resets nothing', () => {
    const first = scroller('overflow-y: auto', heading('Other things to record'))
    const second = scroller('overflow-y: auto', heading('Other things to record'))
    document.body.append(first, second)

    expect(() => scrollTopInPage('Other things to record')).toThrow(
      /^scroll_top: more than one element has exactly that text$/,
    )
    expect(first.scrollTop).toBe(40)
    expect(second.scrollTop).toBe(40)
  })

  it('refuses a text with no scrolling ancestor, and never resets the page itself', () => {
    document.body.append(scroller('overflow-y: hidden', heading('Other things to record')))
    document.body.style.overflowY = 'auto'
    document.documentElement.style.overflowY = 'scroll'
    document.documentElement.scrollTop = 40

    expect(() => scrollTopInPage('Other things to record')).toThrow(
      /^scroll_top: the text has no ancestor with overflow-y auto or scroll$/,
    )
    expect(document.documentElement.scrollTop).toBe(40)

    document.body.style.overflowY = ''
    document.documentElement.style.overflowY = ''
    document.documentElement.scrollTop = 0
  })
})
