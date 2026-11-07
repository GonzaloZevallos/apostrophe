/**
 * `ContentArea` and `useLoading` at their seam: Testing Library, no router. The content area itself
 * carries `aria-busy="true"` while a load stands in it, from the first render until the last load
 * ends (CODING_STANDARDS §10 item 7). An owner is found by role and name; the attribute is read on
 * the element, never on a descendant.
 */

import { render, screen } from '@testing-library/react'
import { type ReactNode, StrictMode } from 'react'
import { describe, expect, test } from 'vitest'
import { CONTENT_AREA } from '../mobile-standard/contentArea'
import { flipViewport, stubViewport } from '../test-viewport'
import ContentArea from './ContentArea'
import Loading, { LOADING_MARKER, LoadingAnuncio } from './Loading'
import Sheet from './Sheet'
import { useLoading } from './useLoading'

function Waiting({ active }: { active: boolean }) {
  useLoading(active)
  return null
}

function Screen({ loads }: { loads: readonly string[] }) {
  return (
    <ContentArea as="main" aria-label="Screen">
      {loads.map((load) => (
        <Waiting key={load} active />
      ))}
    </ContentArea>
  )
}

const area = () => screen.getByRole('main', { name: 'Screen' })

describe('the owner', () => {
  test('is busy right after render when a Loading is inside, and carries the content-area attribute', () => {
    render(
      <ContentArea as="main" aria-label="Screen">
        <Loading />
      </ContentArea>,
    )

    expect(area()).toHaveAttribute('aria-busy', 'true')
    expect(area()).toHaveAttribute(CONTENT_AREA.attribute)
    expect(screen.getByRole('progressbar', { name: 'Loading' })).toHaveAttribute('aria-busy', 'true')
  })

  test('is not busy while nothing is loading', () => {
    render(
      <ContentArea as="main" aria-label="Screen">
        <p>Loaded</p>
      </ContentArea>,
    )

    expect(area()).not.toHaveAttribute('aria-busy')
  })

  test('forwards its ref to the element', () => {
    let node: HTMLElement | null = null
    render(
      <ContentArea
        as="div"
        aria-label="Screen"
        ref={(element) => {
          node = element
        }}
      />,
    )

    expect(node).toBe(screen.getByLabelText('Screen'))
  })

  test('with owner false renders a plain element with no attribute, and loads count on the owner above', () => {
    render(
      <ContentArea as="main" aria-label="Screen">
        <ContentArea as="div" owner={false} aria-label="Plain">
          <Loading />
        </ContentArea>
      </ContentArea>,
    )

    expect(screen.getByLabelText('Plain')).not.toHaveAttribute(CONTENT_AREA.attribute)
    expect(screen.getByLabelText('Plain')).not.toHaveAttribute('aria-busy')
    expect(area()).toHaveAttribute('aria-busy', 'true')
  })
})

describe.each([
  ['', (node: ReactNode) => node],
  ['under StrictMode ', (node: ReactNode) => <StrictMode>{node}</StrictMode>],
])('two overlapping loads %s', (_name, wrap) => {
  test('keep the area busy until the last one ends, the first one ending first', () => {
    const { rerender } = render(wrap(<Screen loads={['a', 'b']} />))
    expect(area()).toHaveAttribute('aria-busy', 'true')

    rerender(wrap(<Screen loads={['b']} />))
    expect(area()).toHaveAttribute('aria-busy', 'true')

    rerender(wrap(<Screen loads={[]} />))
    expect(area()).not.toHaveAttribute('aria-busy')
  })

  test('keep the area busy until the last one ends, the second one ending first', () => {
    const { rerender } = render(wrap(<Screen loads={['a', 'b']} />))

    rerender(wrap(<Screen loads={['a']} />))
    expect(area()).toHaveAttribute('aria-busy', 'true')

    rerender(wrap(<Screen loads={[]} />))
    expect(area()).not.toHaveAttribute('aria-busy')
  })

  test('a load that starts again after the area was ready marks it again', () => {
    const { rerender } = render(wrap(<Screen loads={[]} />))
    expect(area()).not.toHaveAttribute('aria-busy')

    rerender(wrap(<Screen loads={['a']} />))
    expect(area()).toHaveAttribute('aria-busy', 'true')
  })
})

describe('useLoading', () => {
  test('counts only while active', () => {
    const { rerender } = render(
      <ContentArea as="main" aria-label="Screen">
        <Waiting active={false} />
      </ContentArea>,
    )
    expect(area()).not.toHaveAttribute('aria-busy')

    rerender(
      <ContentArea as="main" aria-label="Screen">
        <Waiting active />
      </ContentArea>,
    )
    expect(area()).toHaveAttribute('aria-busy', 'true')
  })

  test('with no owner it does nothing and does not throw', () => {
    render(<Waiting active />)

    expect(document.querySelector('[aria-busy]')).toBeNull()
  })
})

