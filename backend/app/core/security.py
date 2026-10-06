from datetime import UTC, datetime, timedelta

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db

ALGORITHM = "HS256"

security = HTTPBearer()

# bcrypt only reads the first 72 bytes of a password, and bcrypt>=5 raises
# ValueError for anything longer instead of silently truncating.
BCRYPT_MAX_PASSWORD_BYTES = 72


def password_too_long(password: str) -> bool:
    return len(password.encode()) > BCRYPT_MAX_PASSWORD_BYTES


def hash_password(password: str) -> str:
    """Hash a password. Raises ValueError if it is longer than 72 bytes."""
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    """Check a password against a bcrypt hash. Blocking (~0.25s at the
    default cost): call it from a worker thread in request handlers."""
    if password_too_long(plain):
        return False
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(user_id: str) -> str:
    expire = datetime.now(UTC) + timedelta(days=settings.access_token_expire_days)
    to_encode = {"exp": expire, "sub": user_id}
    return jwt.encode(to_encode, settings.secret_key, algorithm=ALGORITHM)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
):
    from app.models.user import User

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid authentication credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(credentials.credentials, settings.secret_key, algorithms=[ALGORITHM])
        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception

    return user
