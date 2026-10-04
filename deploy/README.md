# Deploy, from zero (docs/adr/0016, docs/adr/0017)

Render hosts the app, Turso hosts the database, UptimeRobot watches `/health`, and a
GitHub Actions workflow takes a daily encrypted copy, kept as that workflow's own run
artifact in this private repository (docs/adr/0017's amendment: Cloudflare R2 needed a
credit card even on its free tier). No secret of any kind lives in this repository:
everything below with a value is set by hand, outside git.

## 1. Turso

1. Create a database in region `aws-us-east-1` (the region this plan picks; Render's
   own service below runs in the same region, so every statement stays inside one AWS
   region instead of crossing the Atlantic on every request).
2. Note its `libsql://…` URL: `APOSTROPHE_DATABASE_URL`.
3. Create a **full-access** token for the app itself (`turso db tokens create`) —
   `APOSTROPHE_DATABASE_AUTH_TOKEN`, Render's secret, below.
4. Create a second, **read-only** token (`turso db tokens create --read-only`) for the
   daily backup — `TURSO_READONLY_TOKEN`, a GitHub secret, below.
   - A per-database token (read-only or not) authenticates libSQL's own client
     protocol; it does **not** carry the `turso` CLI's own login, so `turso db shell
     <db> .dump` and `turso db export` refuse it — both read the CLI's own
     account-level session (`turso auth login`/`auth api-tokens`), not a per-database
     token (Turso CLI docs: "Authentication", `docs.turso.tech/cli/authentication`,
     checked 2026-10-04). That account-level credential can create and delete
     databases, exactly what this plan's GitHub secrets must never carry. The
     read-only, per-database token (`docs.turso.tech/cli/db/tokens/create`, same date)
     cannot. `scripts/backup_copy.py` is the fallback this plan takes instead: it
     copies every table over the same client protocol the app itself uses, with the
     read-only token as a connect argument, never in the URL.
5. Turso's own continuous write log gives point-in-time restore for the last 24 hours
   (the human's loss bound, ADR-0016) — nothing to configure for that; it is the
   product's default.

## 2. Render

1. Connect this repository; Render reads `render.yaml` (a Blueprint) and creates one
   web service, `apostrophe`, region `virginia`.
2. Fill in its environment (every value below is `sync: false` in `render.yaml`, so
   Render never gets them from this repo):
   - `APOSTROPHE_SECRET_KEY` — a fresh one, per `.env.example`'s instructions. Changing
     it closes every open session.
   - `APOSTROPHE_DATABASE_URL` — Turso's `libsql://…` URL, from step 1.2.
   - `APOSTROPHE_DATABASE_AUTH_TOKEN` — the full-access token, from step 1.3.
   - `APOSTROPHE_PUBLIC_URL` — `https://<the Render subdomain, or the custom domain>`.
   - `APOSTROPHE_TRUSTED_PROXIES=10.0.0.0/8,172.16.0.0/12,192.168.0.0/16` — the three
     RFC 1918 private ranges, **not** `0.0.0.0/0`. A web service is "not *directly*
     reachable via the public internet" (`render.com/docs/web-services`, checked
     2026-10-04) — only Render's own load balancer, which "terminates SSL for inbound
     HTTPS requests, then forwards those requests to your web service over HTTP" (same
     page), can ever reach the port `scripts/serve.sh` binds — but that fact alone does
     **not** make `0.0.0.0/0` a safe value for this setting: `ClientAddress`
     (`app/accounts/adapters/deps.py`) walks `X-Forwarded-For` from the right only
     past entries that match `trusted_proxies`, so a value that matches *every*
     address makes every entry in the header "trusted", including one the client
     typed — the walk then finds no untrusted entry at all and falls back to the
     peer, which is Render's own load balancer on every single request. Every seller
     then shares that one address, and 20 failed logins from anyone lock logins out
     for everyone for 15 minutes (confirmed directly against `_forwarded_client`: with
     `networks=(0.0.0.0/0,)`, it returns `None` — "fall back to the peer" — for every
     header, forged or genuine).

     Render publishes no fixed, versioned CIDR for its load balancer the way a cloud
     provider's own address-ranges page does (its own default Python buildpack sets
     `FORWARDED_ALLOW_IPS=*` for exactly that reason,
     `render.com/docs/environment-variables`, same date), so this value cannot be
     Render's own confirmed range either. What it must do instead is tell a genuine
     client's address apart from an internal hop without needing Render's range at
     all: a real client's address is, by definition, never inside RFC 1918 private
     space, so the walk still finds it and stops there — the first public address in
     the header — whether or not Render's own hop happens to be one of these ranges
     too. This is the same shape `tests/accounts/test_client_address.py`'s
     `test_two_trusted_hops_plus_a_spoofed_leftmost_entry_take_the_real_client`
     already proves for one such range (`10.0.0.0/8`); it does not, and cannot, prove
     Render's edge actually connects from inside these ranges — that is confirmed on
     this deployment specifically only by the go-live checklist's two-network check
     (section 8), by hand. If Render ever documents its own load balancer's range,
     prefer that over this private-range convention.
