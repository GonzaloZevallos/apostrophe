---
status: accepted
date: 2026-10-04
---

# Deploying: Render, Turso, the daily encrypted backup and the restore drill

Part of #12, #27. ADR-0016 picked Render, Turso and UptimeRobot over the earlier
Oracle/Caddy/Litestream plan. This records the shape the deploy files, the backup and
the restore drill actually take (deploy-and-backups subtask).

## Decision

- **Serving**: `scripts/serve.sh` is the only place uvicorn is ever started, with
  `--no-access-log` (no request, and so no address, reaches a log line) and
  `--no-proxy-headers` (uvicorn itself never trusts `X-Forwarded-For`; only
  `ClientAddress`, app/accounts/adapters/deps.py, ever reads it, and only from a
  configured trusted proxy). It binds every interface on `${PORT:-${APOSTROPHE_PORT:-8000}}`:
  `$PORT` is Render's own convention, `$APOSTROPHE_PORT` the home network's.
- **Migration**: the schema is migrated only by `upgrade_to_head`, inside
  `app.main`'s `lifespan`, once, at startup. `render.yaml` has no pre-deploy command;
  `.github/workflows/backup.yml` runs no migration of its own.
  `tests/test_serve_script.py` fails on either.
- **Backup read path**: a read-only Turso database token authenticates libSQL's own
  client protocol, not the `turso` CLI's `db shell .dump`, which needs an
  account-level login. `scripts/backup_copy.py` takes the dump itself instead, a table
  at a time, over that same client protocol, with the token always a connect
  argument, never part of the URL.
- **Backup destination**: Cloudflare R2, one bucket used for nothing else. R2's token
  permission groups are coarse (no grant allows write but denies delete), so the
  bucket's own **Object Lock**, not the token, holds a written backup for 90 days; a
  90-day lifecycle rule removes it after that. `deploy/README.md` section 3 records
  this reasoning.
- **Encryption**: `age`, to the recipient committed at `deploy/age-recipient.txt`. The
  identity that decrypts stays off Render, Turso and GitHub (`deploy/README.md`
  section 4); `tests/test_no_secrets.py` fails the build if it is ever committed.
- **Restore drill** (`scripts/drill.py`): pure functions over local SQLite file paths —
  `integrity`, `row_counts` (every table, `alembic_version` included), `latest_change`
  (the newest `recorded_at` over exactly `sale`, `payment`, `stock_entry` and
  `expense`), `compare_counts` (names the differing tables only, never a count or a
  row) and a copy-age warning past 2 days. Its CLI refuses a scratch target equal to
  the app's own configured database, so a drill run never touches the running app.
- **Secret scan** (`tests/test_no_secrets.py`): every tracked file, checked for an
  `age` identity, a JWT-shaped token, a Render API key, a Cloudflare/R2 key and a
  generic `TOKEN`/`SECRET` env-style assignment with a real-looking value. The generic
  check is skipped for `.py` files: passing `database_auth_token` as the `auth_token`
  connect argument is a variable reference, not a literal secret, and would otherwise
  false-positive on every future caller of that port. The `age1…`
  recipient is the one secret-shaped string this repository commits on purpose.

## Consequences

- Nothing here depends on which capability holds the per-address brake, the `Secure`
  cookie or the libSQL driver: this ADR covers only the deploy files, the backup and
  the drill. Those other decisions belong to their own subtasks' diffs.
- The daily backup's read path (`scripts/backup_copy.py`) is untested against a real
  Turso database — no test reaches the network (the plan's invariant). Its correctness
  rests on `scripts/drill.py`'s own tests, which exercise the same shape of file it
  produces, and on the go-live gate's hand-run (`deploy/README.md` section 9).
- R2's Object Lock, not a token permission, is what actually protects a backup from
  early deletion. If Cloudflare ever adds a finer-grained token permission, the
  README's section 3 is where that gets revisited.

## Considered and rejected

- **Using `turso db shell <db> .dump` directly from the workflow**: it needs the
  `turso` CLI logged in at the account level, not a per-database token — exactly the
  credential this plan avoids putting in GitHub secrets (a leaked account login could
  create or delete a database; a leaked read-only database token cannot).
