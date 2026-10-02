---
status: accepted
date: 2026-10-02
---

# FastAPI over SQLite, one hexagon per capability, money and grams as whole numbers

The product replaces a spreadsheet for small sellers, keeps several businesses in one
installation (docs/adr/0004), runs locally for now and is maintained by an agentic
development system that already works on a FastAPI + SQLite + uv
product (gym-saas). The toolchain is chosen so the system's setup and checks carry
over unchanged.

## Decision

- **API**: Python 3.13, FastAPI, SQLAlchemy 2.0 with typed `Mapped` columns, Alembic,
  pydantic at the HTTP edge. **SQLite** in a local file: a handful of businesses, one
  machine, no database server to run. uv for environments, pytest, ruff, mypy strict.
- **Front**: comes later, designed with Claude Design, built with React + Vite +
  TypeScript under `web/` in this same repository.
- **Shape**: one hexagon per capability under `app/<capability>/`:
  - `domain/` imports only the standard library, its own package and `app/shared/`;
  - `application/` holds one module per group of use cases and the ports, and never
    imports a framework, the database layer or an adapter;
  - `adapters/` holds tables, repositories, routers and schemas.
  `tests/architecture/` enforces this on every run; a new capability adds its root to
  `HEXAGON_ROOTS` in the diff that creates it. `app/shared/` is a shared kernel of value
  objects and imports only the standard library.
- **Tables** live in their capability's `adapters/tables.py` and are listed in
  `app/tables.py`; the schema test fails when the migrations and those tables disagree.
- **A use case that writes commits once, at its end**, through the `Transaction` port
  (`app/shared/transaction.py`, which a SQLAlchemy `Session` satisfies). Repositories
  flush and never commit, so a use case that touches several records lands whole.
- **Instants are stored in UTC** through `app.db.UtcDateTime`, which refuses naive
  datetimes.
- **Money is whole pesos** (`int`): prices in this business never carry cents.
- **Grams are whole hundredths** (`app/shared/grams.py`): exact sums, no float drift, and
  enough precision for a kitchen scale.
- **"Today" is the business day in Argentina time** (`app/clock.py`); the clock is
  injected so tests move it.

## Considered and rejected

- **SQLModel**, which gym-saas uses: its stubs fight mypy strict and gym-saas carries casts
  for it. Plain SQLAlchemy 2.0 types cleanly.
- **Postgres**: a server to install and back up for a handful of businesses; worth
  revisiting when the app is published.
- **TypeScript end to end (Next.js)**: one language and Claude Design's output drops in,
  but the agentic system has never run a JavaScript product; the API comes first and is
  where most of the logic lives.
- **Decimal pesos**: no price, cost or expense in the spreadsheet has ever had cents.
