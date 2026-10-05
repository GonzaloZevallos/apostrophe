---
status: accepted
date: 2026-10-04
---

# Render, Turso and UptimeRobot replace the Oracle VM, Caddy, DuckDNS, Litestream and Backblaze B2

Publishing the app on the internet (#12) first considered a single Ampere A1 VM on
Oracle Cloud Always Free, with Caddy terminating TLS for a DuckDNS subdomain, Litestream
replicating the SQLite file continuously to Backblaze B2 encrypted with `age`, and
systemd units restarting the app and the backup on failure (decided with the human,
2026-10-03). That decision is overridden.

## Decision

- **App**: Render hosts the app. Deploy is automatic on every merge to `master`; there is
  no server to provision, patch or keep swap and unattended upgrades on.
- **Database**: Turso (libSQL, SQLite-compatible), region `aws-us-east-1`. ADR-0001's
  choice of SQLite stands unchanged; what moves is where the file lives and who
  replicates it. Turso's own continuous write log gives point-in-time restore for the
  last 24 hours.
- **Uptime**: UptimeRobot pings a health endpoint every 5 minutes.
- **Backups beyond 24 hours**: a GitHub Actions workflow runs daily, takes a copy of the
  database, encrypts it with `age` and stores it outside both Render and Turso. The
  identity that decrypts it is kept outside the repository and outside both providers,
  the same requirement the original decision already carried.
- **Loss bound** (round 1's escalated question): under 1 minute of recent work (sales,
  payments, stock entries) may be lost if the server is lost for good. Turso's
  continuous write log meets this directly for the last 24 hours; the daily encrypted
  backup is the fallback beyond that window, and its own loss bound is one day.

## Consequences

- `deploy/README.md`'s content changes shape: Render's service configuration, the
  GitHub Actions backup workflow and Turso's setup replace the VM provisioning steps,
  Caddy's Caddyfile, the DuckDNS update and the systemd units. There is no VM to bind to
  `127.0.0.1` or put a reverse proxy in front of; Render's own network boundary and TLS
  take that place.
- The restore drill (grilling round 3) still runs by hand, on the same cadence (once
  after going live, after any change to how the app or its backup are configured, and
  monthly), but restores from Turso's point-in-time restore and the daily encrypted
  backup instead of a Litestream replica. It still reports integrity, row counts and
  the restored copy's recency.
- The per-address and per-email login brakes, the `Secure` cookie once HTTPS is
  configured, and "no new admin surface in the app" (grilling rounds 2–3) are unchanged:
  none of them depended on which host or database serves the app.
- No secret for Turso, GitHub Actions or the `age` identity lives in the repository,
  the same invariant the original decision already carried.

## Considered and rejected

- **Oracle Cloud Always Free VM + Caddy + DuckDNS + Litestream + Backblaze B2**: the
  human's own earlier decision (2026-10-03), overridden the next day (2026-10-04) in
  favor of managed hosting that leaves no VM, reverse proxy or systemd unit for a single
  operator to provision and keep patched.
