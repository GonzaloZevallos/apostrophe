---
status: accepted
date: 2026-10-29
---

# CI selection is a union of path rules that fails closed

GH-448 (part 1). `scripts/ci_changes.py` decides, from the paths of a pull request, which suites the
selective CI runs. Its decision functions are pure; only `main` runs git, through the `Runner` of
`scripts/affected.py`. No script here imports or runs a node tool.

## Decision

1. **A union of rules, closed by default.** Every rule that matches a path adds to the selection. A
   path that matches no rule, `.agentic/stack.yaml`, and every `affected_fallback` glob (`*` crosses `/`)
   select every suite. A missing or empty fallback list selects everything too.
2. **One always set.** `ALWAYS_DIRS` is a single tuple in `scripts/ci_areas.py`; every other user imports
   it. Any pytest selection carries the always shard (those directories and the top-level `tests/test_*.py`).
   A directory can be an always directory and an area (`migrations`, `shared`): it is a node of the import
   graph, but its tests run only in the always shard.
3. **The closure.** `app/<area>/**`, of any file type, selects the area's closure: the import graph of
   `app/`, the route segments (`APIRouter(prefix=...)` joined through `include_router`), and an edge to
   `accounts` from every test directory that uses the `client` fixture. A path under `app/` outside any
   area selects every area. `tests/<area>` selects that area; a top-level helper selects every area.
4. **The reader map.** A pytest that reads a `web/` or `docs/` path adds its shard when that path changes.
   It is derived from `tests/` with `ast`. A read counts only when anchored at the repository root:
   `Path(__file__)` walked up with `.parent` / `.parents[N]`, or a module constant of the same file,
   extended by `/`, `joinpath`, `glob` or `rglob`. A string in a list, a tuple, a dict, `parametrize` or a
   call argument claims nothing, nor does a chain that starts at a fixture parameter or a loop variable. A
   name imported from another module claims nothing either, except the repository root where it is defined
   (`REPO_ROOT` and `WEB` from `scripts.affected`, `REPO_ROOT` from `tests.architecture.hexagon`): the
   screen-map guard reads `REPO_ROOT / "web" / ...`, so a change under `web/src` or `web/e2e` must run it. A
   walk of the whole tree (`REPO_ROOT.rglob("*.py")`) names no prefix and claims nothing. A prefix that does
   not exist is dropped. A `web`/`docs` chain from an origin the scan cannot place
   is listed by `unanchored_reads`, and a test keeps that list empty.
5. **Packing.** The area shards are packed greedily, longest first, by the AST count of tests
   (`parametrize` multiplied), into `min(3, areas)` bins with ties broken by name. No shard is empty.
6. **Vitest.** From paths only. `vitest_files` is the guard tests found by `affected.py` plus the
   `*.test.ts(x)` files in the diff. `vitest_changed` asks the workflow to run `vitest list --changed` after
   `npm ci`; `vitest_all` is set on everything and on `web/public/**`.
7. **E2E.** `web/src/screens/**` follows `scripts/e2e_screen_specs.json` and adds `mobile.spec.ts` +
   `mobile.setup.ts`; any other non-test `web/src` path selects every spec. A `*.test.ts(x)` selects only
   itself in vitest. `web/e2e/**` follows `is_e2e_sound`. A path under `app/` selects no e2e.
8. **Events.** Only `pull_request` diffs (`git diff --name-only --no-renames HEAD^1 HEAD`). A push, a manual
   run, a merge group, any other event, a git failure, an empty diff and a missing `HEAD^1` select everything.

## Consequences

- `accounts` and `shared` are imported by nearly every area, so many app changes still select most area
  shards; the area table will show how much a selective run gains.
- Guard tests that read `web/src` (`tests/test_affected.py`, `tests/test_e2e_screen_specs.py`) make any
  `web/src` or `web/e2e` change select the always shard; no area shard is added by them. A pytest that
  reads a path through a root imported from any other module is invisible to the reader map. A new such
  reader that matters should anchor its own path with `Path(__file__)`.
- The selector inputs (`scripts/ci_areas.py`, `scripts/ci_changes.py`, `scripts/e2e_screen_specs.json`,
  `scripts/affected.py`) are in `affected_fallback`, so a change to how CI selects runs everything.
