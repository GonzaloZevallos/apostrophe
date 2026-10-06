/**
 * The hex guard (design README: color only from the tokens): a literal hex color in a
 * `.css` or `.tsx` is a color that bypasses `styles/tokens.css`, the one file allowed to
 * hold them. Returns one line per offending file naming the first literal found.
 */

export interface SourceFile {
  path: string
  content: string
}

const HEX_COLOR = /#[0-9a-fA-F]{3,8}\b/
const TOKENS = 'src/styles/tokens.css'

function isStyled(path: string): boolean {
  return /\.(css|tsx)$/.test(path)
}

export function findHexColors(files: readonly SourceFile[]): string[] {
  return files
    .filter(({ path }) => isStyled(path) && path !== TOKENS)
    .flatMap(({ path, content }) => {
      const found = HEX_COLOR.exec(content)
      return found ? [`${path}: literal hex color ${found[0]}, use a token`] : []
    })
}
