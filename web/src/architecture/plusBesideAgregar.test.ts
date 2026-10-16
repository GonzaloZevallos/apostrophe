/**
 * The double-plus guard on input it must reject and input it must accept
 * (icon-and-text-rule.md: the `agregar` icon draws the plus, so no visible literal "+"
 * stands beside it). The real tree is in `plusBesideAgregar.real.test.ts`.
 */

import { expect, test } from 'vitest'
import { findPlusBesideAgregar } from './plusBesideAgregar'

function find(content: string): string[] {
  return findPlusBesideAgregar([{ path: 'a.tsx', content }])
}

test('a visible "+" in the text of a control with the agregar icon is found', () => {
  expect(find('<BotonLink to={x} icon="agregar">\n  + Entrada\n</BotonLink>')).toEqual([
    'a.tsx:2: visible "+" beside the agregar icon',
  ])
  expect(find("<Boton icon=\"agregar\" onClick={() => go()}>{'+ Cargar'}</Boton>")).toHaveLength(1)
  expect(find('<Boton icon="agregar">{`+ ${name}`}</Boton>')).toHaveLength(1)
})

test('a visible "+" in the label, title or detail of an object whose icon is agregar is found', () => {
  expect(find("const a = { to: x, label: '+ Cargar gasto', icon: 'agregar' }")).toHaveLength(1)
  expect(find("const a = { icon: 'agregar', title: \"+ Algo\" }")).toHaveLength(1)
  expect(find("const a = {\n  detail: `+ ${x}`,\n  icon: 'agregar',\n}")).toHaveLength(1)
})

test('the accessible name may keep the "+", and a control with no plus beside the icon passes', () => {
  expect(find('<BotonLink icon="agregar" ariaLabel="+ Entrada">Entrada</BotonLink>')).toEqual([])
  expect(
    find("const a = { label: 'Cargar gasto', icon: 'agregar', ariaLabel: '+ Cargar gasto' }"),
  ).toEqual([])
  expect(find('<Boton icon="agregar" onClick={() => setN(n + 1)}>Sumar</Boton>')).toEqual([])
  expect(find("const a = { label: '+ Otro', icon: 'gastos' }")).toEqual([])
  expect(find('<Boton icon="telegram">+ Otro</Boton>')).toEqual([])
})
