/** This module owns the one `theme-color` meta; `../theme` writes the attribute it follows. */

import { afterEach, beforeEach, expect, test } from 'vitest'
import { chooseTheme, startAutomatic } from '../theme'
import { startThemeSync, syncStatusBar } from './theme'

const LIGHT = 'paper-light'
const DARK = 'paper-dark'

function meta(): HTMLMetaElement {
  const found = document.head.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (found === null) throw new Error('the test meta is missing')
  return found
}

/** The reader a stylesheet would be: the dark value only while the attribute is on. */
function readFromAttribute(): string {
  return document.documentElement.dataset.tema === 'oscuro' ? DARK : LIGHT
}

/** Lets the MutationObserver's microtask run. */
async function settle(): Promise<void> {
  await Promise.resolve()
}

let stop: () => void = () => undefined

function reset(): void {
  chooseTheme('claro')
  localStorage.clear()
  document.documentElement.removeAttribute('data-tema')
}

beforeEach(() => {
  document.head.innerHTML = '<meta name="theme-color" content="initial">'
  reset()
})

afterEach(() => {
  stop()
  stop = () => undefined
  document.head.innerHTML = ''
  reset()
})

test('syncStatusBar writes what the reader returns into the meta', () => {
  syncStatusBar(() => LIGHT)
  expect(meta().content).toBe(LIGHT)
})

test('syncStatusBar never writes an empty value, and a later non-empty read writes it', () => {
  syncStatusBar(() => '')
  expect(meta().content).toBe('initial')

  syncStatusBar(() => DARK)
  expect(meta().content).toBe(DARK)
})

test('startThemeSync syncs the attribute already on the page at start', () => {
  document.documentElement.dataset.tema = 'oscuro'
  stop = startThemeSync(readFromAttribute)
  expect(meta().content).toBe(DARK)
})

test('the meta follows the attribute set, removed and set again, whoever changes it', async () => {
  stop = startThemeSync(readFromAttribute)
  expect(meta().content).toBe(LIGHT)

  document.documentElement.dataset.tema = 'oscuro'
  await settle()
  expect(meta().content).toBe(DARK)

  document.documentElement.removeAttribute('data-tema')
  await settle()
  expect(meta().content).toBe(LIGHT)

  chooseTheme('oscuro')
  await settle()
  expect(meta().content).toBe(DARK)
})

test('the meta follows a live flip of the phone while the theme is on Automatic', async () => {
  let phoneIsDark = false
  let flip: () => void = () => undefined
  startAutomatic({
    isDark: () => phoneIsDark,
    onChange(cb) {
      flip = cb
      return () => undefined
    },
  })
  stop = startThemeSync(readFromAttribute)
  expect(meta().content).toBe(LIGHT)

  phoneIsDark = true
  flip()
  await settle()
  expect(meta().content).toBe(DARK)

  phoneIsDark = false
  flip()
  await settle()
  expect(meta().content).toBe(LIGHT)
})

test('startThemeSync syncs once more when the window has loaded', () => {
  let papel = ''
  stop = startThemeSync(() => papel)
  expect(meta().content).toBe('initial')

  papel = LIGHT
  window.dispatchEvent(new Event('load'))
  expect(meta().content).toBe(LIGHT)
})

test('after stopping, the attribute no longer moves the meta', async () => {
  stop = startThemeSync(readFromAttribute)
  stop()
  document.documentElement.dataset.tema = 'oscuro'
  await settle()
  expect(meta().content).toBe(LIGHT)
})
