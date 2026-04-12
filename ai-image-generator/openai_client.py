import os

from openai import AsyncOpenAI


def _env_float(name: str, default: float) -> float:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return float(value)
    except ValueError:
        return default


def _env_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default


def create_openai_client() -> AsyncOpenAI:
    return AsyncOpenAI(
        api_key=os.environ["OPENAI_API_KEY"],
        timeout=_env_float("OPENAI_TIMEOUT_SECONDS", 90.0),
        max_retries=max(0, _env_int("OPENAI_MAX_RETRIES", 2)),
    )
