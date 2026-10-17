"""Seeds the phone check's server (GH-80): one business through the operator's own
invitation command and the API alone, never the front, with `sample_app.seed` at the
pinned date and `sample_app.stretch` on top, then writes what the Playwright run needs.

    python scripts/design/mobile_seed.py --base URL --state FILE --facts FILE

The environment must be the one the server runs with (`web/e2e/env.ts`'s `mobileEnv()`),
because the invitation and reset links are minted by the CLI against that database.
`--state` is a Playwright `storageState` holding the session cookie and no origins;
`--facts` holds the ids and tokens the registry's `{placeholders}` name. The walk only
reads: every write it makes is aborted or stubbed, so one token serves every cell.
"""

from __future__ import annotations

import argparse
import json
import os
from datetime import date
from pathlib import Path

import sample_app

PINNED_DAY = date(2026, 9, 16)


def storage_state(api: sample_app.HttpApi) -> dict[str, object]:
    cookies = [
        {
            "name": cookie.name,
            "value": cookie.value,
            "domain": cookie.domain,
            "path": cookie.path,
            "expires": -1,
            "httpOnly": True,
            "secure": cookie.secure,
            "sameSite": "Lax",
        }
        for cookie in api.jar
    ]
    return {"cookies": cookies, "origins": []}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="mobile-seed")
    parser.add_argument("--base", required=True)
    parser.add_argument("--state", type=Path, required=True)
    parser.add_argument("--facts", type=Path, required=True)
    args = parser.parse_args(argv)

    env = dict(os.environ)
    token = sample_app.new_business_token(env)
    api = sample_app.HttpApi(args.base)
    api.call(
        "POST",
        f"/invitations/{token}/accept",
        {
            "email": sample_app.EMAIL,
            "password": sample_app.PASSWORD,
            "business_name": sample_app.BUSINESS,
        },
    )
    api.call("POST", "/auth/login", {"email": sample_app.EMAIL, "password": sample_app.PASSWORD})
    sample = sample_app.seed(api, PINNED_DAY)
    sample_app.stretch(api, PINNED_DAY)
    links = {
        "new_business_token": sample_app.new_business_token(env),
        "join_token": sample_app.token_from(api.call("POST", "/invitations")["url"]),
        "reset_token": sample_app.reset_token(env, sample_app.EMAIL),
    }
    args.state.parent.mkdir(parents=True, exist_ok=True)
    args.state.write_text(json.dumps(storage_state(api)), encoding="utf-8")
    facts = {
        "email": sample_app.EMAIL,
        "password": sample_app.PASSWORD,
        "ids": {**sample_app.asdict(sample), **links},
    }
    args.facts.write_text(json.dumps(facts, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
