/** Each closing guard is fed input it must reject, and input it must accept. */

import { describe, expect, test } from 'vitest'
import {
  ENTRY_CLASSES,
  findActionLinks,
  findBotonClasses,
  findLinkAliases,
  findRawButtons,
  findRawSvg,
  findUnusedIcons,
  listedIcons,
} from './closingGuards'

const ICONO = `export const ICON_NAMES = [
  'inicio',
  'tacho',
  'buscar',
  'info',
  'atencion',
] as const`
const VISUAL = `const ACTION_ICON: Record<IconOnlyAction, NombreIcono> = {
  delete: 'tacho',
  search: 'buscar',
}`

describe('findRawSvg', () => {
  test('rejects an <svg> outside Icono and accepts Icono, tests and plain components', () => {
    const files = [
      { path: '/src/screens/Ventas.tsx', content: 'return <svg viewBox="0 0 1 1" />' },
      { path: '/src/components/Icono.tsx', content: 'return <svg viewBox="0 0 22 22" />' },
      { path: '/src/screens/Ventas.test.tsx', content: '<svg>' },
      { path: '/src/screens/Clientes.tsx', content: 'return <Icono nombre="inicio" />' },
    ]
    expect(findRawSvg(files)).toEqual(['/src/screens/Ventas.tsx: draws an <svg> itself, use Icono'])
  })
})

describe('findRawButtons', () => {
  const screen = (content: string) => [{ path: '/src/screens/X.tsx', content }]

  test('rejects a button that looks like an action, with or without a class, in screens and the shell', () => {
    expect(findRawButtons(screen('<button type="button" className="boton" onClick={() => go()}>Ir</button>'))).toHaveLength(1)
    expect(findRawButtons(screen('<button onClick={() => go()}>Ir</button>'))).toHaveLength(1)
    expect(findRawButtons([{ path: '/src/shell/Y.tsx', content: '<button className="x">a</button>' }])).toHaveLength(1)
  })

  test('accepts the closed option and row classes, a switch and a radio, even with a dynamic class', () => {
    const accepted = [
      '<button type="button" className="pildora">a</button>',
      `<button className={on ? 'periodos__boton periodos__boton--activo' : 'periodos__boton'} onClick={() => set(1)}>a</button>`,
      '<button className="fila-gasto">a</button>',
      '<button className="x" role="switch" aria-checked>a</button>',
      '<button role="radio">a</button>',
    ]
    for (const content of accepted) expect(findRawButtons(screen(content))).toEqual([])
  })

  test('reads past an arrow function in an attribute and finds the line', () => {
    const found = findRawButtons(screen('\n\n<button\n  onClick={() => a()}\n  className="boton-enlace"\n>a</button>'))
    expect(found).toEqual(['/src/screens/X.tsx:3: a raw <button> that is not an option or a row, use Boton'])
  })

  test('ignores a button outside screens and shell', () => {
    expect(findRawButtons([{ path: '/src/components/Boton.tsx', content: '<button className="boton">' }])).toEqual([])
  })
})

describe('findBotonClasses', () => {
  test('rejects a boton* class outside Boton and BotonLink, and accepts their authors and look-alikes', () => {
    const files = [
      { path: '/src/screens/A.tsx', content: 'const c = "boton boton--suave"' },
      { path: '/src/shell/B.tsx', content: "className={`boton-nueva-venta`}" },
      { path: '/src/components/Boton.tsx', content: 'const c = "boton"' },
      { path: '/src/components/botonVisual.tsx', content: "const c = 'boton--enlace'" },
      { path: '/src/components/AnswerButton.tsx', content: "const c = 'boton boton--suave'" },
      { path: '/src/screens/C.tsx', content: 'const c = "botones-extra"; import Boton from "./Boton"' },
      { path: '/src/screens/A.test.tsx', content: 'const c = "boton"' },
    ]
    expect(findBotonClasses(files).map((line) => line.split(':').slice(0, 2).join(':'))).toEqual([
      '/src/screens/A.tsx:1',
      '/src/screens/A.tsx:1',
      '/src/shell/B.tsx:1',
    ])
  })
})