describe('Loading', () => {
  test('still renders the marker the scroll owner waits on', () => {
    const { container } = render(<Loading />)

    expect(container.querySelector(LOADING_MARKER)).not.toBeNull()
  })

  test('with no owner renders its progressbar and nothing becomes busy', () => {
    const { container } = render(<Loading />)

    expect(screen.getByRole('progressbar', { name: 'Loading' })).toBeInTheDocument()
    expect(container.querySelectorAll('[aria-busy]')).toHaveLength(1)
  })

  test('LoadingAnuncio marks the area, and compacto does not', () => {
    const { rerender } = render(
      <ContentArea as="main" aria-label="Screen">
        <Loading compacto />
      </ContentArea>,
    )
    expect(area()).not.toHaveAttribute('aria-busy')

    rerender(
      <ContentArea as="main" aria-label="Screen">
        <LoadingAnuncio />
      </ContentArea>,
    )
    expect(area()).toHaveAttribute('aria-busy', 'true')
  })
})

describe('Sheet', () => {
  function renderSheet(options: { computer: boolean; form: ReactNode; aside?: ReactNode; under?: ReactNode }) {
    return render(
      <>
        <ContentArea as="main" aria-label="Screen">
          {options.under}
        </ContentArea>
        <Sheet
          computer={options.computer}
          computerClass="pantalla cobro-modal"
          computerDialog={false}
          label="A form"
          touched={false}
          onClose={() => undefined}
          aside={options.aside}
        >
          {options.form}
        </Sheet>
      </>,
    )
  }

  test('over a loaded screen marks only the sheet body', () => {
    stubViewport('phone')
    renderSheet({ computer: false, form: <Loading /> })

    expect(screen.getByRole('dialog', { name: 'A form' })).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('dialog', { name: 'A form' })).toHaveAttribute(CONTENT_AREA.attribute)
    expect(area()).not.toHaveAttribute('aria-busy')
  })

  test('over a loading screen: each owner is busy only from its own count', () => {
    stubViewport('phone')
    const { rerender } = renderSheet({ computer: false, form: <p>Ready</p>, under: <Loading /> })

    expect(screen.getByRole('dialog', { name: 'A form' })).not.toHaveAttribute('aria-busy')
    expect(area()).toHaveAttribute('aria-busy', 'true')

    rerender(
      <>
        <ContentArea as="main" aria-label="Screen">
          <Loading />
        </ContentArea>
        <Sheet
          computer={false}
          computerClass="pantalla cobro-modal"
          computerDialog={false}
          label="A form"
          touched={false}
          onClose={() => undefined}
        >
          <Loading />
        </Sheet>
      </>,
    )
    expect(screen.getByRole('dialog', { name: 'A form' })).toHaveAttribute('aria-busy', 'true')
  })

  test('on a phone the frame is not an owner: only the body carries the attribute', () => {
    stubViewport('phone')
    const { container } = renderSheet({ computer: false, form: <Loading /> })

    const owners = container.querySelectorAll(CONTENT_AREA.any)
    expect(owners).toHaveLength(2)
    expect(container.querySelectorAll(CONTENT_AREA.modal)).toHaveLength(1)
  })

  test('on a computer the frame is the owner and the body is not', () => {
    stubViewport('computer')
    renderSheet({ computer: true, form: <Loading /> })

    const frames = screen.getAllByRole('main')
    const frame = frames.find((node) => node.classList.contains('cobro-modal'))
    expect(frame).toHaveAttribute('aria-busy', 'true')
    expect(frame).toHaveAttribute(CONTENT_AREA.attribute)
    const body = frame?.firstElementChild
    expect(body).not.toHaveAttribute(CONTENT_AREA.attribute)
    expect(body).not.toHaveAttribute('aria-busy')
  })

  test('a Loading in the aside never marks the sheet', () => {
    stubViewport('phone')
    renderSheet({ computer: false, form: <p>Ready</p>, aside: <Loading /> })

    expect(screen.getByRole('dialog', { name: 'A form' })).not.toHaveAttribute('aria-busy')
  })

  test('crossing 900 px keeps the load counted by whoever owns the area then', () => {
    stubViewport('phone')
    const { rerender } = renderSheet({ computer: false, form: <Loading /> })
    expect(screen.getByRole('dialog', { name: 'A form' })).toHaveAttribute('aria-busy', 'true')

    flipViewport('computer')
    rerender(
      <>
        <ContentArea as="main" aria-label="Screen" />
        <Sheet
          computer
          computerClass="pantalla cobro-modal"
          computerDialog={false}
          label="A form"
          touched={false}
          onClose={() => undefined}
        >
          <Loading />
        </Sheet>
      </>,
    )

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getAllByRole('main').some((node) => node.getAttribute('aria-busy') === 'true')).toBe(true)
  })
})
