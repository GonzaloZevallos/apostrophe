/**
 * The scan behind `messageSources.test.ts`: a shared message (a refusal or a toast the
 * seller reads) is defined in one module and imported everywhere else. Walks a list of
 * sources handed to it, so a test can feed it a fixture that must fail.
 */

export interface SourceFile {
  path: string
  content: string
}

/** Comments replaced by spaces, newlines kept, so a message quoted in prose is not a copy. */
export function blankComments(content: string): string {
  return content.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (comment) => comment.replace(/[^\n]/g, ' '))
}

/** One line per module that defines `literal` outside `owner`, and one if `owner` does not define it. */
export function findMessageCopies(files: readonly SourceFile[], literal: string, owner: string): string[] {
  const problems: string[] = []
  let ownerDefines = false
  for (const { path, content } of files) {
    if (!blankComments(content).includes(literal)) continue
    if (path === owner) ownerDefines = true
    else problems.push(`${path}: "${literal}" is defined outside ${owner}`)
  }
  if (!ownerDefines) problems.unshift(`${owner}: "${literal}" is not defined in its owner`)
  return problems
}
