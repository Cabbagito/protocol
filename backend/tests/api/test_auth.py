"""Login: password matching, bcrypt's 72-byte limit, failed-login throttling."""

import threading

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.rate_limit import login_limiter
from app.services import auth_service, user_service


async def _login(client, password: str):
    return await client.post("/api/auth/login", json={"password": password})


async def test_login_returns_working_token(client, user):
    resp = await _login(client, user.password)
    assert resp.status_code == 200
    body = resp.json()
    assert body["user_name"] == user.name
    headers = {"Authorization": f"Bearer {body['access_token']}"}
    assert (await client.get("/api/exercises", headers=headers)).status_code == 200


async def test_login_picks_the_matching_user(client, user, other_user):
    resp = await _login(client, other_user.password)
    assert resp.status_code == 200
    assert resp.json()["user_name"] == other_user.name


async def test_wrong_password_is_401(client, user):
    resp = await _login(client, user.password + "x")
    assert resp.status_code == 401


@pytest.mark.parametrize("password", ["a" * 73, "a" * 500, "é" * 37])  # 73, 500, 74 bytes
async def test_overlong_password_is_401_not_500(client, user, password):
    resp = await _login(client, password)
    assert resp.status_code == 401


async def test_72_byte_password_works(client, make_user):
    password = "p" * 72
    await make_user("Long", password)
    assert (await _login(client, password)).status_code == 200


async def test_bcrypt_runs_off_the_event_loop(client, user, monkeypatch):
    threads = []
    real_verify = auth_service.verify_password

    def _spy(plain, hashed):
        threads.append(threading.current_thread())
        return real_verify(plain, hashed)

    monkeypatch.setattr(auth_service, "verify_password", _spy)
    assert (await _login(client, user.password)).status_code == 200
    assert threads
    assert all(t is not threading.main_thread() for t in threads)


async def test_failed_logins_are_throttled_per_ip(client, user):
    for _ in range(login_limiter.max_failures):
        assert (await _login(client, "wrong")).status_code == 401

    resp = await _login(client, "wrong")
    assert resp.status_code == 429
    assert 1 <= int(resp.headers["Retry-After"]) <= 60
    # Locked out even with the right password, so guessing can't continue.
    assert (await _login(client, user.password)).status_code == 429

    # Another client IP is unaffected.
    from app.main import app

    transport = ASGITransport(app=app, client=("203.0.113.7", 4321))
    async with AsyncClient(transport=transport, base_url="http://test") as other:
        assert (await _login(other, user.password)).status_code == 200


async def test_successful_login_resets_failure_count(client, user):
    for _ in range(login_limiter.max_failures - 1):
        assert (await _login(client, "wrong")).status_code == 401
    assert (await _login(client, user.password)).status_code == 200
    for _ in range(login_limiter.max_failures - 1):
        assert (await _login(client, "wrong")).status_code == 401
    assert (await _login(client, user.password)).status_code == 200


# --- user creation (scripts/manage_users.py) ---


async def test_create_user_rejects_overlong_password(db):
    with pytest.raises(user_service.PasswordTooLongError, match="72 bytes"):
        await user_service.create_user(db, "Long", "x" * 73)


async def test_create_user_rejects_bad_names_and_empty_password(db):
    with pytest.raises(user_service.InvalidUserError):
        await user_service.create_user(db, "   ", None)
    with pytest.raises(user_service.InvalidUserError):
        await user_service.create_user(db, "n" * 101, None)
    with pytest.raises(user_service.InvalidUserError):
        await user_service.create_user(db, "Empty", "")


async def test_create_user_rejects_duplicate_password(db, user):
    with pytest.raises(user_service.PasswordCollisionError):
        await user_service.create_user(db, "Copycat", user.password)


async def test_create_user_generates_password(db, client):
    created, password = await user_service.create_user(db, "Fresh", None)
    assert created.name == "Fresh"
    resp = await _login(client, password)
    assert resp.status_code == 200
    assert resp.json()["user_name"] == "Fresh"
