"""Canonicalising a client address for the login brake (docs/adr/0002,
CODING_STANDARDS section 9): the brake only ever needs to tell two addresses apart,
never the address itself, so everything downstream (`ClientAddress` in
app/accounts/adapters/deps.py) digests this key, never the raw IP.
"""

from __future__ import annotations

from ipaddress import IPv4Address, IPv6Address, IPv6Network


def address_key(ip: IPv4Address | IPv6Address) -> str:
    """IPv4 as it is; an IPv4-mapped IPv6 as its IPv4; any other IPv6 by its /64
    network, so every host in one /64 counts as one address (the brake's accepted
    cost at IPv6 scale)."""
    if isinstance(ip, IPv6Address):
        mapped = ip.ipv4_mapped
        if mapped is not None:
            return str(mapped)
        network = IPv6Network(f"{ip}/64", strict=False)
        return str(network.network_address)
    return str(ip)
