"""Shared google-genai client instance and a retry policy for transient API errors."""
from google import genai
from google.genai import errors
from tenacity import (
    retry,
    retry_if_exception,
    stop_after_attempt,
    wait_exponential,
)

from ..config import settings

client = genai.Client(api_key=settings.gemini_api_key)

_RETRYABLE_CODES = {429, 500, 502, 503, 504}


def _is_retryable(exc: BaseException) -> bool:
    return isinstance(exc, errors.APIError) and getattr(exc, "code", None) in _RETRYABLE_CODES


# Backoff handles Gemini free-tier per-minute rate limits (429) and transient 5xx.
gemini_retry = retry(
    retry=retry_if_exception(_is_retryable),
    wait=wait_exponential(multiplier=2, min=2, max=60),
    stop=stop_after_attempt(6),
    reraise=True,
)
