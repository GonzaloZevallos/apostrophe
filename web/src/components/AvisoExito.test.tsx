import { act, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { applyShownLanguage, resetToBootLanguage, setLocaleLoader } from '../i18n/language'
import { clearMissingKeys, missingKeys } from '../i18n/missingKeys'
import { loadLocale } from '../i18n/resources'
import { addFixtureNamespace, removeFixtureNamespace } from '../i18n/testing'
import AvisoExito from './AvisoExito'

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
