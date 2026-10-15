/**
 * `scanControls` (GH-102): one fixture per `className` shape it reads, one per shape it must
 * reject, and the real sources.
 */

import { expect, test } from 'vitest'
import { productSources, scanControls } from './controlScan'

function scan(source: string, path = 'src/Fixture.tsx') {
  return scanControls([{ path, source }])
}

test('a string literal className on a button', () => {
  const result = scan(`export default function A() {
  return <button type="button" className="boton boton--suave">x</button>
}`)
  expect(result.errors).toEqual([])
  expect(result.controls).toEqual([
    { file: 'src/Fixture.tsx', line: 2, tag: 'button', classes: ['boton', 'boton--suave'] },
  ])
})

test('a tag that spans several lines, and every kind of link, is a control', () => {
  const result = scan(`export default function A() {
  return (
    <nav>
      <a
        href="/x"
        className="uno"
      >x</a>
      <Link to="/y" className="dos">y</Link>
      <NavLink to="/z" className="tres">z</NavLink>
      <InAppLink to="/w" className="cuatro">w</InAppLink>
    </nav>
  )
}`)
  expect(result.errors).toEqual([])
  expect(result.controls.map((control) => [control.tag, control.line, control.classes])).toEqual([
    ['a', 4, ['uno']],
    ['Link', 8, ['dos']],
    ['NavLink', 9, ['tres']],
    ['InAppLink', 10, ['cuatro']],
  ])
})

test('a ternary of literals takes every branch', () => {
  const result = scan(`export default function A({ on }: { on: boolean }) {
  return <button className={on ? 'opcion opcion--activa' : 'opcion'}>x</button>
}`)
  expect(result.errors).toEqual([])
  expect(result.controls[0]?.classes).toEqual(['opcion', 'opcion--activa'])
})

test('an && of literals takes the class side', () => {
  const result = scan(`export default function A({ on }: { on: boolean }) {
  return <button className={on && 'prendido'}>x</button>
}`)
  expect(result.errors).toEqual([])
  expect(result.controls[0]?.classes).toEqual(['prendido'])
})

test('a map constant of the same file: every literal of its body', () => {
  const result = scan(`const CLASS: Record<string, string> = { a: 'boton', b: 'boton boton--suave' }
export default function A({ v }: { v: string }) {
  return <button className={CLASS[v]}>x</button>
}`)
  expect(result.errors).toEqual([])
  expect(result.controls[0]?.classes).toEqual(['boton', 'boton--suave'])
})

test('a helper function of the same file, ignoring the literals it compares with', () => {
  const result = scan(`function railClassName(group: string, active: boolean): string {
  const base = group === 'more' ? 'item item--secundario' : 'item'
  return active ? \`\${base} item--activo\` : base
}
export default function A() {
  return <Link to="/x" className={railClassName('a', true)}>x</Link>
}`)
  expect(result.errors).toEqual([])
  expect(result.controls[0]?.classes).toEqual(['item', 'item--secundario', 'item--activo'])
})

test('a template literal reads its static whole tokens', () => {
  const result = scan(`export default function A({ x }: { x: string }) {
  return <button className={\`boton \${x} boton--suave\`}>x</button>
}`)
  expect(result.errors).toEqual([])
  expect(result.controls[0]?.classes).toEqual(['boton', 'boton--suave'])
})

test('a template literal with ${} inside a token is an error with file:line', () => {
  const result = scan(`export default function A({ x }: { x: string }) {
  return <button className={\`boton boton--\${x}\`}>x</button>
}`)
  expect(result.errors).toHaveLength(1)
  expect(result.errors[0]).toMatch(/^src\/Fixture\.tsx:2 .*\$\{\}/)
})

test('an element with a control role is a control, any tag', () => {
  const result = scan(`export default function A() {
  return (
    <div>
      <div role="tab" className="pestana" />
      <span role="radio" className="radio" />
      <input role="switch" className="interruptor" />
      <div role="group" className="grupo" />
    </div>
  )
}`)
  expect(result.errors).toEqual([])
  expect(result.controls.map((control) => control.classes)).toEqual([['pestana'], ['radio'], ['interruptor']])
})

