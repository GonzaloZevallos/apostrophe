from __future__ import annotations

from sqlalchemy import ForeignKey, Index, String, UniqueConstraint, false, text
from sqlalchemy.orm import Mapped, mapped_column

from app.customer_types.domain.customer_type import NAME_MAX_LENGTH
from app.db import Base

ICON_MAX_LENGTH = 16


class CustomerTypeRow(Base):
    __tablename__ = "customer_type"
    # The folded name is what makes two names the same name within one business. The
    # partial unique index lets a business have at most one VIP type: the one the
    # upgrade or the import made, identified by `is_vip` and never by its name.
    __table_args__ = (
        UniqueConstraint("business_id", "name_key"),
        Index(None, "business_id", unique=True, sqlite_where=text("is_vip")),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("business.id"))
    name: Mapped[str] = mapped_column(String(NAME_MAX_LENGTH))
    name_key: Mapped[str] = mapped_column(String(NAME_MAX_LENGTH))
    # A key of `CustomerTypeIcon`; the closed set is a domain rule, not a schema one.
    icon: Mapped[str] = mapped_column(String(ICON_MAX_LENGTH))
    is_vip: Mapped[bool] = mapped_column(server_default=false())
