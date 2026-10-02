# apostrophe

The back office of small businesses that sell flower by the gram: prices, sales, stock,
money owed, expenses and results, several businesses in one installation that never mix.
It replaces the spreadsheet `Control_de_ventas_y_gastos`.

Start with `BRIEF.md` (what and for whom), `CONTEXT.md` (the language, mandatory in code
and issues), `CODING_STANDARDS.md` and `docs/adr/`. Each capability's behaviour lives in
`docs/product/`.

This product is developed by the agentic system in `GonzaloZevallos/agentic-system`: work
arrives as issues labelled `agentic` and leaves as pull requests.

## Run it

Needs [uv](https://docs.astral.sh/uv/) 0.12.

```sh
cp .env.example .env          # then set APOSTROPHE_SECRET_KEY
uv venv --python 3.13
uv sync --locked --extra dev
scripts/serve.sh              # http://localhost:8000, and every device on the network
```

The database is created and migrated on startup (`apostrophe.db` by default). To reach it
from a phone, set `APOSTROPHE_PUBLIC_URL` to the computer's address on the network, for
example `http://192.168.0.10:8000`, so invitation links point there.

Open the first business:

```sh
scripts/invite-business.sh    # prints a link, valid once for 7 days
```

Until the front exists, accept it with the token at the end of the link:

```sh
curl -X POST localhost:8000/invitations/<token>/accept -H 'content-type: application/json' \
  -d '{"business_name": "Mi negocio", "email": "yo@example.com", "password": "at least 10 chars"}'
```

The API is described at `http://localhost:8000/docs`.

## Check it

```sh
uv run --no-project pytest
uv run --no-project ruff check .
uv run --no-project mypy app tests
```

The same three commands run in CI and are what the agentic system runs
(`.agentic/stack.yaml`). The guards worth knowing before adding a route or a table:

- `tests/test_gated_routes.py`: every route answers 401 without a session.
- `tests/test_business_isolation.py`: no route reaches another business's records.
- `tests/migrations/test_business_ownership.py`: every table carries `business_id`.
- `tests/architecture/`: the hexagon import rules.
- `tests/migrations/test_schema.py`: the migrations build exactly the declared tables.

## Changing the schema

Declare the table in its capability's `adapters/tables.py` (listed in `app/tables.py`),
then generate the revision against a scratch database brought to the current head:

```sh
export APOSTROPHE_DATABASE_URL=sqlite:////tmp/apostrophe-schema.db
rm -f /tmp/apostrophe-schema.db
uv run --no-project alembic upgrade head
uv run --no-project alembic revision --autogenerate --rev-id 0002 -m "what it adds"
uv run --no-project ruff format app/migrations/versions
```

Read the generated file before committing it: autogenerate misses some changes.
