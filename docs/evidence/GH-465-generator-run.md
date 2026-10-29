# GH-465: generator run measurements (integrated head)

Command: `uv run --no-project python -m scripts.docs.generate` (16 cores, shared and busy machine).

| Run | Wall-clock | Exit | Result |
| --- | --- | --- | --- |
| 1, in the working checkout | 3:48.04 (peak RSS 304 MB) | 0 | `git status` clean afterwards |
| 2, second copy of the tree (`git archive HEAD`) at another path, other `TMPDIR` | 2:57.7 | 0 | `diff -r` of `docs/architecture/generated/` and `docs/api/` against run 1: byte-equal |

Load average (`uptime`, 1 min) before and after run 1: 12.96 and 28.61. The machine was already loaded
by other work, so the generator's own share is lower.

The second copy had no `.venv`, so it used symlinks to the working checkout's `web/node_modules` and `.venv`.
`lint` (ruff) and `types` (mypy strict, 658 files) pass on this tree.
