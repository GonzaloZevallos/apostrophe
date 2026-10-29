"""The offline API reference: pure HTML rules and the `run` path, in memory only.

Nothing here spawns node or redocly, and nothing reads the committed `docs/api/` tree.
"""

from __future__ import annotations

import tempfile
from pathlib import Path

from scripts.docs.generate import run
from scripts.docs.reference import offline_problems, reference_file, strip_attribution
from scripts.docs.text import HEADER
from tests.docs.test_generate import FakeTools, _accepting, _fake_repo, _openapi, _snapshot

REPO = Path("/srv/checkout/apostrophe")
REDOCLY_CALL = "reference/api"


def _rules(html: str) -> list[tuple[str, str]]:
    return [(p.rule, p.detail) for p in offline_problems(html, REPO)]


def test_a_clean_document_has_no_problem() -> None:
    html = '<html><a href="#tag/x">x</a><img src="data:image/png;base64,AAA"></html>'
    assert offline_problems(html, REPO) == []


def test_an_external_src_is_reported_with_its_link() -> None:
    html = '<script src="https://cdn.example.com/app.js"></script>'
    assert _rules(html) == [("external-link", "src=https://cdn.example.com/app.js")]


def test_an_external_href_is_reported_with_its_link() -> None:
    html = '<link rel="stylesheet" href="http://fonts.example.com/css">'
    assert _rules(html) == [("external-link", "href=http://fonts.example.com/css")]


def test_a_protocol_relative_url_is_reported() -> None:
    assert _rules('<img src="//cdn.example.com/a.png">') == [
        ("external-link", "src=//cdn.example.com/a.png")
    ]


def test_an_uppercase_scheme_and_padded_value_are_still_external() -> None:
    assert _rules('<a href=" HTTPS://x.example/ ">x</a>') == [
        ("external-link", "href=HTTPS://x.example/")
    ]


def test_the_same_link_twice_is_reported_once() -> None:
    html = '<a href="https://x.example/">1</a><a href="https://x.example/">2</a>'
    assert len(offline_problems(html, REPO)) == 1


def test_a_link_inside_script_or_style_content_is_not_a_tag() -> None:
    html = (
        "<script>var a = '<a href=\"https://x.example/\">';</script>"
        '<style>.a{background:url("//x.example/a.png")}</style>'
        '<a href="#ok">ok</a>'
    )
    assert offline_problems(html, REPO) == []


def test_the_repo_path_is_a_machine_path() -> None:
    html = f"<p>built in {REPO}/docs</p>"
    assert ("machine-path", f"found {REPO}") in _rules(html)


def test_the_temp_dir_is_a_machine_path() -> None:
    tmp = tempfile.gettempdir()
    assert ("machine-path", f"found {tmp}") in _rules(f"<p>{tmp}/docs-gen-x/index.html</p>")


def test_a_home_directory_is_a_machine_path() -> None:
    assert ("machine-path", "found /home/someone/") in _rules("<p>/home/someone/project</p>")


def test_a_route_that_merely_contains_home_is_clean() -> None:
    assert offline_problems("<code>GET /api/home/x</code><i>../home/x/y</i>", REPO) == []


# --- strip_attribution ----------------------------------------------------------------

ATTRIBUTION = (
    '<a target="_blank" rel="noopener noreferrer" href="https://redocly.com/redoc/">'
    "<p>API docs by</p></a>"
)
SCRIPT = '<script>var l = `<a href="https://redocly.com/redoc/">API docs by</a>`;\n</script>'


def test_the_attribution_loses_only_its_href() -> None:
    page = (
        f"<html>\n<style>.a {{ b: c }}</style>\n<div>\n  {ATTRIBUTION}\n</div>\n{SCRIPT}\n</html>\n"
    )
    stripped = strip_attribution(page)
    assert stripped == page.replace('href="https://redocly.com/redoc/"', "", 1)
    assert stripped.count("redocly.com") == 1  # the one inside <script>, untouched
    assert offline_problems(stripped, REPO) == []


def test_the_attribution_with_nested_markup_and_single_quotes_is_found() -> None:
    page = "<p>x</p>\n<a href='https://redocly.com/redoc/' class=\"k\">"
    page += "<p>API docs by</p><svg></svg></a>"
    assert strip_attribution(page) == ('<p>x</p>\n<a  class="k"><p>API docs by</p><svg></svg></a>')


def test_another_external_anchor_is_left_in_place_and_then_reported() -> None:
    other = '<a href="https://example.com/">Example</a>'
    page = f"{other}{ATTRIBUTION}"
    stripped = strip_attribution(page)
    assert other in stripped
    assert [p.detail for p in offline_problems(stripped, REPO)] == ["href=https://example.com/"]


def test_an_anchor_with_the_wrong_text_is_not_the_attribution() -> None:
    page = '<a href="https://redocly.com/redoc/">Redocly home</a>'
    assert strip_attribution(page) == page