describe('findUnusedIcons', () => {
  const base = [
    { path: '/src/components/Icono.tsx', content: ICONO },
    { path: '/src/components/botonVisual.tsx', content: VISUAL },
  ]

  test('reads the names Icono lists', () => {
    expect(listedIcons(ICONO)).toEqual(['inicio', 'tacho', 'buscar', 'info', 'atencion'])
  })

  test('rejects every name no screen uses, an action nobody passes, and info and atencion without a caller', () => {
    const files = [...base, { path: '/src/screens/A.tsx', content: '<Icono nombre="inicio" />' }]
    expect(findUnusedIcons(files).map((line) => line.split(':')[0])).toEqual(['tacho', 'buscar', 'info', 'atencion'])
  })

  test('accepts a name written by a screen, an action a screen passes, MasInfo and attention callers', () => {
    const files = [
      ...base,
      { path: '/src/screens/A.tsx', content: '<Icono nombre="inicio" /><Boton variant="icon" action="delete" ariaLabel="Borrar" />' },
      { path: '/src/screens/B.tsx', content: '<Boton variant="icon" action={"search"} /><MasInfo>x</MasInfo>' },
      { path: '/src/shell/C.tsx', content: '<Notice attention>x</Notice>' },
    ]
    expect(findUnusedIcons(files)).toEqual([])
  })

  test('does not count a route key, a label or a comment that merely equals a name', () => {
    const files = [
      ...base,
      { path: '/src/screens/A.tsx', content: "const KEY = 'inicio'\nconst LABEL = ['tacho', 'buscar']" },
      { path: '/src/screens/B.tsx', content: "// <Icono nombre=\"info\" /> and nombre: 'atencion' in a comment" },
    ]
    expect(findUnusedIcons(files)).toHaveLength(5)
  })

  test('counts a name given as an icon on a line, in a map or a ternary', () => {
    const files = [
      ...base,
      { path: '/src/shell/A.tsx', content: "{ to: HOME, icon: 'inicio' }\n<Icono nombre={on ? 'tacho' : 'buscar'} />" },
    ]
    expect(findUnusedIcons(files).map((line) => line.split(':')[0])).toEqual(['info', 'atencion'])
  })

  test('does not count a name only Icono or Boton write', () => {
    const files = [
      ...base,
      { path: '/src/components/Boton.tsx', content: "'inicio' 'tacho' 'buscar' 'info' 'atencion'" },
    ]
    expect(findUnusedIcons(files)).toHaveLength(5)
  })
})

