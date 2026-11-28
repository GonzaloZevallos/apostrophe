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

test("--positivo and --negativo are used once in app.css: the sale detail's Void button text, listed in the census", () => {
  expect(appCss.match(/--(?:positivo|negativo)(?![\w-])/g)).toEqual(['--negativo'])
  expect(COLOR_CENSUS.map(({ selector }) => selector)).toContain('.venta-detalle__botones .boton')
})
