---
status: accepted
date: 2026-10-03
---

# Upkeep runs after the triggering commit, under one per-business lock, and only sends when the text changed

A sale, a price, a stock or a catalog change must never wait for Telegram, and a
failed sync must never fail, delay or roll back the save that triggered it (the PRD's
own criterion 4). Two attempts for the same business — a trigger and a manual
Publicar, or two triggers in quick succession — must never race each other into
double-posting or recording a stale result over a fresher one.

## Decision

- **`push(business_id, mode, today)`** (`app/pinned_catalog/application/push.py`) is
  the only code that takes the per-business lock (a `threading.Lock` registry,
  `BusinessLocks`), and runs in three phases: **read** the settings, the pin facts and
  the publishable text in one closed `Session` (`PinSnapshots.snapshot`); **call**
  Telegram with no database session open; **record** the outcome in one new, short
  transaction (`PinRecorder.record`) that writes only if the row's token fingerprint
  and channel chat still equal what step one read. A settings change racing a send in
  flight is thereby never overwritten by that send's own, now-stale, result.
- **`needs_send(text, pin)`** skips upkeep's call only when the freshly built text
  equals `last_published_text` *and* `last_failure` is null — a failure is retried even
  over unchanged text, so a transient Telegram outage never strands the pin out of
  date once the text itself recovers.
- **The trigger never runs on the request's own session, and never before the
  triggering write's commit** (the `upkeep` subtask's own routers): a trigger is a
  `BackgroundTasks` task added only for `POST`/`PUT`/`PATCH`/`DELETE`, so it starts
  only once the response is already being prepared, over its own connection.
- **`run_upkeep_safely`** (the `upkeep` subtask) is the only caller of
  `push(..., "upkeep")` off the request path: it catches every exception per business,
  tries once to record `telegram_unreachable` (swallowing a second failure rather than
  letting the sync's own bookkeeping fail loudly), and logs one fixed WARNING line
  naming only the exception's class — no business id, chat, token or text.
- **A 300-second ticker** (the `upkeep` subtask) calls `sync_all_published` for every
  business with a pin published and not yet checked today, covering the one trigger
  nobody saves: a price entry whose effective date arrives at midnight.
- **One process.** The lock is correct only because `scripts/serve.sh` runs a single
  uvicorn worker; a comment there says `--workers` would bring back double posts and
  stale edits.

## Consequences

- The day change can lag up to about five minutes after midnight, longer while
  Telegram is unreachable (the known risk the plan already names) — accepted, since
  the PRD's own criterion 1 only promises "the next time anyone looks", not the
  instant midnight passes.
- Every write on the four triggering routers pays the cost of rebuilding the catalog
  for its business off the response path (O(entries + lines), ADR-0010's own "revisit
  at 300 ms"); the ticker pays it once per published business per day, plus retries
  while unreachable.

## Considered and rejected

- **A database row lock instead of an in-memory one**: would survive a restart and
  work across processes, but the plan already accepts the single-process constraint
  (CONTEXT.md: one installation, modest scale) and a `threading.Lock` needs no
  migration, no polling and no cleanup of a lock a crashed process never released.
- **Running the trigger inside the triggering transaction**: a failed sync would then
  share that transaction's fate, breaking "the triggering save never waits for
  Telegram" outright.
