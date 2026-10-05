"""Canonicalising a client address for the login brake (CODING_STANDARDS section 9):
`address_key` is pure, standard-library-only domain logic, no infrastructure."""

from ipaddress import ip_address

from app.accounts.domain.address import address_key


def test_an_ipv4_address_is_its_own_key() -> None:
    assert address_key(ip_address("203.0.113.5")) == "203.0.113.5"


def test_an_ipv4_mapped_ipv6_address_is_keyed_as_its_ipv4() -> None:
    assert address_key(ip_address("::ffff:203.0.113.5")) == "203.0.113.5"


def test_two_ipv6_addresses_in_one_slash_64_give_the_same_key() -> None:
    first = address_key(ip_address("2001:db8:1::1"))
    second = address_key(ip_address("2001:db8:1::2"))

    assert first == second


def test_two_ipv6_addresses_in_different_slash_64s_give_different_keys() -> None:
    first = address_key(ip_address("2001:db8:1::1"))
    second = address_key(ip_address("2001:db8:2::1"))

    assert first != second
