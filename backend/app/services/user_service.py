import secrets

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    BCRYPT_MAX_PASSWORD_BYTES,
    hash_password,
    password_too_long,
    verify_password,
)
from app.models.user import User

# Unambiguous alphabet (no 0/O, 1/l/I) so passwords are easy to read aloud.
_PASSWORD_ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789"
_PASSWORD_LENGTH = 12


_NAME_MAX_LENGTH = 100  # users.name is VARCHAR(100)


class InvalidUserError(ValueError):
    """The requested user can't be created; the message says why."""


class PasswordCollisionError(InvalidUserError):
    """The password already belongs to another user."""


class PasswordTooLongError(InvalidUserError):
    """bcrypt can't hash passwords over 72 bytes."""


def generate_password() -> str:
    return "".join(secrets.choice(_PASSWORD_ALPHABET) for _ in range(_PASSWORD_LENGTH))


def password_collides(password: str, users: list[User]) -> bool:
    """Login identifies users by password alone, so passwords must be unique."""
    return any(verify_password(password, u.password_hash) for u in users)


async def list_users(db: AsyncSession) -> list[User]:
    result = await db.execute(select(User).order_by(User.created_at))
    return list(result.scalars().all())


async def create_user(db: AsyncSession, name: str, password: str | None) -> tuple[User, str]:
    """Create a user, returning it with the plaintext password (shown once).

    Raises an ``InvalidUserError`` subclass for an unusable name or password.
    """
    name = name.strip()
    if not name or len(name) > _NAME_MAX_LENGTH:
        raise InvalidUserError(f"Name must be 1-{_NAME_MAX_LENGTH} characters")
    if password is not None and password_too_long(password):
        raise PasswordTooLongError(
            f"Password is {len(password.encode())} bytes; the maximum is "
            f"{BCRYPT_MAX_PASSWORD_BYTES} bytes (bcrypt ignores anything beyond)"
        )
    if password is not None and not password:
        raise InvalidUserError("Password must not be empty")

    users = await list_users(db)

    if password is None:
        password = generate_password()
        while password_collides(password, users):
            password = generate_password()
    elif password_collides(password, users):
        raise PasswordCollisionError(
            "Password already in use by another user — passwords identify "
            "users at login and must be unique"
        )

    user = User(name=name, password_hash=hash_password(password))
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user, password


async def delete_user(db: AsyncSession, user_id: str) -> User:
    """Delete a user by id; owned data is removed via FK cascades."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise LookupError(f"No user with id {user_id}")

    await db.delete(user)
    await db.commit()
    return user
