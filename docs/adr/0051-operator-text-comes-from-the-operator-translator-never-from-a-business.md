---
status: accepted
date: 2026-10-24
---

# Operator text comes from `operator_translator`, never from a business's language

Amends ADR-0050. The commands the operator runs (`invite-business`, `reset-password`, the
business removal, the spreadsheet import and its report) print through the copy module.

## Decision

- **One translator.** `operator_translator(locales_dir, operator_language, forced_language)`
  (`Settings.operator_translator()`) returns the forced language, else the operator language,
  with English as the fallback. It takes no business, session or request: `invite-business.sh`
  runs before any business exists, and no business's stored language ever selects operator
  output.
- **Keys and placeholders.** Keys are `operator.<area>.<line>`; the `en` text uses only named
  `{name}` placeholders, no `%` and no bare `{}`. One key per printed line shape; the only
  joins are the switches line's list and the problem line's `{problem}` slot.
- **Text born in `application/` reaches it through a port declared there.** No module under
  `application/` imports `app.shared.copy`, Babel or gettext (an architecture rule, like the
  one for `domain/`).
- **`en.baseline.json`** holds today's English line of every key; a key marked `pending` has
  not been moved yet and must not resolve in production `en`.
- **`refused: <ClassName>`** is the one untranslated fallback line: if the translator cannot
  be built or a failure line cannot be rendered, the command prints it, exits 1 and prints no
  traceback.
- **argparse's own frame** (`usage:`, `options:`, its error lines) stays standard-library
  English; the shell scripts always pass fixed arguments.
