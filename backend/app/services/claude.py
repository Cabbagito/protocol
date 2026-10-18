"""The shared Claude API client. Without ANTHROPIC_API_KEY there is none, and
the features that use it degrade: meals show their food names, products are
typed in by hand."""

from anthropic import AsyncAnthropic

from app.core.config import settings

_client: AsyncAnthropic | None = None


def get_client() -> AsyncAnthropic | None:
    global _client
    if not settings.anthropic_api_key:
        return None
    if _client is None:
        _client = AsyncAnthropic(api_key=settings.anthropic_api_key, timeout=60.0, max_retries=2)
    return _client
