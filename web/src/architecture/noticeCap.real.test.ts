/** `checkNoticeCap` over the real `app.css`: the notice card's 560px cap on a computer (GH-188). */

import { expect, test } from 'vitest'
import { checkNoticeCap } from './noticeCap'

const files = import.meta.glob('/src/styles/app.css', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

test('app.css caps .boton-aviso once, at 560px, inside the 900px block', () => {
  const css = files['/src/styles/app.css']
  if (css === undefined) throw new Error('app.css was not loaded')
  expect(checkNoticeCap(css)).toEqual([])
})