describe('findActionLinks', () => {
  const at = (content: string, path = '/src/screens/X.tsx') => [{ path, content }]
  const offence = (to: string, line = 1, path = '/src/screens/X.tsx') =>
    `${path}:${line}: an action drawn as a link (to=${to}), use BotonLink`

  test('rejects an InAppLink, a Link and an <a> that hold an icon', () => {
    const inApp = '<InAppLink to={EXPENSE_NEW} className="gastos__cargar">\n  <Icono nombre="agregar" />\n  <span>Cargar gasto</span>\n</InAppLink>'
    expect(findActionLinks(at(inApp))).toEqual([offence('{EXPENSE_NEW}')])
    expect(findActionLinks(at('<Link to="/x"><Icono nombre="a"/>Ir</Link>'))).toEqual([offence('"/x"')])
    expect(findActionLinks(at('<a href="/x"><Icono nombre="a" />Ir</a>'))).toEqual([offence('<unreadable>')])
  })

  test('rejects a PaneRowLink that holds an icon other than the trailing chevron', () => {
    const row = '<PaneRowLink to={A} className="fila" activeClassName="fila fila--activa"><Icono nombre="agregar" />Ir</PaneRowLink>'
    expect(findActionLinks(at(row))).toEqual([offence('{A}')])
    const chevron = '<PaneRowLink to={A} className="fila" activeClassName="fila"><span>t</span><Icono nombre="chevron" /></PaneRowLink>'
    expect(findActionLinks(at(chevron))).toEqual([])
  })

  test('rejects a tag that spans several lines, at the line it opens', () => {
    const content = '\n\n<InAppLink\n  to={pathTo(X, { id: a })}\n  className="x"\n>\n<Icono nombre="a"/>\n</InAppLink>'
    expect(findActionLinks(at(content))).toEqual([offence('{pathTo(X, { id: a })}', 3)])
  })

  test('rejects a template-literal className with a token outside the list', () => {
    const content = '<InAppLink to={A} className={`fila ${on ? \'on\' : \'\'}`}><Icono nombre="a" /></InAppLink>'
    expect(findActionLinks(at(content))).toEqual([offence('{A}')])
  })

  test('reads a body only for a tag that does not close itself', () => {
    const content = '<Link to={A} />\n<Link to={B}>\n<Icono nombre="a" />\n</Link>'
    expect(findActionLinks(at(content))).toEqual([offence('{B}', 2)])
  })

  test('ends a body at its own close, counting same-name openings', () => {
    const nested = '<Link to={A}><Link to={B}>x</Link><Icono nombre="a"/></Link>'
    expect(findActionLinks(at(nested))).toEqual([offence('{A}')])
    const twice = '<a href="x"><span>t</span></a><a href="y"><Icono nombre="a"/></a>'
    expect(findActionLinks(at(twice))).toEqual([offence('<unreadable>')])
  })

  test('rejects an icon inside an arrow function in the body', () => {
    const content = '<Link to={A}>{items.map((i) => <Icono nombre={i}/>)}</Link>'
    expect(findActionLinks(at(content))).toEqual([offence('{A}')])
  })

  test('exempts aria-current only under shell/, so a screen link that carries it is still flagged', () => {
    const content = '<Link to={A} aria-current="page"><Icono nombre="a" /></Link>'
    expect(findActionLinks(at(content))).toEqual([offence('{A}')])
    expect(findActionLinks(at(content, '/src/components/X.tsx'))).toEqual([offence('{A}', 1, '/src/components/X.tsx')])
  })

  test('reports a tag that is never closed as its own offence', () => {
    expect(findActionLinks(at('\n<Link to={A}>\n<Icono nombre="a" />'))).toEqual([
      '/src/screens/X.tsx:2: cannot read the body of a link (to={A}), close it',
    ])
  })

  test('accepts a row link with no icon', () => {
    const content = '<InAppLink to={X} className="fila-venta"><span>t</span></InAppLink>'
    expect(findActionLinks(at(content))).toEqual([])
  })

  test('accepts the closed entry classes, which are exactly mas__item and ajustes__item', () => {
    expect([...ENTRY_CLASSES]).toEqual(['mas__item', 'ajustes__item'])
    for (const name of ENTRY_CLASSES) {
      expect(findActionLinks(at(`<InAppLink to={A} className="${name}"><Icono nombre="a" /></InAppLink>`))).toEqual([])
    }
  })

  test('accepts a shell/ Link with a dynamic className and aria-current', () => {
    const content =
      "<Link\n  to={item.to}\n  aria-current={active ? 'page' : undefined}\n  className={active ? 'bar__item bar__item--activo' : 'bar__item'}\n>\n  {item.icono !== undefined && <Icono nombre={item.icono} />}\n</Link>"
    expect(findActionLinks(at(content, '/src/shell/Shell.tsx'))).toEqual([])
  })

  test('accepts an iconless link then a self-closing one, and a self-closing link at the end of a file', () => {
    expect(findActionLinks(at('<Link to={A}>x</Link>\n<Link to={B} />\n<Icono nombre="a" />'))).toEqual([])
    expect(findActionLinks(at('<InAppLink to={A} />'))).toEqual([])
  })

  test('accepts an icon outside the link body and in tags that only look like a link', () => {
    expect(findActionLinks(at('<InAppLink to={A}>x</InAppLink><span><Icono nombre="a"/></span>'))).toEqual([])
    expect(findActionLinks(at('<abbr><Icono nombre="a"/></abbr><aside><Icono nombre="a"/></aside>'))).toEqual([])
  })

  test('accepts a row whose only icon is the trailing chevron, and rejects one that also draws another icon', () => {
    const row = '<InAppLink to={A} className="fila-venta"><span>t</span><Icono nombre="chevron" /></InAppLink>'
    expect(findActionLinks(at(row))).toEqual([])
    const action = '<InAppLink to={A}><Icono nombre="agregar" /><Icono nombre="chevron" /></InAppLink>'
    expect(findActionLinks(at(action))).toEqual([offence('{A}')])
  })

  describe('a chevron exempts a link only as a record row\'s single trailing mark', () => {
    const chevron = '<Icono nombre="chevron" />'
    const link = (body: string) => `<InAppLink to={A}>${body}</InAppLink>`

    test.each([
      ['a word before it', `Siguiente ${chevron}`],
      ['an expression before it', `{label} ${chevron}`],
      ['it leads', `${chevron} Atrás`],
      ['content follows it', `<span>t</span>${chevron}<span>x</span>`],
      ['it is the whole body', chevron],
      ['two trailing chevrons', `<span>t</span>${chevron}${chevron}`],
      ['it is conditional', `<span>t</span>{cond && ${chevron}}`],
      ['its name is an expression', '<span>t</span><Icono nombre={"chevron"} />'],
      ['it carries another prop', '<span>t</span><Icono nombre="chevron" tamano={16} />'],
    ])('rejects a link where %s', (_name, body) => {
      expect(findActionLinks(at(link(body)))).toEqual([offence('{A}')])
    })

    test('accepts the Ventas row shape split over lines', () => {
      const row = `<InAppLink to={A} className="fila-venta">\n  <span>t</span>{' '}\n    ${chevron}\n  </InAppLink>`
      expect(findActionLinks(at(row))).toEqual([])
    })

    test('KNOWN GAP, the review owns it: a word wrapped in an element before the chevron is not flagged', () => {
      expect(findActionLinks(at(link(`<span>Siguiente</span>${chevron}`)))).toEqual([])
    })
  })

  test('accepts a link written inside a comment', () => {
    const content = '// <a href="x"><Icono nombre="a"/></a>\n/* <Link to={A}>\n<Icono nombre="a"/></Link> */'
    expect(findActionLinks(at(content))).toEqual([])
  })

  test('accepts the authors of .boton*, InAppLink, test-side files and files outside the three folders', () => {
    const content = '<Link to={A}><Icono nombre="a" /></Link>'
    const paths = [
      '/src/components/BotonLink.tsx',
      '/src/components/Boton.tsx',
      '/src/components/botonVisual.tsx',
      '/src/components/AnswerButton.tsx',
      '/src/components/InAppLink.tsx',
      '/src/screens/X.test.tsx',
      '/src/architecture/x.tsx',
      '/src/App.tsx',
    ]
    for (const path of paths) expect(findActionLinks(at(content, path))).toEqual([])
  })

  test('names a link by its to= value, whatever shape it takes, and never leaves it empty', () => {
    const icon = '<Icono nombre="a" />'
    const named = (to: string) => findActionLinks(at(`<Link to=${to}>${icon}</Link>`))
    expect(named('{pathTo(X, { id: a })}')).toEqual([offence('{pathTo(X, { id: a })}')])
    expect(named('{{ pathname: p, hash: h }}')).toEqual([offence('{{ pathname: p, hash: h }}')])
    expect(named('"/x"')).toEqual([offence('"/x"')])
    expect(named("{'a}b'}")).toEqual([offence("{'a}b'}")])
    expect(findActionLinks(at(`<Link {...props}>${icon}</Link>`))).toEqual([offence('<unreadable>')])
  })
})

describe('findLinkAliases', () => {
  const at = (content: string) => [{ path: '/src/screens/X.tsx', content }]

  test('rejects an import that renames Link, and a default import of InAppLink under another name', () => {
    expect(findLinkAliases(at("import { Link as RouterLink } from 'react-router'"))).toEqual([
      '/src/screens/X.tsx:1: renames a link import (Link as RouterLink), use its own name',
    ])
    expect(findLinkAliases(at("\nimport Enlace from '../components/InAppLink'"))).toEqual([
      '/src/screens/X.tsx:2: renames the InAppLink import (as Enlace), use its own name',
    ])
  })

  test('accepts the plain imports and a rename of something else', () => {
    const content =
      "import { Link, useMatch as match } from 'react-router'\nimport InAppLink from '../components/InAppLink'"
    expect(findLinkAliases(at(content))).toEqual([])
  })
})
