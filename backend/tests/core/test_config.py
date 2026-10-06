"""Startup refusal for forgeable JWT secrets."""

import pytest
from pydantic import ValidationError

from app.core import config
from app.core.config import DEFAULT_SECRET_KEY, Settings, check_startup_settings

STRONG = "9f2c4e1b7a6d8e0f3c5b2a1d4e6f8a0b"


def _settings(**kwargs) -> Settings:
    return Settings(_env_file=None, **kwargs)


@pytest.mark.parametrize(
    "secret",
    [
        DEFAULT_SECRET_KEY,
        "dev-secret-key-change-in-production",  # docker-compose.yml
        "your-secret-key-change-this-in-production",  # .env.example
        "<generate-a-strong-secret>",  # .env.prod.example
    ],
)
def test_production_refuses_placeholder_secrets(secret):
    with pytest.raises(RuntimeError, match="placeholder"):
        check_startup_settings(_settings(secret_key=secret, app_env="production"))


@pytest.mark.parametrize("app_env", ["production", "dev"])
def test_empty_secret_is_always_refused(app_env):
    with pytest.raises(RuntimeError, match="empty"):
        check_startup_settings(_settings(secret_key="  ", app_env=app_env))


def test_production_is_the_default_env(monkeypatch):
    monkeypatch.delenv("APP_ENV", raising=False)
    with pytest.raises(RuntimeError):
        check_startup_settings(_settings(secret_key=DEFAULT_SECRET_KEY))


def test_dev_allows_placeholder_secret():
    check_startup_settings(
        _settings(secret_key="dev-secret-key-change-in-production", app_env="dev")
    )


def test_production_accepts_real_secret():
    check_startup_settings(_settings(secret_key=STRONG, app_env="production"))


def test_unknown_app_env_is_rejected():
    with pytest.raises(ValidationError):
        _settings(app_env="staging")


def test_no_bootstrap_password_by_default(monkeypatch):
    monkeypatch.delenv("APP_PASSWORD", raising=False)
    assert _settings().app_password == ""


async def test_app_startup_refuses_placeholder_secret(monkeypatch):
    """The check runs first in the lifespan, before migrations touch the DB."""
    from app.main import app, lifespan

    monkeypatch.setattr(config.settings, "secret_key", DEFAULT_SECRET_KEY)
    monkeypatch.setattr(config.settings, "app_env", "production")
    with pytest.raises(RuntimeError, match="Refusing to start"):
        async with lifespan(app):
            pass
