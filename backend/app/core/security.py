from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.core.config import settings

ALGORITHM = "HS256"

security = HTTPBearer()


def create_access_token() -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.access_token_expire_days)
    to_encode = {"exp": expire, "sub": "user"}
    return jwt.encode(to_encode, settings.secret_key, algorithm=ALGORITHM)


def verify_password(password: str) -> bool:
    return password == settings.app_password


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> str:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid authentication credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(
            credentials.credentials, settings.secret_key, algorithms=[ALGORITHM]
        )
        sub: str | None = payload.get("sub")
        if sub is None:
            raise credentials_exception
        return sub
    except JWTError:
        raise credentials_exception