def test_a_local_anchor_with_the_attribution_text_keeps_its_href() -> None:
    page = '<a href="#top"><p>API docs by</p></a>'
    assert strip_attribution(page) == page


def test_a_page_without_the_attribution_is_returned_unchanged() -> None:
    assert (
        strip_attribution("<html><body>none</body></html>\n") == "<html><body>none</body></html>\n"
    )


def test_the_attribution_after_crlf_lines_is_located_by_position() -> None:
    page = f"<p>a</p>\r\n<p>b</p>\r\n{ATTRIBUTION}\r\n"
    assert strip_attribution(page) == page.replace('href="https://redocly.com/redoc/"', "", 1)


# --- reference_file -------------------------------------------------------------------


def test_the_header_sits_at_byte_zero_and_the_page_follows() -> None:
    out = reference_file("<!DOCTYPE html>\r\n<p>x</p>\r\n\r\n")
    assert out.encode().startswith(HEADER.encode())
    assert out == f"{HEADER}\n<!DOCTYPE html>\n<p>x</p>\n"


# --- through `run` --------------------------------------------------------------------

PAGE = "<!DOCTYPE html>\r\n<html><body><p>API</p></body></html>\r\n"


def _run(repo: Path, page: str) -> tuple[int, list[str]]:
    lines: list[str] = []
    code = run(
        repo,
        run_tool=FakeTools({REDOCLY_CALL: page}),
        validate=_accepting,
        openapi=_openapi,
        report=lines.append,
    )
    return code, lines


def test_a_clean_page_is_written_with_the_header_and_linked_from_the_readme(
    tmp_path: Path,
) -> None:
    repo = _fake_repo(tmp_path)
    code, lines = _run(repo, PAGE)
    assert (code, lines) == (0, [])
    written = (repo / "docs/api/index.html").read_bytes()
    assert written.startswith(HEADER.encode())
    assert written == reference_file(PAGE).encode()
    assert "[index.html](index.html)" in (repo / "docs/api/README.md").read_text()
    assert (repo / "docs/api/openapi.json").read_text() == _openapi()


def test_the_redocly_call_gets_the_exported_document_as_its_only_input(tmp_path: Path) -> None:
    repo = _fake_repo(tmp_path)
    tools = FakeTools()
    run(repo, run_tool=tools, validate=_accepting, openapi=_openapi)
    (call,) = [c for c in tools.calls if c.tool == "redocly"]
    assert call.inputs == (("openapi.json", _openapi()),)


def test_the_attribution_href_is_stripped_before_the_page_is_checked(tmp_path: Path) -> None:
    repo = _fake_repo(tmp_path)
    code, lines = _run(repo, f"<html><body>{ATTRIBUTION}</body></html>\n")
    assert (code, lines) == (0, [])
    written = (repo / "docs/api/index.html").read_text()
    assert "redocly.com" not in written
    assert "<p>API docs by</p>" in written


def test_an_external_link_exits_1_names_the_rule_and_leaves_docs_unchanged(
    tmp_path: Path,
) -> None:
    repo = _fake_repo(tmp_path)
    assert _run(repo, PAGE)[0] == 0
    before = _snapshot(repo / "docs")
    code, lines = _run(repo, '<html><script src="https://cdn.example.com/a.js"></script></html>')
    assert code == 1
    assert lines == [
        "docs/api/index.html: block 0: external-link: src=https://cdn.example.com/a.js"
    ]
    assert _snapshot(repo / "docs") == before


def test_an_external_link_on_a_first_run_writes_nothing(tmp_path: Path) -> None:
    repo = _fake_repo(tmp_path)
    code, _lines = _run(repo, '<link href="//fonts.example.com/css">')
    assert code == 1
    assert not (repo / "docs").exists()


def test_the_checkout_path_in_the_page_exits_1(tmp_path: Path) -> None:
    repo = _fake_repo(tmp_path)
    code, lines = _run(repo, f"<p>{repo}/docs</p>")
    assert code == 1
    assert f"docs/api/index.html: block 0: machine-path: found {repo}" in lines
    assert f"docs/api/index.html: block 0: absolute-path: found {repo}" in lines
    assert not (repo / "docs").exists()


def test_a_home_directory_in_the_page_exits_1(tmp_path: Path) -> None:
    repo = _fake_repo(tmp_path)
    code, lines = _run(repo, "<p>/home/someone/project/x.py</p>")
    assert code == 1
    assert lines == ["docs/api/index.html: block 0: machine-path: found /home/someone/"]


def test_the_page_bytes_do_not_depend_on_the_run(tmp_path: Path) -> None:
    first = tmp_path / "a"
    second = tmp_path / "b"
    for repo in (first, second):
        repo.mkdir()
        _fake_repo(repo)
        assert _run(repo, PAGE)[0] == 0
    assert (first / "docs/api/index.html").read_bytes() == (
        second / "docs/api/index.html"
    ).read_bytes()
