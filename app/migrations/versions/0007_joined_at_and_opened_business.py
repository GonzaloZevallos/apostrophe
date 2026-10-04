"""`app_user.joined_at` and the opened-business link.

Revision ID: 0007
Revises: 0006

Backfills from two facts that hold until this task ships: ids only grow, and every
business and every user came from accepting an invitation.

- Opening invitations: used `new_business` invitations ordered by `(used_at, id)` are
  paired, one to one, with businesses ordered by `id` -- but only if the two counts are
  equal. Each pair sets the invitation's `business_id` and the business's lowest-id
  user's `joined_at` to the invitation's `used_at`.
- Join invitations: within each business, used `join_business` invitations ordered by
  `(used_at, id)` are paired with the business's remaining users (the ones not already
  stamped above) ordered by `id` -- again only if those counts are equal.

Any count mismatch leaves the rows it would have touched NULL rather than guessing.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("app_user", sa.Column("joined_at", sa.DateTime(), nullable=True))

    connection = op.get_bind()
    invitation = sa.table(
        "invitation",
        sa.column("id", sa.Integer()),
        sa.column("kind", sa.String()),
        sa.column("business_id", sa.Integer()),
        sa.column("used_at", sa.DateTime()),
    )
    business = sa.table("business", sa.column("id", sa.Integer()))
    app_user = sa.table(
        "app_user",
        sa.column("id", sa.Integer()),
        sa.column("business_id", sa.Integer()),
        sa.column("joined_at", sa.DateTime()),
    )

    opening_invitations = connection.execute(
        sa.select(invitation.c.id, invitation.c.used_at)
        .where(invitation.c.kind == "new_business", invitation.c.used_at.isnot(None))
        .order_by(invitation.c.used_at, invitation.c.id)
    ).all()
    businesses = connection.execute(sa.select(business.c.id).order_by(business.c.id)).all()

    first_user_of: dict[int, int] = {}
    if len(opening_invitations) == len(businesses):
        for (invitation_id, used_at), (business_id,) in zip(
            opening_invitations, businesses, strict=True
        ):
            connection.execute(
                invitation.update()
                .where(invitation.c.id == invitation_id)
                .values(business_id=business_id)
            )
            first_user = connection.execute(
                sa.select(app_user.c.id)
                .where(app_user.c.business_id == business_id)
                .order_by(app_user.c.id)
                .limit(1)
            ).scalar_one_or_none()
            if first_user is not None:
                connection.execute(
                    app_user.update()
                    .where(app_user.c.id == first_user)
                    .values(joined_at=used_at)
                )
                first_user_of[business_id] = first_user

    for (business_id,) in businesses:
        join_invitations = connection.execute(
            sa.select(invitation.c.id, invitation.c.used_at)
            .where(
                invitation.c.kind == "join_business",
                invitation.c.business_id == business_id,
                invitation.c.used_at.isnot(None),
            )
            .order_by(invitation.c.used_at, invitation.c.id)
        ).all()
        remaining_users = connection.execute(
            sa.select(app_user.c.id)
            .where(
                app_user.c.business_id == business_id,
                app_user.c.id != first_user_of.get(business_id, -1),
            )
            .order_by(app_user.c.id)
        ).all()
        if len(join_invitations) == len(remaining_users):
            for (_, used_at), (user_id,) in zip(join_invitations, remaining_users, strict=True):
                connection.execute(
                    app_user.update().where(app_user.c.id == user_id).values(joined_at=used_at)
                )


def downgrade() -> None:
    connection = op.get_bind()
    invitation = sa.table(
        "invitation", sa.column("kind", sa.String()), sa.column("business_id", sa.Integer())
    )
    connection.execute(
        invitation.update().where(invitation.c.kind == "new_business").values(business_id=None)
    )
    op.drop_column("app_user", "joined_at")