test('a wrapper: its call sites are the controls, its inner tag is not reported', () => {
  const result = scanControls([
    {
      path: 'src/Chip.tsx',
      source: `export default function Chip({ className, children }: { className: string; children: string }) {
  return <button type="button" className={className}>{children}</button>
}`,
    },
    {
      path: 'src/Use.tsx',
      source: `import Chip from './Chip'
export default function Use() {
  return <Chip className="chip chip--activo">x</Chip>
}`,
    },
  ])
  expect(result.errors).toEqual([])
  expect(result.controls).toEqual([
    { file: 'src/Use.tsx', line: 3, tag: 'Chip', classes: ['chip', 'chip--activo'] },
  ])
})

test('a wrapper that spreads its props is a wrapper too', () => {
  const result = scanControls([
    {
      path: 'src/Enlace.tsx',
      source: `export default function Enlace(props: object) {
  return <Link {...props} state={1} />
}`,
    },
    {
      path: 'src/Use.tsx',
      source: `export default function Use() {
  return <Enlace to="/x" className="enlace" />
}`,
    },
  ])
  expect(result.errors).toEqual([])
  expect(result.controls).toEqual([{ file: 'src/Use.tsx', line: 2, tag: 'Enlace', classes: ['enlace'] }])
})

test('an unreadable className expression is an error with file:line', () => {
  const result = scan(`export default function A({ cls }: { cls: string }) {
  return (
    <button
      className={cls}
    >x</button>
  )
}`)
  expect(result.errors).toHaveLength(1)
  expect(result.errors[0]).toMatch(/^src\/Fixture\.tsx:4 className expression cannot be read: cls/)
})

test('an onClick on a div is an error; a handler on a control or a defined component is not', () => {
  const result = scan(`function Tarjeta({ onClick }: { onClick: () => void }) {
  return <button className="tarjeta" onClick={onClick}>x</button>
}
export default function A() {
  return (
    <div>
      <div className="falso" onClick={() => undefined}>x</div>
      <Tarjeta onClick={() => undefined} />
      <button className="ok" onClick={() => undefined}>y</button>
    </div>
  )
}`)
  expect(result.errors).toEqual(['src/Fixture.tsx:7 onClick on <div>, which is not a control'])
})

test('onPointerDown and onMouseDown on a non-control are errors too', () => {
  const result = scan(`export default function A() {
  return (
    <section>
      <li onPointerDown={() => undefined}>x</li>
      <p onMouseDown={() => undefined}>y</p>
    </section>
  )
}`)
  expect(result.errors).toEqual([
    'src/Fixture.tsx:4 onPointerDown on <li>, which is not a control',
    'src/Fixture.tsx:5 onMouseDown on <p>, which is not a control',
  ])
})

test('comments and generics are not tags', () => {
  const result = scan(`// <button className={nope}>
/* <a className={nope}> */
export default function A() {
  const ref = useRef<HTMLButtonElement>(null)
  const list: Array<string> = []
  return <button ref={ref} className="real">{list.length < 3 ? 'a' : 'b'}</button>
}`)
  expect(result.errors).toEqual([])
  expect(result.controls.map((control) => control.classes)).toEqual([['real']])
})

test('the real sources scan with no errors and find the controls the issue names', () => {
  const result = scanControls(productSources())
  expect(result.errors).toEqual([])
  const classes = new Set(result.controls.flatMap((control) => control.classes))
  for (const name of [
    'ajustes__item',
    'ajustes-tema__opcion',
    'ajustes-tema__opcion--activa',
    'riel-lateral__negocio',
    'riel-lateral__negocio--activo',
  ]) {
    expect(classes.has(name), name).toBe(true)
  }
})

