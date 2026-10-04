# Deploy, from zero (docs/adr/0014, docs/adr/0015)

Render hosts the app, Turso hosts the database, UptimeRobot watches `/health`, and a
GitHub Actions workflow takes a daily encrypted copy. No secret of any kind lives in
this repository: everything below with a value is set by hand, outside git.

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
     <db> .dump` refuses it. `scripts/backup_copy.py` is the fallback this plan takes
     instead: it copies every table over the same client protocol the app itself
     uses, with the read-only token as a connect argument, never in the URL.
5. Turso's own continuous write log gives point-in-time restore for the last 24 hours
   (the human's loss bound, ADR-0014) — nothing to configure for that; it is the
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
   - `APOSTROPHE_TRUSTED_PROXIES` — the CIDR(s) of the hop(s) in front of the app.
     Render's own docs on request headers name the proxy as the single internal hop
     that terminates TLS before the app; cite the exact range from Render's current
     networking docs at setup time, since Render does not publish a fixed, versioned
     CIDR block the way a cloud provider's own address ranges page does. Record here,
     once confirmed, which range was used and the date it was checked.
3. Auto-deploy is on (`autoDeploy: true`): every merge to `master` deploys. There is no
   pre-deploy command: the schema is migrated only by `upgrade_to_head`, inside
   `app.main`'s `lifespan`, once, at startup.
4. Render's own edge terminates TLS and is the only thing that can reach the service;
   nothing here binds to a public interface of its own (`scripts/serve.sh` still binds
   `0.0.0.0`, because Render's edge is what sits in front of it, not a VM's NIC).

## 3. R2 (the daily backup's destination)

1. Create one bucket, used for nothing else.
2. Create an API token scoped to **that bucket only**, **Object Read & Write**
   permission. Cloudflare's R2 token permission groups are coarse (read, write, or
   admin over a bucket); there is no narrower grant that allows writing a new object
   but denies deleting an existing one. Because the token itself cannot be denied
   delete, this plan relies on **Object Lock** instead: turn on Object Lock for the
   bucket with a 90-day **compliance** retention period on every object written. That
   lock, not the token's scope, is what actually holds a written backup for 90 days,
   even against the account that owns the token.
3. A 90-day **lifecycle** rule expires objects after 90 days regardless, so the bucket
   does not grow forever; the lock is what protects a copy for its first 90 days, the
   lifecycle rule is what removes it afterwards.
4. Note the bucket name, the S3-compatible endpoint, the access key id and the secret
   access key: `R2_BUCKET`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
   below.

## 4. The `age` identity and recipient

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

## 5. GitHub secrets (`.github/workflows/backup.yml`)

Add, under the repository's Settings → Secrets and variables → Actions:

- `TURSO_DATABASE_URL` — the same URL as `APOSTROPHE_DATABASE_URL` (step 1.2).
- `TURSO_READONLY_TOKEN` — the read-only token (step 1.4), never the full-access one.
- `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT` (step 3.4).

No secret here can create, delete or overwrite a Turso database (the token is scoped
to one database, read-only), and none can delete an R2 copy younger than 90 days (the
bucket's own Object Lock holds that, not the token).

### GitHub's 60-day schedule disable

GitHub disables a scheduled workflow after 60 days with no push to the repository's
default branch. If `master` goes 60 days without a merge, re-enable the workflow by
hand (Actions tab → the workflow → "Enable workflow") or push any commit before then.
The monthly drill (section 7) is a natural trip-wire: if a drill run notices the
workflow's last scheduled run is stale, this is why.

## 6. UptimeRobot

Create an HTTP(s) monitor on `https://<the public URL>/health`, interval 5 minutes.
The endpoint answers `{"status": "ok"}` only — no business name, id or count, so the
monitor (outside any session) learns nothing about who uses the installation.

## 7. The restore drill (`scripts/drill.py`)

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

Restore the two sources this plan actually has:

- **Turso's point-in-time restore**, for anything inside the last 24 hours (its
  console or CLI restores to a new database; export that into a local file with
  `scripts/backup_copy.py` the same way the daily backup does, then run the drill
  against the local file).
- **The daily `age`-encrypted copy**, decrypted first with the identity kept outside
  every provider (section 4): `age -d -i identity.txt -o restored.db backup-….db.age`.

**Cadence**: once before going live (the go-live gate, section 8), after any change to
how the app or its backup is configured, and monthly thereafter.

## 8. Cut-over — "Pasar los datos de casa a Turso"

1. Stop the home app (`scripts/serve.sh`'s process).
2. Copy `apostrophe.db` (the home file) aside.
3. Run `PRAGMA integrity_check` on the copy (or `scripts/drill.py`'s `integrity`
   function directly) — it must report `ok` before anything below.
4. Import into Turso: the Turso docs' own SQLite import path for a database created
   fresh and empty. Confirm from Turso's current docs at migration time whether the
   source file needs `PRAGMA journal_mode=WAL` set before the import, and set it on
   the copy only, never on the home app's own file, if so.
5. Point `scripts/drill.py` at the imported database (through
   `APOSTROPHE_DATABASE_URL`/`APOSTROPHE_DATABASE_AUTH_TOKEN`, exported via
   `scripts/backup_copy.py` into a local file first) and run the three checks.
6. Run `compare_counts` between the home copy's row counts and the imported copy's —
   it must come back empty, `alembic_version` included.
7. Only once 3, 5 and 6 all hold: start the Render service and hand out the public
   URL.
8. Never restart the home app against the old file afterwards — Turso is the one
   database from this point on.

## 9. Go-live gate checklist (PRD: publishing is a gate for the whole installation)

- [ ] The restore drill (section 7) passes against a real restored copy.
- [ ] A sale recorded on the published app is still there after a Turso point-in-time
      restore to a scratch target.
- [ ] The newest daily copy in R2 is under 2 days old (`scripts/drill.py`'s
      `copy_age_warning` says nothing).
- [ ] The backup workflow's last run (Actions tab) is green.
- [ ] Two-network check: from network A, 20 failed logins lock network A's address;
      from network B, a correct login still succeeds.

Nobody gets the public URL until every box above is checked.
