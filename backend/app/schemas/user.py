from datetime import datetime

from pydantic import BaseModel, Field


class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    # Passwords double as user identity at login, so they must be unique.
    # Omit to have the server generate a secure one.
    password: str | None = Field(default=None, min_length=8)


class UserResponse(BaseModel):
    id: str
    name: str
    is_admin: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UserCreateResponse(UserResponse):
    # Plaintext password, returned only once at creation time.
    password: str
