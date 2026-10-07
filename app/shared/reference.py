"""The internal signal of a write that named a variety which was deleted at the same moment.

Code-less on purpose (docs/adr/0005): the driver's message never stays reachable. A use
case that catches it rolls back, asks its own lookup whether the variety is gone, and
raises its own gone code, or re-raises the original error when it is not.
"""


class ReferenceRefused(Exception):
    def __init__(self) -> None:
        super().__init__("a reference to a variety was refused")