3. Auto-deploy is on (`autoDeploy: true`): every merge to `master` deploys. There is no
   pre-deploy command: the schema is migrated only by `upgrade_to_head`, inside
   `app.main`'s `lifespan`, once, at startup.
4. Render's own edge terminates TLS and is the only thing that can reach the service;
   nothing here binds to a public interface of its own (`scripts/serve.sh` still binds
   `0.0.0.0`, because Render's edge is what sits in front of it, not a VM's NIC).

## 3. The `age` identity and recipient

1. Generate one keypair on a machine that is **not** Render, Turso or GitHub, e.g. your
   own laptop: `age-keygen -o identity.txt`.
2. Commit only the **recipient** line it prints (`age1…`) to
   `deploy/age-recipient.txt`, replacing the placeholder already there. A recipient is
   a public key: this file has nothing to protect.
3. Keep `identity.txt` — the line starting `AGE-SECRET-KEY-1…` — off every provider
   this plan uses. Store it wherever you already keep a password or a key outside this
   project (a password manager, a safe). It is never pasted into Render, Turso or
   GitHub, and never committed: `tests/test_no_secrets.py` fails the build if it ever
   is.

## 4. GitHub secrets (`.github/workflows/backup.yml`)

Add, under the repository's Settings → Secrets and variables → Actions:

- `TURSO_DATABASE_URL` — the same URL as `APOSTROPHE_DATABASE_URL` (step 1.2).
- `TURSO_READONLY_TOKEN` — the read-only token (step 1.4), never the full-access one.

No secret here can create, delete or overwrite a Turso database (the token is scoped
to one database, read-only). The daily copy itself carries this plan's accepted
guarantee: copies are deletable by anyone with write access to the repository, or by
any workflow given `actions: write`, and expire after 30 days, the same as the monthly
drill cadence (section 6). Nothing replaces Object Lock.

The only trip-wire between drills is GitHub's own default failed-run email, sent to
whoever last changed the workflow's cron. Check that your own GitHub notification
settings keep failed-run email on for this repository (Settings → Notifications →
Actions), so that email actually reaches you.

## 5. UptimeRobot

Create an HTTP(s) monitor on `https://<the public URL>/health`, interval 5 minutes.
The endpoint answers `{"status": "ok"}` only — no business name, id or count, so the
monitor (outside any session) learns nothing about who uses the installation.

## 6. The restore drill (`scripts/drill.py`)

Run by hand — there is no timer and no notification channel (PRD: no new admin
surface). Each run reports three things: the integrity check, row counts (compared
against the live figures you expect) and the latest change across `sale`, `payment`,
`stock_entry` and `expense`.

```
uv run --no-project python scripts/drill.py <restored-copy.db> <scratch-path.db>
```

The script refuses a scratch path equal to `APOSTROPHE_DATABASE_URL`'s own file — it
is read from the environment the drill runs in, so run it with the same `.env` the app
would use, pointed at a path that is plainly not that file.

