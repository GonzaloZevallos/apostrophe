### D-61b9b2a6 · 2026-11-14
when a carved-out step is cleanup that no later part builds on, it blocks only the last part of the chain, not the next one, so it stays off the critical path.
Origen: https://github.com/GonzaloZevallos/apostrophe/issues/732#issuecomment-6873942412

### D-69509906 · 2026-11-14
when a change removes or moves an element the e2e suite uses as a landmark (a class or locator in `web/e2e/helpers/` or in many specs), the same task migrates every e2e use of it. The element is never put back, visible or hidden, to satisfy a locator.
Origen: https://github.com/GonzaloZevallos/apostrophe/issues/732#issuecomment-6876438785

### D-8ecb8c1d · 2026-11-20
when a labelled action does not fit a phone title row, it becomes an icon-only round button with an accessible name, rather than shrinking or wrapping the row.
Origen: https://github.com/GonzaloZevallos/apostrophe/issues/910#issuecomment-7044106958

### D-62e6dc23 · 2026-11-20
a part that adds a module not yet wired into a screen may add it to web/scripts/docs/front-exclude.json; the part that wires it removes the entry. No permission needed.
Origen: https://github.com/GonzaloZevallos/apostrophe/issues/923#issuecomment-7045837505
