---
status: accepted
date: 2026-10-04
amended: 2026-10-04
---

# Deploying: Render, Turso, the daily encrypted backup and the restore drill

Amended 2026-10-04: the backup destination and the R2 secret-scan pattern are
superseded; see *Amendment* below.

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

## Amendment (2026-10-04): the daily copy is a GitHub Actions artifact

**Supersedes**: the Backup destination bullet above (Cloudflare R2, its Object Lock
and its 90-day lifecycle rule); the "Cloudflare/R2 key" item of the Secret scan
bullet above; and the Consequence above that R2's Object Lock, not a token
permission, protects a backup from early deletion.

### Decision

- The daily encrypted copy is kept as an artifact of the backup workflow's own run,
  in this private repository, named `backup-<UTC %Y%m%dT%H%M%SZ>-<run_id>.db.age`.
- Retention is 30 days; the workflow carries `permissions: contents: read`.
- Only the ciphertext is uploaded — the plaintext dump (`backup.db`) is removed in
  the job right after encryption.
- No secret is ever inlined into a `run:` step; a secret reaches a step only through
  its own `env:`.
- The newest copy is chosen only by `scripts/newest_backup.py`, reading the artifact
  listing; no doc or script chooses a copy with `gh run list`.

### Why R2 was dropped

Cloudflare R2 requires a credit card to enable, even on its free tier (a payment
method and a $5 authorization hold), against the human's 2026-10-04 rule that
publishing this product must be 100% free, with no card.

### Consequences

- Copies are deletable by anyone with write access to the repository, or by any
  workflow given `actions: write`, and expire after 30 days, the same as the monthly
  drill cadence. Nothing replaces Object Lock.
- The one-day loss bound past Turso's 24-hour point-in-time restore is unchanged.
- The artifact storage quota is shared with every workflow in this repository; when
  it is full, the upload fails, and the only trip-wire between drills is GitHub's own
  failed-run email, sent to whoever last changed the workflow's cron, and only while
  their notification settings allow it.
- `scripts/drill.py`'s `copy_age_warning` still measures how recent the restored
  data is, not how old the copy itself is — a known limitation, kept on purpose,
  because changing it would change what the operator sees.
- The restore path runs inside a directory made by `mktemp -d` under `umask 077`,
  removed at the end; a decrypted copy or a downloaded artifact never sits in the
  repository's own working tree.

### Note on this ADR's own section references

The Decision and Consequences text above, written before this amendment, cites
`deploy/README.md` by section number as that file was numbered at the time:
section 3 was Cloudflare R2 (gone — folded into *Why R2 was dropped* above),
section 4 was the `age` identity (now section 3), and section 9 was the go-live
checklist (now section 8). The text above is not reworded to match, to keep this
amendment append-only; read those numbers with this shift in mind.

## Amendment (2026-10-27): the daily copy goes to a private repository

**Supersedes**: the first amendment's destination bullet (the copy as this workflow's own
run artifact), its retention bullet (30-day artifact retention), its listing bullet (the
newest copy chosen from the artifact listing), and its consequence about the shared
artifact storage quota. Its other bullets stand.

This repository is public, and anyone can download a public repository's run artifacts,
so an artifact is not a private place for the encrypted copy, however well it is encrypted.

### Decision

- The destination is the private repository `GonzaloZevallos/apostrophe-backups`, reached
  only as the literal `git@github.com:GonzaloZevallos/apostrophe-backups.git` over SSH.
  Each copy is its own branch, named exactly like its file,
  `backup-<UTC %Y%m%dT%H%M%SZ>-<run_id>.db.age`, holding that one file; `main` is the
  repository's first commit (its README) and is never a copy.
- The workflow authenticates with a deploy key with write access to that repository only.
  The private half is the secret `BACKUP_DEPLOY_KEY` of a `backup` environment limited to
  `master`, read by the one step that writes it to a mode 600 file and removed by a final
  `if: always()` step. The Turso secrets live in the same environment; none at repository
  level. The restore and the drill use the owner's own SSH access, never the deploy key.
- Guards: the job runs only in `GonzaloZevallos/apostrophe`; `permissions: contents: read`;
  `actions/checkout` with `persist-credentials: false`; no workflow-level or job-level
  `env:`; each secret only in its own step's `env:`; never a force push; no credential in
  a URL or argv; no tracing, no verbose flag, nothing that prints; a copy over 90 MB is
  refused before any push. `tests/deploy/test_backup_workflow.py` checks each one.
- The host key is pinned: `deploy/github_known_hosts` holds GitHub's ed25519 host key, and
  the push and prune steps pass `StrictHostKeyChecking=yes` and that file as
  `UserKnownHostsFile` (an absolute path). A test pins its SHA256 fingerprint to the one on
  GitHub's SSH key fingerprints page.
- Copies are pruned after 30 days by the same daily run: `git ls-remote --heads` piped into
  `scripts/newest_backup.py expired --now <UTC now>`, then one `git push --atomic --delete`.
  The newest copy and `main` are never listed, so a stalled backup never prunes the
  repository down to nothing.
- `scripts/newest_backup.py` reads the `ls-remote` listing to choose the newest copy and the
  expired ones; no doc or script chooses a copy by `gh run list` or by commit time.

### Why not

- A fine-grained personal access token: it expires, and it is tied to a person, so a
  backup would stop the day it lapses or its owner leaves. A deploy key has no expiry and
  belongs to one repository.
- Cloudflare R2, or any object store with a lifecycle rule: it needs a payment card, against
  the 2026-10-04 rule that publishing this product costs nothing.
- Commits on one branch: a branch's history cannot expire individual copies, so storage would
  only grow. One branch per copy can be deleted on its own.

### Consequences

- About 30 full copies are stored at once, one per day.
- Deleting a branch frees space only when GitHub's own garbage collection runs, not at once.
- GitHub refuses a file over 100 MB; the 90 MB guard fails the run before the push. A copy
  that large needs a new amendment moving the destination.
- Residual weakness: whoever can change `master`, the `backup` environment, or holds the
  deploy key can delete copies. Deletion-blocking rulesets are unavailable for private
  repositories on GitHub Free. Nothing replaces Object Lock.
- A prune failure turns the run red, so the failed-run email reaches the owner. `--atomic`
  means that if one name cannot be deleted, nothing is deleted that run; that is safer than
  a half-done prune, and the next run lists afresh. A stale ref can only come from someone
  deleting by hand, which the red-run email surfaces.
- `concurrency: {group: backup, cancel-in-progress: false}` never overlaps two runs, but a
  superseded pending run is dropped, not failed, so it sends no email. That is unlikely with
  one daily cron.
- The offline tests prove the git command sequence over `file://`, not the SSH options or
  the host key. The first live run, after the owner's hand steps (`deploy/README.md`
  section 4) and the orchestrator's re-enabling of `backup.yml`, is the one unproven step,
  and the failed-run email is its trip-wire.
- `ci.yml`'s `e2e-test-results` artifact is out of scope: it holds synthetic fixtures and no
  backup data.
- `scripts/drill.py` is unchanged: its `copy_age_warning` still measures how recent the
  restored data is, not how old the copy is.
