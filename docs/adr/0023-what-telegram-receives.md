---
status: accepted
date: 2026-10-03
---

# What Telegram receives: plain text plus UTF-16 bold entities, and a fixed table that keeps no description

The catalog's `**` markers (ADR-0022) must become real bold in Telegram, and
the 4096-character limit must be checked the way Telegram itself counts, before every
send. Telegram's own error answers carry a human description that can name a chat, a
bot or a rate limit; none of that may ever reach a log, a response or an exception
(CODING_STANDARDS §9).

## Decision

- **No `parse_mode`.** `telegram_bold` (`app/pinned_catalog/domain/bold.py`) pairs `**`
  left to right, the same rule `web/src/screens/telegramPreview.ts` uses for the
  in-app preview, and answers the plain text (markers removed) plus a list of
  `(offset, length)` spans. `HttpTelegram` sends that plain text with `entities` of
  type `bold` built from those spans — never a hand-built Markdown or HTML string, so
  there is exactly one place that decides what is bold.
- **The limit is measured in UTF-16 code units**, on the plain text alone, by
  `fits_in_one_message`: `len(plain.encode("utf-16-le")) // 2 <= 4096`. This is how
  Telegram itself counts a message's length, and it is checked before every send —
  Probarlo, Publicar and upkeep alike — never after.
- **`classify(method, error_code, description)`** maps Telegram's answer through one
  fixed table of lowercase substrings (`app/pinned_catalog/adapters/telegram_http.py`):
  "message is not modified" is a success (`Unchanged`); "message to edit/pin not
  found" is `MessageGone`; "message is too long" is `TooLong`, a backstop behind our
  own check; "chat not found", "not enough rights", "bot was kicked", "bot is not a
  member", or a 401, is `BotCannotPost`; 429, 5xx, a timeout or no connection is
  `TelegramUnreachable`; any other 4xx is `BotCannotPost`. The description is matched
  and then dropped — never kept in the outcome, a log line or a raised exception.
- **Every failure is raised `from None`.** The caught `urllib` exception — which can
  carry the request URL, and so the token — is never chained into what `push` or a
  route sees; only the domain's own fixed-message error crosses that boundary.

## Consequences

- A new Telegram wording for an existing situation falls through `classify`'s own
  defaults (429/5xx/timeout → `TelegramUnreachable`, any other 4xx →
  `BotCannotPost`) rather than crashing — the known risk the plan already names.
- Measuring in UTF-16 code units is cautious: emoji and other codepoints outside the
  BMP cost two units each, the same as Telegram counts them, so a text this product
  refuses is a text Telegram would refuse too; it never lets an over-limit text
  through.

## Considered and rejected

- **`parse_mode: "MarkdownV2"`**: would need every catalog character outside `**`
  escaped, duplicating `telegram_bold`'s own pairing in Telegram's own syntax, and a
  seller's own `_` or `` ` `` would need escaping rules the catalog's text has never
  had to know about.
- **Keeping Telegram's description for diagnosis**: it can carry a chat id, a bot
  name or the shape of a rate limit; CODING_STANDARDS §9 forbids it everywhere a
  status, log line or response could show it.

## Amendment (2026-10-06, GH-96): `classify` reports a cause, and each action says its own reason

**Supersedes**: the `classify` bullet above, where "chat not found", "not enough
rights", "bot was kicked", "bot is not a member", a 401 and any other 4xx all became
`BotCannotPost`. That made Probarlo, which only writes to the seller's own chat, tell
her "El bot no puede publicar en el canal".

- **The adapter reports a cause, never a reason.** `classify` raises `TelegramRefused`
  carrying a closed `SendRefusal` (`app/pinned_catalog/domain/errors.py`). Checked in
  order, each row's source being **community reports, not captured responses**:

  | Telegram's answer | Outcome |
  |---|---|
  | "message is not modified" | `Unchanged` (a success) |
  | "message to edit/pin not found" | `MessageGone` |
  | "message is too long" | `TooLong` |
  | 401, or a 404 | `SendRefusal.TOKEN_INVALID` |
  | "bot can't initiate conversation", "bot was blocked by the user" | `SendRefusal.CHAT_NOT_STARTED` |
  | "chat not found" | `SendRefusal.CHAT_NOT_FOUND` |
  | "not enough rights", "bot was kicked", "bot is not a member" | `SendRefusal.NO_RIGHTS` |
  | 429 or 5xx | `TelegramUnreachable` |
  | any other 4xx | `SendRefusal.OTHER` |
  | no answer or a timeout | `TelegramUnreachable` |

- **Three folds, each an exhaustive `match` ending in `assert_never`, with no default
  branch** (`refusal_causes.py`): `for_channel` (every cause → `BotCannotPost`, for
  Publicar and upkeep), `for_test_send` (token invalid, own chat not started, own chat
  not found, and `test_failed` for no rights and other) and `for_lookup` (the lookup's
  own subtask). A new cause fails `mypy --strict` until every fold says what it means.
- **Two types keep the channel's reason where it belongs.** `TelegramApi` is the raw
  port and raises `TelegramRefused`, never `BotCannotPost`. `ChannelTelegram`
  (`application/channel_telegram.py`, `@final`) wraps it and folds every
  `TelegramRefused` to `BotCannotPost`; `push`, `safe_upkeep` and `/publish` take
  `ChannelTelegram`, so passing the raw adapter is a type error. `test_send` takes the
  raw `TelegramApi` and folds with `for_test_send` around its `send` alone.
- **One typed holder.** `app.state.pinned_catalog_telegram` is a `PinnedCatalogTelegram`
  (`api`, `channel`), built only in `app/main.py`; each reader casts `State` to it once
  and takes the field it needs.
- **Known risk.** The rows above are not captured bodies. A wrong row degrades to the
  less specific `test_failed` in Probarlo (or a wrong one of the three specific
  reasons), and can never show the channel reason there. The trigger to capture real
  bodies is a seller reporting a reason that does not fit.
- `TelegramRefused` and the four Probarlo errors carry fixed messages and no data, and
  are raised `from None`; `TelegramRefused` is never registered in a router.
