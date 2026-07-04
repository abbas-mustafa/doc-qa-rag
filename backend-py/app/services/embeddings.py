"""Gemini embeddings via the google-genai SDK (async)."""
from __future__ import annotations

from google.genai import types

from ..config import settings
from .gemini_client import client, gemini_retry

# Gemini's embedding API accepts batches; keep them modest to stay within limits.
_BATCH_SIZE = 100


@gemini_retry
async def _embed_batch(batch: list[str], task_type: str):
    return await client.aio.models.embed_content(
        model=settings.embedding_model,
        contents=batch,
        config=types.EmbedContentConfig(
            output_dimensionality=settings.embedding_dimensions,
            task_type=task_type,
        ),
    )


async def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a list of strings, returning one 768-dim vector per input (order preserved)."""
    if not texts:
        return []

    vectors: list[list[float]] = []
    for start in range(0, len(texts), _BATCH_SIZE):
        batch = texts[start : start + _BATCH_SIZE]
        result = await _embed_batch(batch, "RETRIEVAL_DOCUMENT")
        vectors.extend([e.values for e in result.embeddings])
    return vectors


async def embed_query(text: str) -> list[float]:
    """Embed a single query string (uses the RETRIEVAL_QUERY task type)."""
    result = await _embed_batch([text], "RETRIEVAL_QUERY")
    return result.embeddings[0].values
