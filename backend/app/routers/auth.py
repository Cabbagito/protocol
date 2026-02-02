from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.core.security import create_access_token, verify_password

router = APIRouter()


class LoginRequest(BaseModel):
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest):
    if not verify_password(request.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid password",
        )

    access_token = create_access_token()
    return TokenResponse(access_token=access_token)
