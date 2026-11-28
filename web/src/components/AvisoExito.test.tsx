import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'
import { applyShownLanguage, resetToBootLanguage, setLocaleLoader } from '../i18n/language'
import { clearMissingKeys, missingKeys } from '../i18n/missingKeys'
import { loadLocale } from '../i18n/resources'
import { addFixtureNamespace, removeFixtureNamespace } from '../i18n/testing'
import AvisoExito, { SaleSavedToast } from './AvisoExito'

afterEach(async () => {
  await act(async () => {
    await applyShownLanguage('en')
  })
  removeFixtureNamespace('common', 'de')
  setLocaleLoader(loadLocale)
  resetToBootLanguage()
  clearMissingKeys()
})

test('announces the fixed toast text as a status, with no close or undo action', () => {
  render(<AvisoExito texto="Price saved" />)

  const status = screen.getByRole('status')
  expect(status).toHaveTextContent('Price saved')
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

test('resolves a common: toast key to its English text', () => {
  render(<AvisoExito texto="common:entryDeleted" />)

  expect(screen.getByRole('status')).toHaveTextContent('Entry deleted')
  expect(screen.queryByText('common:entryDeleted')).not.toBeInTheDocument()
})

test('a language switch re-renders the toast text in the same node, with no remount', async () => {
  render(<AvisoExito texto="common:entryDeleted" />)
  const status = screen.getByRole('status')
  const text = status.querySelector('.aviso-exito__texto') as HTMLElement
  expect(text).toHaveTextContent('Entry deleted')
  addFixtureNamespace('common', { entryDeleted: 'de:entryDeleted' }, 'de')
  setLocaleLoader(() => Promise.resolve({}))

  clearMissingKeys()
  await act(async () => {
    await applyShownLanguage('de')
  })

  expect(text).toHaveTextContent('de:entryDeleted')
  expect(screen.getByRole('status')).toBe(status)
  expect(status.contains(text)).toBe(true)
  expect(status).not.toHaveTextContent('Entry deleted')
  expect(missingKeys().filter((miss) => miss.ns === 'common')).toEqual([])
})

const APP_CSS = import.meta.glob('/src/styles/app.css', { query: '?raw', import: 'default', eager: true })['/src/styles/app.css']

function ruleBody(css: string, selector: string): string {
  const start = css.indexOf(`\n${selector} {`)
  if (start < 0) throw new Error(`no rule for ${selector}`)
  return css.slice(start, css.indexOf('}', start))
}

describe.each(['en', 'en-XA'])('SaleSavedToast in %s', (tag) => {
  afterEach(async () => {
    await act(async () => {
      await applyShownLanguage('en')
    })
    resetToBootLanguage()
  })

  test('the status holds three non-empty spans with the name in the middle one, the button sits outside it', async () => {
    await act(async () => {
      await applyShownLanguage(tag)
    })
    render(<SaleSavedToast name="Ana" onUndo={() => {}} />)

    const status = screen.getByRole('status')
    const spans = [...status.querySelectorAll(':scope > span')]
    expect(spans).toHaveLength(3)
    for (const span of spans) expect(span.textContent).not.toBe('')
    expect(spans[1]).toHaveTextContent('Ana')
    expect(screen.getByRole('button')).toBeInTheDocument()
    expect(status).not.toContainElement(screen.getByRole('button'))
    if (tag === 'en') {
      expect(status.textContent).toBe('Sale to Ana saved')
      expect(screen.getByRole('button')).toHaveTextContent('Undo')
    }
  })
})

test('a 60-character name keeps "saved" and "Undo" whole, in their own non-shrinking spans', () => {
  const name = 'N'.repeat(60)
  render(<SaleSavedToast name={name} onUndo={() => {}} />)

  const status = screen.getByRole('status')
  expect(status.textContent).toBe(`Sale to ${name} saved`)
  expect(screen.getByText('saved')).toBeInTheDocument()
  expect(screen.getByText('Sale to')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Undo' })).toHaveTextContent(/^Undo$/)
  const inicio = ruleBody(APP_CSS as string, '.aviso-exito__inicio,\n.aviso-exito__fin')
  expect(inicio).toContain('flex: none')
  const nombre = ruleBody(APP_CSS as string, '.aviso-exito__nombre')
  expect(nombre).toContain('text-overflow: ellipsis')
  expect(nombre).toContain('min-width: 0')
  expect(nombre).toContain('white-space: nowrap')
})

test('without an action there is no button, and the text is still exact', () => {
  render(<SaleSavedToast name="Ana" />)

  expect(screen.queryByRole('button')).not.toBeInTheDocument()
  expect(screen.getByRole('status').textContent).toBe('Sale to Ana saved')
})

test('the Undo button is at least 44 px and takes pointer events back from the floating layer', () => {
  const body = ruleBody(APP_CSS as string, '.aviso-exito__deshacer')

  expect(body).toContain('min-height: 44px')
  expect(body).toContain('min-width: 44px')
  expect(body).toContain('pointer-events: auto')
})
