"""`fetch` of scripts/docs/ci-fetch.sh against a local stub server: retries, cache hit, labels."""

from __future__ import annotations

import hashlib
import os
import subprocess
import threading
from collections.abc import Iterator
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
BODY = b"the archive bytes"
SHA = hashlib.sha256(BODY).hexdigest()


class Stub:
    """A server that answers each request with the next scripted status; 200 serves `body`."""

    def __init__(self) -> None:
        self.statuses: list[int] = []
        self.body = BODY
        self.requests = 0
        stub = self

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self) -> None:
                stub.requests += 1
                status = stub.statuses.pop(0) if stub.statuses else 200
                payload = stub.body if status == 200 else b"unavailable"
                self.send_response(status)
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)

            def log_message(self, format: str, *args: object) -> None:
                return

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)

    @property
    def url(self) -> str:
        return f"http://127.0.0.1:{self.server.server_address[1]}/archive.tar.gz"


@pytest.fixture
def stub() -> Iterator[Stub]:
    server = Stub()
    thread = threading.Thread(target=server.server.serve_forever, daemon=True)
    thread.start()
    yield server
    server.server.shutdown()
    server.server.server_close()
    thread.join()


def _fetch(stub: Stub, file: Path) -> subprocess.CompletedProcess[str]:
    env = {
        **os.environ,
        "URL": stub.url,
        "SHA": SHA,
        "FILE": str(file),
        "CI_FETCH_RETRY_DELAY": "1",
    }
    return subprocess.run(
        ["bash", "-c", 'source scripts/docs/ci-fetch.sh && fetch demo 1.0.0 "$URL" "$SHA" "$FILE"'],
        cwd=REPO_ROOT,
        env=env,
        capture_output=True,
        text=True,
        check=False,
        timeout=60,
    )


def test_two_504s_then_a_200_succeeds_after_three_requests(stub: Stub, tmp_path: Path) -> None:
    stub.statuses = [504, 504, 200]
    file = tmp_path / "demo.tar.gz"
    result = _fetch(stub, file)
    assert result.returncode == 0, result.stderr
    assert file.read_bytes() == BODY
    assert stub.requests == 3


def test_a_download_that_always_fails_names_the_tool_and_says_download_failure(
    stub: Stub, tmp_path: Path
) -> None:
    stub.statuses = [504] * 50
    file = tmp_path / "demo.tar.gz"
    result = _fetch(stub, file)
    assert result.returncode != 0
    assert (
        "::error title=CI infrastructure::could not download demo 1.0.0 from GitHub releases "
        "after retries; this is a download failure, not a docs failure"
    ) in result.stderr
    assert not file.exists()


def test_a_valid_file_already_present_is_used_without_a_request(stub: Stub, tmp_path: Path) -> None:
    file = tmp_path / "demo.tar.gz"
    file.write_bytes(BODY)
    result = _fetch(stub, file)
    assert result.returncode == 0, result.stderr
    assert stub.requests == 0
    assert file.read_bytes() == BODY


def test_a_corrupt_file_already_present_is_downloaded_again(stub: Stub, tmp_path: Path) -> None:
    file = tmp_path / "demo.tar.gz"
    file.write_bytes(b"corrupt")
    result = _fetch(stub, file)
    assert result.returncode == 0, result.stderr
    assert stub.requests == 1
    assert file.read_bytes() == BODY


def test_a_download_with_the_wrong_bytes_is_refused_as_a_checksum_mismatch(
    stub: Stub, tmp_path: Path
) -> None:
    stub.body = b"someone else's bytes"
    file = tmp_path / "demo.tar.gz"
    result = _fetch(stub, file)
    assert result.returncode != 0
    assert (
        "::error title=CI infrastructure::checksum mismatch for demo 1.0.0 after download"
    ) in result.stderr
    assert not file.exists()
