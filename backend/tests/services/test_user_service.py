"""Tests for user_service password generation and uniqueness checking."""

from types import SimpleNamespace

from app.core.security import hash_password
from app.services.user_service import (
    _PASSWORD_ALPHABET,
    _PASSWORD_LENGTH,
    generate_password,
    password_collides,
)


def _user(password: str):
    return SimpleNamespace(password_hash=hash_password(password))


def test_generate_password_length_and_alphabet():
    for _ in range(20):
        pw = generate_password()
        assert len(pw) == _PASSWORD_LENGTH
        assert all(c in _PASSWORD_ALPHABET for c in pw)


def test_generate_password_is_not_constant():
    assert len({generate_password() for _ in range(10)}) > 1


def test_password_collides_detects_existing_password():
    users = [_user("hunter2hunter2"), _user("correct horse")]
    assert password_collides("correct horse", users)


def test_password_collides_false_for_unique_password():
    users = [_user("hunter2hunter2")]
    assert not password_collides("something else", users)


def test_password_collides_empty_user_list():
    assert not password_collides("anything", [])
