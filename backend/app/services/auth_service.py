"""Password login: users are identified by their (unique) password alone."""

from fastapi import HTTPException, status
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rate_limit import login_limiter
from app.core.security import create_access_token, password_too_long, verify_password
from app.models.user import User
from app.schemas.auth import TokenResponse


def _first_match(password: str, hashes: list[str]) -> int | None:
    for index, hashed in enumerate(hashes):
        if verify_password(password, hashed):
            return index
    return None


async def authenticate(db: AsyncSession, password: str) -> User | None:
    """Return the user whose password matches, or None.

    bcrypt is deliberately slow, so the checks run in a worker thread
    instead of blocking the event loop for every user.
    """
    if password_too_long(password):
        # bcrypt can't hash it, so no stored password can match.
        return None
    users = list((await db.execute(select(User))).scalars().all())
    index = await run_in_threadpool(_first_match, password, [u.password_hash for u in users])
    return None if index is None else users[index]


async def login(db: AsyncSession, password: str, *, client_ip: str) -> TokenResponse:
    retry_after = login_limiter.retry_after(client_ip)
    if retry_after:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts. Try again later.",
            headers={"Retry-After": str(retry_after)},
        )

    user = await authenticate(db, password)
    if user is None:
        login_limiter.record_failure(client_ip)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid password",
        )

    login_limiter.reset(client_ip)
    return TokenResponse(access_token=create_access_token(user.id), user_name=user.name)
