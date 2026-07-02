import secrets

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password, verify_password
from app.models.user import User

# Unambiguous alphabet (no 0/O, 1/l/I) so passwords are easy to read aloud.
_PASSWORD_ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789"
_PASSWORD_LENGTH = 12


def generate_password() -> str:
    return "".join(secrets.choice(_PASSWORD_ALPHABET) for _ in range(_PASSWORD_LENGTH))


def password_collides(password: str, users: list[User]) -> bool:
    """Login identifies users by password alone, so passwords must be unique."""
    return any(verify_password(password, u.password_hash) for u in users)


async def list_users(db: AsyncSession) -> list[User]:
    result = await db.execute(select(User).order_by(User.created_at))
    return list(result.scalars().all())


async def create_user(db: AsyncSession, name: str, password: str | None) -> tuple[User, str]:
    """Create a user, returning it with the plaintext password (shown once)."""
    users = await list_users(db)

    if password is None:
        password = generate_password()
        while password_collides(password, users):
            password = generate_password()
    elif password_collides(password, users):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Password already in use by another user — passwords identify "
            "users at login and must be unique",
        )

    user = User(name=name, password_hash=hash_password(password))
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user, password


async def delete_user(db: AsyncSession, user_id: str, current_user: User) -> None:
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    await db.delete(user)
    await db.commit()
