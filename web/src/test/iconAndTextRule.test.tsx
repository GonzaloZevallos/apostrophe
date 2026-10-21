/**
 * `expectIconAndTextRule` at its seam: it accepts what the rule allows and, on each
 * clause, rejects input that breaks it.
 */

import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, test } from 'vitest'
import Boton from '../components/Boton'
import BotonLink from '../components/BotonLink'
import ConfirmDialog from '../components/ConfirmDialog'
import Icono from '../components/Icono'
import { expectIconAndTextRule, iconAndTextProblems } from './iconAndTextRule'

function problemsOf(node: React.ReactElement, options = {}) {
  const { container } = render(<MemoryRouter>{node}</MemoryRouter>)
  return iconAndTextProblems(container, options)
}

test('what the rule allows passes: every kind, the answers, an icon-only control', () => {
  const { container } = render(
    <MemoryRouter>
      <Boton variant="secondary" icon="agregar">
        Nueva entrada
      </Boton>
      <Boton textOnly="submit" type="submit">
        Guardá la venta
      </Boton>
      <Boton variant="link">Ver todas</Boton>
      <Boton variant="undo">Deshacer</Boton>
      <Boton variant="back">‹ Ventas</Boton>
      <Boton variant="notice">
        Seguí con la configuración
        <Icono nombre="atras" />
      </Boton>
      <BotonLink to="/n" variant="notice">
        Falta el stock
      </BotonLink>
      <Boton variant="icon" action="delete" ariaLabel="Borrar venta" />
      <BotonLink to="/x" variant="icon" action="search" ariaLabel="Buscar" />
      <ConfirmDialog
        title="¿Borrar?"
        detail="Se borra."
        confirmText="Sí, borrá"
        cancelText="No, dejá"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    </MemoryRouter>,
  )
  expectIconAndTextRule(container)
})

test('a control with no name is rejected', () => {
  expect(problemsOf(<button type="button" />)).toEqual([
    expect.stringContaining('has no accessible name'),
    expect.stringContaining('not an icon-only control'),
  ])
})

test('an icon next to a word that is announced is rejected', () => {
  const problems = problemsOf(
    <button type="button" className="boton">
      <Icono nombre="agregar" label="Agregar" />
      Nueva entrada
    </button>,
  )
  expect(problems).toEqual([expect.stringContaining('not aria-hidden')])
})

test('a word-less control that is not the icon-only one is rejected', () => {
  const problems = problemsOf(
    <button type="button" className="boton" aria-label="Borrar">
      <Icono nombre="tacho" />
    </button>,
  )
  expect(problems).toEqual([expect.stringContaining('not an icon-only control')])
})

test('a text-only action outside the closed kinds is rejected, unless it is an answer', () => {
  expect(
    problemsOf(
      <button type="button" className="boton boton--suave">
        Publicar
      </button>,
    ),
  ).toEqual([expect.stringContaining('text only but is not a submit')])
  expect(
    problemsOf(
      <button type="button" className="pestana">
        Hoy
      </button>,
      { optionClasses: ['pestana'] },
    ),
  ).toEqual([])
})

test('two entries of one menu with the same icon are rejected', () => {
  const problems = problemsOf(
    <nav data-menu>
      <Boton variant="secondary" icon="inicio">
        Inicio
      </Boton>
      <Boton variant="secondary" icon="inicio">
        Ventas
      </Boton>
    </nav>,
  )
  expect(problems).toEqual([expect.stringContaining('shares its icon with "Home"')])
})

test('a data-copy text over its limit, measured with the samples, is rejected', () => {
  const node = <p data-copy="help">Cargá hasta {'{gramos}'} g</p>
  expect(problemsOf(node, { limits: { help: 20 }, samples: { gramos: '1.000.000,00' } })).toEqual([
    expect.stringContaining('over the 20 of "help"'),
  ])
  expect(problemsOf(node, { limits: { help: 40 }, samples: { gramos: '1.000.000,00' } })).toEqual([])
})

test('a notice whose accessible name differs from its visible text is rejected', () => {
  const problems = problemsOf(
    <button type="button" className="boton-aviso" aria-label="Otra cosa">
      Seguí con la configuración
    </button>,
  )
  expect(problems).toEqual([expect.stringContaining('notice must be named by its visible text')])
})
