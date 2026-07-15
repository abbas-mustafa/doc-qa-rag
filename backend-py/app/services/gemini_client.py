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


def make_gemini_retry(*, attempts: int, min_wait: float, max_wait: float):
    return retry(
        retry=retry_if_exception(_is_retryable),
        wait=wait_exponential(multiplier=2, min=min_wait, max=max_wait),
        stop=stop_after_attempt(attempts),
        reraise=True,
    )


# Backoff handles Gemini free-tier per-minute rate limits (429) and transient 5xx.
# Patient, because there is no fallback: failing here means the user gets no answer.
gemini_retry = make_gemini_retry(attempts=6, min_wait=2, max_wait=60)

# For calls that have a usable fallback. A 429 may be a *daily* quota, which will
# not clear on any backoff we're willing to make the user wait through — so try
# once more for a transient blip, then give up quickly and let the caller degrade.
gemini_retry_fast = make_gemini_retry(attempts=2, min_wait=1, max_wait=1)
