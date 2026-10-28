// jsdom ships no types and `@types/jsdom` is not a dependency: only the one constructor
// and the two members `mermaidParse.ts` installs as globals are declared.
declare module 'jsdom' {
  export class JSDOM {
    constructor(html?: string)
    readonly window: Window & typeof globalThis
  }
}
