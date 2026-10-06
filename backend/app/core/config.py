from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_SECRET_KEY = "change-this-secret-key-in-production"

# Placeholder secrets that appear in this repository (the default above, the
# dev compose file and the example env files). Anyone can forge tokens with
# them, so production refuses to start with any of these.
PLACEHOLDER_SECRET_KEYS = frozenset(
    {
        DEFAULT_SECRET_KEY,
        "dev-secret-key-change-in-production",
        "your-secret-key-change-this-in-production",
        "<generate-a-strong-secret>",
    }
)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    # "dev" allows the placeholder SECRET_KEY values for local development.
    app_env: Literal["dev", "production"] = "production"

    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/protocol"

    @property
    def async_database_url(self) -> str:
        """Convert standard postgresql:// URL to asyncpg driver URL."""
        url = self.database_url
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url

    # Auth
    # Password for the first user, created at startup only while no user exists.
    # Empty: no bootstrap user (create users with scripts/manage_users.py).
    app_password: str = ""
    secret_key: str = DEFAULT_SECRET_KEY
    access_token_expire_days: int = 365
    admin_name: str = "Admin"

    # CORS
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:8000"]

    # Claude API
    anthropic_api_key: str = ""


def startup_problems(config: Settings) -> list[str]:
    """Settings that make it unsafe to serve requests."""
    if not config.secret_key.strip():
        return ["SECRET_KEY is empty"]
    if config.app_env != "dev" and config.secret_key in PLACEHOLDER_SECRET_KEYS:
        return ["SECRET_KEY is a placeholder value from this repository"]
    return []


def check_startup_settings(config: Settings) -> None:
    """Refuse to start with a forgeable JWT secret (see ``startup_problems``)."""
    problems = startup_problems(config)
    if problems:
        raise RuntimeError(
            "Refusing to start: "
            + "; ".join(problems)
            + ". Set SECRET_KEY to a long random value (e.g. `openssl rand -hex 32`),"
            " or APP_ENV=dev for local development."
        )


settings = Settings()
