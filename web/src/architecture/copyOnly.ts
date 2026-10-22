/**
 * The copy-only guard (GH-53, ADR-0049): a screen, the shell or a component holds no text a
 * person reads; it reads a key of `web/src/copy/`. `findCopyLiterals` reads one `.tsx` source
 * with the TypeScript parser, so a comment, a type, a `className` or a route never counts, and
 * reports each place that writes visible text outright:
 *
 * - JSX text with a letter or a digit in it (`<p>Hola</p>`);
 * - a string literal in a JSX expression child (`<p>{'Hola'}</p>`);
 * - a string or template `aria-label`, `title` or `placeholder` attribute, written as
 *   `title="Hola"`, `title={'Hola'}` or a template with no hole.
 *
 * It is a ratchet, not a proof: a text built by a helper in another module, or a literal
 * assigned to a variable and rendered later, is invisible to it (ADR-0049 lists the limits).
 */

import ts from 'typescript'

export const TEXT_ATTRIBUTES = ['aria-label', 'title', 'placeholder'] as const

const READABLE = /[\p{L}\p{N}]/u

export interface CopyLiteral {
  line: number
  kind: 'jsx-text' | 'jsx-string' | 'attribute'
  text: string
}

function isLiteralText(node: ts.Node): node is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
}

/** The text an attribute writes outright, or undefined when it reads a variable or a key. */
function attributeText(initializer: ts.JsxAttributeValue | undefined): string | undefined {
  if (initializer === undefined) return undefined
  if (ts.isStringLiteral(initializer)) return initializer.text
  if (!ts.isJsxExpression(initializer) || initializer.expression === undefined) return undefined
  const { expression } = initializer
  return isLiteralText(expression) ? expression.text : undefined
}

/** Every visible literal in `source` (a `.tsx` file), in reading order. */
export function findCopyLiterals(source: string): CopyLiteral[] {
  const file = ts.createSourceFile('source.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const found: CopyLiteral[] = []
  const add = (node: ts.Node, kind: CopyLiteral['kind'], text: string): void => {
    if (!READABLE.test(text)) return
    found.push({ line: file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1, kind, text: text.trim() })
  }
  const visit = (node: ts.Node): void => {
    if (ts.isJsxText(node)) {
      add(node, 'jsx-text', node.text)
    } else if (ts.isJsxExpression(node) && node.expression !== undefined && isLiteralText(node.expression)) {
      if (!ts.isJsxAttribute(node.parent)) add(node, 'jsx-string', node.expression.text)
    } else if (ts.isJsxAttribute(node) && (TEXT_ATTRIBUTES as readonly string[]).includes(node.name.getText(file))) {
      const text = attributeText(node.initializer)
      if (text !== undefined) add(node, 'attribute', text)
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return found
}
