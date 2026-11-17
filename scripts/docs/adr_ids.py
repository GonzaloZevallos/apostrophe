"""The one reader of ADR ids: file names, citations and supersede marks (GH-693).

New ADRs are `docs/adr/YYYYMMDD-slug.md` and their id is the whole stem (`ADR-20261111-slug`),
so two branches never take the same number. The 83 `NNNN-slug.md` ADRs keep their names and
their citations; their id is the four digits. Every check that reads an ADR id goes through
this module, so `tests/` holds no ADR-id, citation or supersede-mark pattern of its own.
Imports nothing from `app` or `tests`.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime
from typing import Literal

# `[0-9]`, not `\d`: `\d` also matches non-ASCII decimal digits, which are no part of an id.
_LEGACY_NAME = re.compile(r"^[0-9]{4}-[a-z0-9-]+\.md$")
_DATED_NAME = re.compile(r"^([0-9]{8})((?:-[a-z0-9]+)+)\.md$")

# An id inside running text. The dated form comes first: `20261111-x` must never be read as
# the legacy `2026`. A dated id ends at the first character outside `[a-z0-9-]` and a trailing
# hyphen is no part of it; an uppercase letter or digit glued to it makes it no id at all. A
# legacy id is exactly four digits, so `ADR-00271` is not `0027`.
ID_TEXT = r"(?:[0-9]{8}(?:-[a-z0-9]+)+(?![A-Za-z0-9])|[0-9]{4}(?![0-9]))"

# `ADR-<id>`, `docs/adr/<id>` and `docs/adr/<id>.md` (a legacy path also carries its slug:
# `docs/adr/0027-<slug>.md`). `.md` is an extension only when no letter or digit follows it. A
# citation names the full stem, never a prefix of it. `bad` catches what starts like a dated id
# but is none (`ADR-20261111-X`, `docs/adr/20261111-x.mdx`), so it is reported, not skipped.
CITATION_PATTERN = re.compile(
    r"(?:docs/adr/|ADR-)(?:"
    rf"(?P<id>{ID_TEXT})(?!\.md[a-z0-9])(?P<ext>(?P<slug>-[a-z0-9-]+)?\.md(?![a-z0-9]))?"
    r"|(?P<bad>[0-9]{8}[-A-Za-z0-9]*)"
    r")"
)

# After whitespace collapses, a line break between a prefix and its id is one space.
JOINED_PREFIX = re.compile(rf"(docs/adr/|ADR-) (?={ID_TEXT}|[0-9]{{8}})")

# The index row of a replaced ADR says `reemplazada por <id>`; its own front matter says
# `status: superseded by <id>`.
SUPERSEDED_MARK = re.compile(rf"reemplazada por ({ID_TEXT})")
SUPERSEDED_STATUS = re.compile(rf"^superseded by ({ID_TEXT})")


@dataclass(frozen=True)
class AdrId:
    """`key` is `0027` for a legacy ADR and the whole stem `20261111-slug` for a dated one."""

    kind: Literal["legacy", "dated"]
    key: str

    @property
    def slug_after_date(self) -> str | None:
        """The slug that follows the date of a dated id; None for a legacy one."""
        return self.key.split("-", 1)[1] if self.kind == "dated" else None


def adr_id_from_file_name(name: str) -> AdrId | None:
    """The id of a file name `NNNN-slug.md` or `YYYYMMDD-slug.md`, or None for any other
    name. The eight digits of a dated name must be a real calendar date; the date is never
    compared with today."""
    if _LEGACY_NAME.match(name):
        return AdrId("legacy", name[:4])
    dated = _DATED_NAME.match(name)
    if dated is None:
        return None
    try:
        datetime.strptime(dated.group(1), "%Y%m%d")
    except ValueError:
        return None
    return AdrId("dated", name.removesuffix(".md"))


def adr_id_from_text(text: str) -> AdrId | None:
    """The id an `ID_TEXT` match names: four digits are legacy, the rest dated."""
    if re.fullmatch(r"[0-9]{4}", text):
        return AdrId("legacy", text)
    return AdrId("dated", text) if re.fullmatch(ID_TEXT, text) else None


def flatten_citation_text(text: str) -> str:
    """Whitespace runs become one space and a break after `ADR-` or `docs/adr/` closes up, so
    a citation wrapped across lines is still found by `CITATION_PATTERN`."""
    return JOINED_PREFIX.sub(r"\1", " ".join(text.split()))


def superseded_by(status: str | None) -> str | None:
    """The id text of a `superseded by <id>` status line, or None."""
    found = SUPERSEDED_STATUS.match(status) if status is not None else None
    return found.group(1) if found else None


# The `NNNN-` ADRs on master when this scheme began. The set is closed: a new ADR is named
# `YYYYMMDD-slug.md` and nothing is ever added here.
LEGACY_ADR_NAMES: frozenset[str] = frozenset(
    {
        "0001-stack-and-shape.md",
        "0002-users-invitations-and-a-signed-session.md",
        "0003-a-sale-line-records-its-price.md",
        "0004-businesses-never-mix.md",
        "0005-no-request-data-in-answers-or-logs.md",
        "0006-capabilities-meet-through-ports.md",
        "0007-a-sale-stores-its-line-totals-and-its-on-the-spot-payment.md",
        "0008-refusals-carry-a-code-the-front-maps.md",
        "0009-cost-of-goods-follows-its-lots-never-frozen.md",
        "0010-cost-of-goods-is-allocated-on-read-rounded-along-lot-order.md",
        "0011-sales-answer-a-read-shape-and-unknown-references-are-gone.md",
        "0012-settlement-is-worked-out-on-read-and-the-balance-guard-is-one-statement.md",
        "0013-the-panel-is-composed-from-each-owner-s-own-figures.md",
        "0014-upkeep-runs-after-the-commit-and-compares-text-before-sending.md",
        "0015-business-removal-reflects-the-schema-and-deletes-what-it-exported.md",
        "0016-render-turso-and-uptimerobot-replace-the-oracle-vm.md",
        "0017-deploying-render-turso-backups-and-the-restore-drill.md",
        "0018-the-spreadsheet-import-plans-through-owner-ports-then-writes-once.md",
        "0019-a-reset-link-exists-only-while-live-and-is-spent-in-one-statement.md",
        "0020-period-figures-are-summed-once-in-results.md",
        "0021-a-customer-is-identified-by-their-record-and-the-phone-is-optional.md",
        "0022-the-catalog-text-has-one-author-and-markers-pass-through.md",
        "0023-what-telegram-receives.md",
        "0024-a-front-path-may-share-its-first-segment-with-the-api-only-through-an-exact-allowlist-served-to-browser-navigations.md",
        "0025-the-getting-in-screens-share-one-auth-page.md",
        "0026-the-theme-choice-is-the-only-thing-the-browser-stores.md",
        "0027-a-sheet-s-open-state-lives-in-history.md",
        "0028-the-sales-form-pins-itself-to-the-visual-viewport.md",
        "0029-text-contrast-is-a-readme-table-checked-by-one-guard.md",
        "0030-varieties-front-paths-are-served-by-id-patterns-and-legacy-ids-are-carried-across-server-side.md",
        "0031-a-withdrawal-is-a-third-draw-source-in-stock-with-an-explicit-source.md",
        "0032-a-variety-is-archived-by-a-stored-instant-and-its-history-is-computed.md",
        "0033-front-paths-are-id-templates-the-legacy-rows-live-once-in-app-and-screens-json-is-cross-checked.md",
        "0034-pricing-switches-live-in-their-own-table-and-the-lowest-applicable-rule-prices-a-line.md",
        "0035-muestra-is-rendered-from-the-seed-at-a-pinned-date-and-screens-are-checked-against-it.md",
        "0036-the-onboarding-stores-only-its-passes-and-its-end-done-ness-is-derived-steps-write-through-their-owners-and-its-api-is-onboarding-progress.md",
        "0037-boton-draws-the-icon-and-text-rule-as-a-type.md",
        "0038-a-300-ms-speed-metric-is-guarded-by-query-plan-and-statement-count-never-by-elapsed-time.md",
        "0039-affected-only-checks-vitest-by-its-graph-plus-guards-e2e-only-for-e2e-only-changes-pytest-full.md",
        "0040-e2e-isolates-by-worker.md",
        "0041-the-tests-check-runs-in-parallel-with-pytest-xdist.md",
        "0042-design-captures-pin-their-fonts-and-before-after-compares-raw-captures-at-exact-ae.md",
        "0043-the-operator-commands-take-their-clock-tests-never-read-the-wall-clock.md",
        "0044-the-price-form-on-a-computer-is-a-modal-drawn-by-its-own-route.md",
        "0045-the-shell-draws-the-chrome-and-a-parent-varies-only-by-its-record.md",
        "0046-the-first-run-facts-live-in-their-own-table-and-a-read-stamps-them-in-a-second-guarded-phase.md",
        "0047-the-customer-s-channel-is-dropped-for-good.md",
        "0048-the-phone-check-measures-the-dom-for-what-a-person-reads.md",
        "0049-the-product-s-words-live-in-one-keyed-module.md",
        "0050-the-product-speaks-through-keyed-catalogs-and-a-forced-test-locale.md",
        "0051-operator-text-comes-from-the-operator-translator-never-from-a-business.md",
        "0052-one-shot-method-for-every-design-capture-row-and-side.md",
        "0053-a-shareable-text-is-worked-out-in-the-front-from-facts-the-server-sends.md",
        "0054-local-checks-and-ci-run-one-list-enforced-by-a-test.md",
        "0055-configuration-is-stored-per-business-in-hexagons-split-by-reason-to-change-with-frozen-shared-values-read-through-each-reader-s-own-protocol.md",
        "0056-a-stored-quantity-is-a-whole-number-of-hundredths-whatever-the-unit-and-decimals-only-validate-and-display.md",
        "0057-the-business-time-zone-replaces-argentina-days-today-is-worked-out-per-business-and-upkeep-is-due-when-its-last-check-was-not-on-the-business-s-own-today.md",
        "0058-money-crosses-the-wire-in-currency-units-as-decimal-and-is-stored-per-business-at-scale-0-or-2-behind-one-adapter-helper.md",
        "0059-customer-type-prices-are-effective-dated-rows-and-the-vip-mark-and-vip-price-columns-stay-frozen-in-place.md",
        "0060-the-applied-promotion-snapshot-is-typed-sale-promotion-rows-recorded-as-the-sale-stood-when-saved-and-never-recomputed.md",
        "0061-columns-keep-variety-id-until-75-while-code-and-the-api-say-product.md",
        "0062-on-the-phone-a-form-is-drawn-by-one-sheet.md",
        "0063-the-technical-docs-come-only-from-the-generator-and-are-built-by-pinned-offline-tools.md",
        "0064-ci-selection-is-a-union-of-path-rules-that-fails-closed.md",
        "0066-technical-docs-are-generated-by-one-command-and-gated-for-staleness.md",
        "0067-ci-runs-only-the-suites-a-change-affects-in-shards-with-coverage.md",
        "0068-architecture-docs-cite-defined-symbols-checked-by-text.md",
        "0069-un-solo-dueno-del-scroll-al-cambiar-de-pantalla-con-offsets-en-memoria.md",
        "0070-the-vip-type-is-the-single-is-vip-row-of-a-business-set-only-by-the-migration-and-the-import-and-never-identified-by-name.md",
        "0071-a-refusal-may-carry-named-fields-next-to-its-code.md",
        "0072-una-corrida-manual-de-ci-yml-en-un-sha-juzga-el-head-con-el-workflow-de-master.md",
        "0073-a-sale-number-is-a-counter-on-the-business-raised-only-by-the-sale-insert.md",
        "0074-fixed-chip-sets-are-a-branded-type-declared-in-one-registry-the-native-select-is-banned-and-the-selector-is-the-only-control-for-a-growable-set.md",
        "0075-the-screen-word-is-always-product-and-no-product-word-setting-exists.md",
        "0076-a-design-capture-side-that-misses-for-load-is-recaptured-whole-from-a-fresh-context-unless-it-wrote.md",
        "0077-the-login-guard-tables-have-a-surrogate-id-and-stay-keyed-by-a-unique-column.md",
        "0078-an-in-page-sheet-that-is-a-history-entry-guards-its-dirty-back-with-the-leave-guards-sheet-floor.md",
        "0079-screen-images-are-built-only-lossless-webp-at-dpr-1-on-the-pinned-instant-in-the-pinned-playwright-container.md",
        "0080-an-existing-business-raises-its-decimals-once-by-a-conditional-rescale-guarded-at-commit.md",
        "0081-home-no-muestra-avisos-de-primer-uso-y-onboarding-en-finish-termina-el-onboarding.md",
        "0082-a-phone-number-with-a-listed-country-code-follows-that-country-s-rule-and-the-rules-live-in-one-shared-table.md",
        "0083-auth-me-carries-the-business-money-format-and-the-front-keeps-one-module-level-format-set-from-it.md",
        "0084-the-server-groups-every-phone-number-for-display-from-the-shared-table-and-the-front-only-renders-it.md",
    }
)
