from pydantic_settings import BaseSettings


class Settings(BaseSettings):
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
    app_password: str = "changeme"
    secret_key: str = "change-this-secret-key-in-production"
    access_token_expire_days: int = 365

    # CORS
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:8000"]

    # Claude API
    anthropic_api_key: str = ""

    # Supabase Storage
    supabase_url: str = ""
    supabase_key: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
