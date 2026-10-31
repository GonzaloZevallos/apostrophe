---
status: accepted
date: 2026-10-28
---

# Architecture docs cite defined symbols, and a text test checks them

GH-461. The pages under `docs/architecture/` are written in Spanish and every claim in them links a
repository file; next to the link, a backticked symbol names the thing the claim rests on. A page that
cites a symbol that was renamed, or never existed, is wrong without anyone noticing.

## Decision
- **A cited symbol is defined in the file its link points to.** `tests/docs/test_docs_rules.py` holds
  `defined_symbol_problems` and `page_problems`: the file's text has a line-start `class`, `def`, `async def` or assignment
  of that name, indentation allowed. A mention in a comment or docstring does not count. The test reads
  docs and sources as text and imports nothing from `app`.
- **Only stable names are cited**: use cases, ports, routers, domain entities and the dependencies in
  `deps.py`. Never a `_private` helper; a cited name starting with `_` fails the test.
- **Whoever renames a cited symbol updates the page in the same diff.** The test fails otherwise, which
  is the point: the coupling between code and prose is explicit instead of silent.
- **The order of calls in a flow is review-only.** No test can tell that a sequence diagram draws its
  arrows in the order the use case makes its calls; the reviewer checks each row of a page's *Fuentes*
  table against the code it cites.
- Links and Mermaid blocks are read only by `scripts/docs/links.py`, the one extractor (#460 landed link
  checking as `lychee` and Mermaid parsing as a node script, neither importable from a test). A test
  never defines a link or Mermaid pattern of its own.
