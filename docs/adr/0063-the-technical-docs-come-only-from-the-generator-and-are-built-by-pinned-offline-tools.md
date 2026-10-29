---
status: accepted
date: 2026-10-29
---

# The technical docs come only from the generator and are built by pinned, offline tools

GH-460 (part 2). `python -m scripts.docs.generate` draws the architecture diagrams and the API
reference. This part adds the front module graph (dependency-cruiser) and the static API reference
(Redocly). `app/` and `web/src/` do not change.

## Decision

1. **One author.** Everything under `docs/architecture/generated/` and `docs/api/` is written by the
   generator and carries its do-not-edit header; the one exception is `docs/api/openapi.json`, which is
   the app's own document. Nobody edits those files by hand.
2. **Pinned, offline, local binaries.** `dependency-cruiser` (18.7.0) and `@redocly/cli` (2.72.1) are
   devDependencies of `web/package.json`, pinned exactly (no `^`, no `~`). The generator runs them as
   argv lists from `web/node_modules/.bin`, never through `npx` or the PATH, with an explicit
   repo-relative `cwd`. They read source files and the in-memory OpenAPI text, and need no network.
   Redocly runs with `REDOCLY_TELEMETRY=off` and `REDOCLY_SUPPRESS_UPDATE_NOTICE=true`.
3. **Staleness is not detected.** No declared check reads the generated tree (tests use in-memory input
   only), so a generated file can fall behind the code and nothing fails. The repository owner
   regenerates by hand with `python -m scripts.docs.generate` and commits the result.
4. **Front graph shape: one Mermaid cruise per folder.** The measured cost (below) keeps the whole run
   under 120 s, so each `web/src` folder is cruised on its own with `--output-type mermaid`, plus one
   overview cruise with `--collapse "^src/[^/]+"`. The fallback (render the graphs in Python from one
   `--output-type json` cruise) is not needed. Every run passes `--include-only` anchored at `^src/`, so
   no `node_modules` node is drawn. The exclusions (test files, test-only helpers) live only in
   `web/scripts/docs/front-exclude.json`, which `web/.dependency-cruiser.cjs` reads.
5. **Attribution.** Redocly's sidebar draws an "API docs by Redocly" anchor, unconditionally; no theme
   option removes it. The generator removes only the `href` attribute of that one anchor and leaves every
   other byte alone. Any other external `src` or `href` fails the run. Redocly is run with
   `--inlineBundle`: without it the page loads its script from `cdn.redocly.com` (a `modulepreload`
   link and a module `import`), which is not offline. The cost is a 2.6 MB page instead of 340 KB.
   `theme.openapi.disableGoogleFont: true` in the root `redocly.yaml` removes the font request.
6. **The import guard's known limit.** The front graph, and the guard that checks it, see only relative
   imports. An alias or a package import is not drawn.

## Measurements (hand captures, 2026-10-29)

| What | Result |
| --- | --- |
| `npm ci`, before / after the two devDependencies (warm cache) | 6.4 s / 5.7 s |
| `web/node_modules`, before / after | 363 MB / 386 MB (43 packages added) |
| part 1's full `generate` | 74.4 s |
| one `src/screens` cruise | 1.6 s |
| overview cruise (`--include-only "^src/" --collapse "^src/[^/]+"`) | 2.0 s |
| every per-folder cruise, pool of 4 | 3.9 s |
| one `redocly build-docs --inlineBundle` | 0.8 s |

Estimated total: about 81 s, under the 120 s limit. Two `redocly build-docs` runs on the same
`openapi.json`, to different output paths, give byte-identical HTML, with and without `--inlineBundle`.
depcruise node ids are derived from paths (`src_flash_flashContext_ts`) and subgraphs nest (`src`, then
`src_flash`); the project's Mermaid parser accepts the capture unchanged.
