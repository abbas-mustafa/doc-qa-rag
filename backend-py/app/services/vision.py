"""Gemini vision helpers: describe figures/charts and OCR page images."""
from __future__ import annotations

from google.genai import types

from ..config import settings
from .gemini_client import client, gemini_retry

NO_CONTENT = "NO_CONTENT"

_FIGURE_PROMPT = (
    "You are analyzing a figure extracted from a document (chart, diagram, graph, "
    "screenshot, or photo). In 2-4 sentences, describe what it shows and any key "
    "numbers, labels, axes, trends, or relationships a reader would need. "
    f"If it carries no meaningful information (e.g. a logo, divider, or decoration), "
    f"reply with exactly {NO_CONTENT}."
)

_OCR_PROMPT = (
    "Transcribe ALL text visible in this page image exactly, preserving natural "
    f"reading order. Do not add commentary. If there is no readable text, reply {NO_CONTENT}."
)


@gemini_retry
async def _run(prompt: str, image_bytes: bytes, mime_type: str) -> str:
    part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)
    resp = await client.aio.models.generate_content(
        model=settings.vision_model,
        contents=[prompt, part],
    )
    return (resp.text or "").strip()


async def describe_figure(image_bytes: bytes, mime_type: str = "image/png") -> str | None:
    text = await _run(_FIGURE_PROMPT, image_bytes, mime_type)
    if not text or text == NO_CONTENT:
        return None
    return text


async def ocr_page(image_bytes: bytes, mime_type: str = "image/png") -> str | None:
    text = await _run(_OCR_PROMPT, image_bytes, mime_type)
    if not text or text == NO_CONTENT:
        return None
    return text