Every command below runs from the repository root and stays out of its working tree:
start with `umask 077; d="$(mktemp -d)"`, and finish with `rm -rf "$d"` once you have
read the report. If a run is interrupted before that last command, `$d` is left behind
with decrypted data in it — find it and remove it by hand.

**The daily `age`-encrypted copy** (an artifact of the backup workflow's own run,
named `backup-<UTC %Y%m%dT%H%M%SZ>-<run_id>.db.age` — the one format the workflow,
this README and `scripts/newest_backup.py`'s own filter all share):

```
umask 077; d="$(mktemp -d)"
gh api "repos/{owner}/{repo}/actions/artifacts?per_page=100" \
  | uv run --no-project python scripts/newest_backup.py
# read that command's `name:` and `run_id:` lines, then:
gh run download <run_id> -n <name> -D "$d"
age -d -i identity.txt -o "$d/restored.db" "$d/<name>"
uv run --no-project python scripts/drill.py "$d/restored.db" "$d/scratch.db"
rm -rf "$d"
```

`scripts/newest_backup.py` is the only way to choose which copy is newest — never
`gh run list`, which orders runs, not artifacts, and says nothing about an artifact's
own expiry.

**Turso's point-in-time restore**, for anything inside the last 24 hours:

```
umask 077; d="$(mktemp -d)"
uv run --no-project python scripts/backup_copy.py "$d/restored.db"
uv run --no-project python scripts/drill.py "$d/restored.db" "$d/scratch.db"
rm -rf "$d"
```

**Cadence**: once before going live (the go-live gate, section 8), after any change to
how the app or its backup is configured, and monthly thereafter — the same cadence the
daily copy's own 30-day retention is sized against.

## 7. Cut-over — "Pasar los datos de casa a Turso"

1. Stop the home app (`scripts/serve.sh`'s process).
2. `umask 077; d="$(mktemp -d)"`, then copy `apostrophe.db` (the home file) to
   `"$d/the-copy.db"`.
3. Run `PRAGMA integrity_check` on `"$d/the-copy.db"` (or `scripts/drill.py`'s
   `integrity` function directly) — it must report `ok` before anything below.
4. Import into Turso with `turso db import "$d/the-copy.db"`
   (`docs.turso.tech/cli/db/import`, checked 2026-10-04). That command's own docs
   require the source file to be in WAL journal mode first
   (`docs.turso.tech/cloud/migrate-to-turso`, same date):
   ```
   sqlite3 "$d/the-copy.db" "PRAGMA journal_mode='wal'; PRAGMA wal_checkpoint(truncate);"
   ```
   Run this on **the copy only**, never on the home app's own file — the home app
   keeps using its file in whatever journal mode it was in, and is never restarted
   against it again after this section's step 8.
5. Point `scripts/drill.py` at the imported database (through
   `APOSTROPHE_DATABASE_URL`/`APOSTROPHE_DATABASE_AUTH_TOKEN`, exported via
   `scripts/backup_copy.py "$d/imported.db"` first) and run the three checks.
6. Run `compare_counts` between `"$d/the-copy.db"`'s row counts and `"$d/imported.db"`'s
   — it must come back empty, `alembic_version` included.
7. Only once 3, 5 and 6 all hold: start the Render service and hand out the public
   URL.
8. Never restart the home app against the old file afterwards — Turso is the one
   database from this point on.
9. `rm -rf "$d"`.

## 8. Go-live gate checklist (PRD: publishing is a gate for the whole installation)

- [ ] The restore drill (section 6) passes against a real restored copy.
- [ ] A sale recorded on the published app is still there after a Turso point-in-time
      restore to a scratch target.
- [ ] The newest artifact's `created_at` (`scripts/newest_backup.py`'s own output) is
      under 2 days old.
- [ ] The backup workflow's last run (Actions tab) is green, and the failed-run email
      (section 4) is confirmed on.
- [ ] Two-network check: from network A, 20 failed logins lock network A's address;
      from network B, a correct login still succeeds.

Nobody gets the public URL until every box above is checked.
