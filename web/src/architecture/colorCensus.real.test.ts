/** The color census over the real `app.css`: a rule using a state color with no listed word fails here. */

import { expect, test } from 'vitest'
import appCss from '../styles/app.css?raw'
import { checkColorCensus, COLOR_CENSUS } from './colorCensus'

const testModules = import.meta.glob('/src/**/*.test.tsx')
const testFiles = Object.keys(testModules).map((path) => path.replace(/^\//, ''))

test('every app.css rule using a state color is listed with the word, sign or arrow it carries', () => {
  expect(testFiles.length).toBeGreaterThan(50)
  expect(checkColorCensus(appCss, COLOR_CENSUS, testFiles)).toEqual([])
})

test('no rule of app.css uses --positivo or --negativo, and none is listed', () => {
  expect(appCss).not.toMatch(/--(?:positivo|negativo)(?![\w-])/)
})
