/* The front module graph of the technical docs. The exclusion patterns live only in
   scripts/docs/front-exclude.json, so the generator and this file cannot disagree. */
const exclude = require('./scripts/docs/front-exclude.json')

module.exports = {
  forbidden: [],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: exclude },
    tsConfig: { fileName: 'tsconfig.app.json' },
    tsPreCompilationDeps: true,
    reporterOptions: { mermaid: { minify: false } },
  },
}