test('a className constant imported from another file is read there, and an unreadable one is an error', () => {
  const files = [
    { path: 'src/clases.tsx', source: "export const CLASE_UNA = 'fija fija--grande'\nexport const CLASE_DOS = cond ? 'a' : 'b'" },
    {
      path: 'src/shell/Uso.tsx',
      source: `import { CLASE_UNA } from '../clases'
export default function Uso() {
  return <button className={CLASE_UNA}>x</button>
}`,
    },
  ]
  const found = scanControls(files)
  expect(found.errors).toEqual([])
  expect(found.controls.map((control) => control.classes)).toEqual([['fija', 'fija--grande']])

  const missing = scanControls([
    files[1] ?? { path: '', source: '' },
  ])
  expect(missing.errors).toEqual(['src/shell/Uso.tsx:3 className expression cannot be read: CLASE_UNA'])

  const notImported = scanControls([
    files[0] ?? { path: '', source: '' },
    { path: 'src/shell/Otro.tsx', source: "export default function Otro() {\n  return <button className={CLASE_UNA}>x</button>\n}" },
  ])
  expect(notImported.errors).toEqual(['src/shell/Otro.tsx:2 className expression cannot be read: CLASE_UNA'])
})

const VISUAL = [
  {
    path: 'src/components/botonVisual.tsx',
    source: "const CLASS = {\n  primary: 'boton',\n  secondary: 'boton boton--suave',\n  link: 'boton--enlace',\n} as const",
  },
  {
    path: 'src/components/Boton.tsx',
    source: 'export default function Boton(props: object) {\n  const { className } = botonVisual(props)\n  return <button className={className} />\n}',
  },
]

function useBoton(markup: string): ReturnType<typeof scanControls> {
  return scanControls([
    ...VISUAL,
    { path: 'src/Pantalla.tsx', source: `export default function Pantalla() {\n  return ${markup}\n}` },
  ])
}

test('a Boton call site draws the classes of its variant, primary when it names none', () => {
  const found = useBoton('<div><Boton>a</Boton><Boton variant="secondary">b</Boton><Boton variant={x ? \'link\' : \'primary\'}>c</Boton></div>')
  expect(found.errors).toEqual([])
  expect(found.controls.map((control) => control.classes)).toEqual([
    ['boton'],
    ['boton', 'boton--suave'],
    ['boton--enlace', 'boton'],
  ])
})

test('a Boton variant the table does not have, or one that cannot be read, is an error', () => {
  expect(useBoton('<Boton variant="inventada">a</Boton>').errors).toEqual([
    'src/Pantalla.tsx:2 variant "inventada" is not in botonVisual\'s table',
  ])
  expect(useBoton('<Boton variant={elegida}>a</Boton>').errors).toEqual(['src/Pantalla.tsx:2 variant cannot be read'])
})

const BACK_BUTTON = {
  path: 'src/components/BackButton.tsx',
  source: 'export default function BackButton(props: object) {\n  const className = botonClass(props)\n  return <button className={className} />\n}',
}

test('a BackButton call site draws the classes of the back variant', () => {
  const found = scanControls([
    {
      path: 'src/components/botonVisual.tsx',
      source: "const CLASS = {\n  primary: 'boton',\n  back: 'boton--enlace',\n} as const",
    },
    BACK_BUTTON,
    { path: 'src/shell/Flecha.tsx', source: 'export default function Flecha() {\n  return <BackButton title="x" onClick={go} />\n}' },
  ])
  expect(found.errors).toEqual([])
  expect(found.controls.map((control) => control.classes)).toEqual([['boton--enlace']])
})

test('a BackButton call site is an error when the table has no back variant', () => {
  const found = scanControls([
    { path: 'src/components/botonVisual.tsx', source: "const CLASS = {\n  primary: 'boton',\n} as const" },
    BACK_BUTTON,
    { path: 'src/shell/Flecha.tsx', source: 'export default function Flecha() {\n  return <BackButton title="x" onClick={go} />\n}' },
  ])
  expect(found.errors).toEqual(['src/shell/Flecha.tsx:2 variant "back" is not in botonVisual\'s table'])
})
