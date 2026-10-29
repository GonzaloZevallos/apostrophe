/**
 * The never-by-color census (design README: no state told by color alone). `stateColorRules`
 * reads CSS text and returns each rule, by its normalised selector list, whose declarations use
 * a state color: `--deuda*`, `--critico*`, `--acento-calido*`, `--positivo`, `--negativo` or a
 * chart series. `checkColorCensus` compares that to the list of entries below.
 */

export interface CensusEntry {
  /** The normalised selector list of the rule, the key. */
  selector: string
  /** The React component or components the rule styles. */
  component: string
  /** The word, sign, arrow or shape the component shows, or `decorative: <why>`. */
  carries: string
  /** The Testing Library tests, under src, that assert `carries` (one per component it names). */
  tests: readonly string[]
}

const STATE_COLOR = /--(?:(?:deuda|critico|acento-calido)[\w-]*|positivo|negativo|serie[1-5])(?![\w-])/
const GAIN_OR_LOSS = /--(?:positivo|negativo)(?![\w-])/

const normalise = (selectors: string): string =>
  selectors
    .split(',')
    .map((one) => one.trim().replace(/\s+/g, ' '))
    .join(', ')

interface Rule {
  selector: string
  body: string
}

/** Every style rule, with `@media`/`@supports` and other at-rules flattened into their inner rules. */
function parseRules(css: string): Rule[] {
  const rules: Rule[] = []
  const walk = (text: string): void => {
    let from = 0
    let open = text.indexOf('{', from)
    while (open !== -1) {
      const prelude = text.slice(from, open).replace(/^[\s;}]+/, '')
      let depth = 1
      let close = open + 1
      while (close < text.length && depth > 0) {
        if (text[close] === '{') depth += 1
        if (text[close] === '}') depth -= 1
        close += 1
      }
      const body = text.slice(open + 1, close - 1)
      if (prelude.startsWith('@')) walk(body)
      else rules.push({ selector: normalise(prelude), body })
      from = close
      open = text.indexOf('{', from)
    }
  }
  walk(css.replace(/\/\*[\s\S]*?\*\//g, ''))
  return rules
}

export function stateColorRules(css: string): string[] {
  const used = parseRules(css).filter(({ body }) => STATE_COLOR.test(body))
  return [...new Set(used.map(({ selector }) => selector))]
}

const usesGainOrLoss = (css: string, selector: string): boolean =>
  parseRules(css).some((rule) => rule.selector === selector && GAIN_OR_LOSS.test(rule.body))

/** One line per problem; empty when the census holds. `testFiles` are the `src/**\/*.test.tsx` paths. */
export function checkColorCensus(
  css: string,
  entries: readonly CensusEntry[],
  testFiles: readonly string[],
): string[] {
  const used = stateColorRules(css)
  const listed = new Set<string>()
  const problems: string[] = []
  for (const rule of used) {
    if (!entries.some(({ selector }) => selector === rule)) {
      problems.push(`${rule}: uses a state color and is not listed in the color census`)
    }
  }
  for (const { selector, component, carries, tests } of entries) {
    if (listed.has(selector)) {
      problems.push(`${selector}: listed twice in the color census`)
      continue
    }
    listed.add(selector)
    if (!used.includes(selector)) {
      problems.push(`${selector}: listed in the color census but no rule with that selector uses a state color`)
      continue
    }
    if (component.trim() === '') problems.push(`${selector}: names no component`)
    if (carries.trim() === '') {
      problems.push(`${selector}: names no word, sign, arrow or shape it carries`)
    } else if (carries.startsWith('decorative')) {
      if (!/^decorative: \S/.test(carries)) problems.push(`${selector}: decorative needs a reason after "decorative: "`)
      else if (usesGainOrLoss(css, selector)) {
        problems.push(`${selector}: a --positivo or --negativo rule cannot be decorative`)
      }
    }
    if (tests.length === 0) problems.push(`${selector}: names no test`)
    for (const test of tests) {
      if (!testFiles.includes(test)) problems.push(`${selector}: test ${test} is not a src/**/*.test.tsx file`)
    }
  }
  return problems
}

const at = (...paths: string[]): string[] => paths.map((path) => `src/${path}`)

/**
 * The census of `styles/app.css`: every rule that uses a state color, the component it styles and
 * the word, sign, arrow or shape that component shows, so the state reads without color. The
 * `tests` assert it through what the user sees.
 *
 * `--positivo` and `--negativo`: no entry, no screen shows a gain today. The rule for the first
 * gain figure: the sign and direction come from the API value and the text from the format
 * module, in one non-breaking unit, with the arrow `aria-hidden` and "up"/"down" in its accessible
 * name. Its rule is listed here with its component and the test that asserts the sign or arrow.
 *
 * FINDINGS (a rule that needs more than a missing word, sign or arrow): none. Every rule below
 * sits beside a word its component already shows; the only gap was that the phone "behind pane"
 * (`CustomerCardBehind`, `CustomersBehind`) had no test asserting its "Owes you" and "Owed to you".
 */
export const COLOR_CENSUS: readonly CensusEntry[] = [
  { selector: '.campo__error', component: 'PasswordField and every form field error', carries: 'the error sentence itself, as an alert', tests: at('components/PasswordField.test.tsx') },
  { selector: '.boton--destructivo', component: 'Boton (destructive)', carries: 'the button label and the trash icon', tests: at('components/Boton.test.tsx') },
  { selector: '.boton--critico', component: 'Boton (critical)', carries: 'the button label and the trash icon', tests: at('components/Boton.test.tsx') },
  { selector: '.aviso-ambar', component: 'AvisoAmbar', carries: 'the notice sentence', tests: at('components/AvisoAmbar.test.tsx') },
  { selector: '.aviso-ambar__titulo', component: 'AvisoAmbar', carries: 'the notice title', tests: at('components/AvisoAmbar.test.tsx') },
  { selector: '.aviso-ambar__detalle', component: 'AvisoAmbar', carries: 'the notice detail sentence', tests: at('components/AvisoAmbar.test.tsx') },
  { selector: '.aviso-ambar__icono', component: 'AvisoAmbar', carries: 'decorative: aria-hidden attention icon beside the sentence that carries the state', tests: at('components/AvisoAmbar.test.tsx') },
  { selector: '.insignia--deuda', component: 'Insignia (deuda tone)', carries: 'its own word as content', tests: at('components/ReglaInsignia.test.tsx') },
  { selector: '.insignia--critico', component: 'Insignia in Catalogo', carries: 'the word "sold out"', tests: at('screens/Catalogo.test.tsx') },
  { selector: '.selector-pago__ayuda', component: 'SelectorPago', carries: 'the description sentence under Owing', tests: at('components/SelectorPago.test.tsx') },
  { selector: '.bloque-deben', component: 'InicioPanel debt block', carries: '"Owed to you"', tests: at('screens/inicio/InicioPanel.test.tsx') },
  { selector: '.bloque-deben__titulo', component: 'InicioPanel debt block', carries: '"Owed to you"', tests: at('screens/inicio/InicioPanel.test.tsx') },
  { selector: '.bloque-deben__fila', component: 'InicioPanel debt block', carries: 'decorative: the line between debtor rows, each row names the customer and its figure', tests: at('screens/inicio/InicioPanel.test.tsx') },
  { selector: '.bloque-deben__datos > .pie, .bloque-deben__cuenta, .bloque-deben__desde', component: 'InicioPanel debt block', carries: '"since dd/mm" and the count of sales owing', tests: at('screens/inicio/InicioPanel.test.tsx') },
  {
    selector: '.monto-deuda',
    component: 'InicioPanel, ClienteFila, TeDeben, CustomersBehind, ClienteFicha, CustomerCardBehind, Ventas',
    carries: '"Owed to you", "owes you since dd/mm", "Owes you" or "owes you" beside the figure',
    tests: at(
      'screens/inicio/InicioPanel.test.tsx',
      'screens/clientes/Clientes.test.tsx',
      'screens/clientes/TeDeben.test.tsx',
      'screens/clientes/ClienteFicha.test.tsx',
      'screens/clientes/ClienteSheet.test.tsx',
      'screens/ventas/Ventas.test.tsx',
    ),
  },
  { selector: '.cuenta-cliente__fila', component: 'AccountRowLine', carries: 'decorative: the line between account rows, each row names what happened', tests: at('screens/clientes/ClienteFicha.test.tsx') },
  { selector: '.cuenta-cliente__saldo.monto-deuda', component: 'AccountRowLine', carries: 'the word "balance" before the figure (a credit reads "Credit")', tests: at('screens/clientes/ClienteFicha.test.tsx') },
  { selector: '.marca-estado--sold_out .marca-estado__forma', component: 'MarcaEstado', carries: 'a square and the word "sold out"', tests: at('components/MarcaEstado.test.tsx') },
  { selector: '.marca-estado--low .marca-estado__forma', component: 'MarcaEstado', carries: 'a filled circle and the word "low"', tests: at('components/MarcaEstado.test.tsx') },
  { selector: '.catalogo__publicar--desactualizado', component: 'PinPublish', carries: '"Out of date"', tests: at('screens/PinPublish.test.tsx') },
  { selector: '.catalogo__publicar--desactualizado .catalogo__publicar-titulo', component: 'PinPublish', carries: '"Out of date"', tests: at('screens/PinPublish.test.tsx') },
  { selector: '.catalogo__publicar--desactualizado .catalogo__publicar-detalle', component: 'PinPublish', carries: 'the reason sentence under "Out of date"', tests: at('screens/PinPublish.test.tsx') },
  { selector: '.variedad-resumen', component: 'VarietyPage summary line', carries: 'the grams and the stock word ("low") from MarcaEstado', tests: at('screens/varieties/VarietyPage.test.tsx') },
  { selector: '.seccion-variedad__valor--aviso', component: 'VarietyThresholdSection', carries: '"Warning: 18 g left"', tests: at('screens/varieties/VarietyPage.test.tsx') },
  { selector: '.ficha-deuda', component: 'ClienteFicha, CustomerCardBehind', carries: '"Owes you" and "since dd/mm"', tests: at('screens/clientes/ClienteFicha.test.tsx', 'screens/clientes/ClienteSheet.test.tsx') },
]
