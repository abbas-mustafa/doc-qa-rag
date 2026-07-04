"""Token-optimized, citation-aware answer generation."""
from __future__ import annotations

from datetime import date

from google.genai import types

from ..config import settings
from .gemini_client import client, gemini_retry

_NO_INFO = "I don't have enough information in the provided documents to answer that."


def _system_prompt() -> str:
    return (
        f"Today is {date.today().isoformat()}. "
        "Answer strictly from the provided context. Cite sources inline as "
        "[source: name, p.N] (drop p.N if unknown). If the context is insufficient, "
        "say so plainly. Be concise."
    )


def _build_context(chunks: list[dict]) -> str:
    """Pack chunks into a context block, capped at max_context_chars to avoid
    spending tokens on content that won't fit or help."""
    lines: list[str] = []
    used = 0
    for i, c in enumerate(chunks, 1):
        page = f", p.{c['page_number']}" if c.get("page_number") else ""
        header = f"[{i}] ({c['original_name']}{page})"
        body = c["content"].strip()
        entry = f"{header}\n{body}"
        if used + len(entry) > settings.max_context_chars:
            remaining = settings.max_context_chars - used - len(header) - 1
            if remaining > 200:  # only include a partial if it's still useful
                lines.append(f"{header}\n{body[:remaining]}")
            break
        lines.append(entry)
        used += len(entry)
    return "\n\n".join(lines)


def _dedupe_sources(chunks: list[dict]) -> list[dict]:
    seen: set[tuple] = set()
    sources: list[dict] = []
    for c in chunks:
        key = (str(c["document_id"]), c.get("page_number"))
        if key in seen:
            continue
        seen.add(key)
        sources.append(
            {
                "documentId": c["document_id"],
                "documentName": c["original_name"],
                "pageNumber": c.get("page_number"),
                "elementType": c.get("element_type"),
            }
        )
    return sources


@gemini_retry
async def _generate(prompt: str):
    return await client.aio.models.generate_content(
        model=settings.chat_model,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=_system_prompt(),
            temperature=0.2,
        ),
    )


async def generate_answer(question: str, chunks: list[dict]) -> dict:
    if not chunks:
        return {"answer": _NO_INFO, "sources": []}

    context = _build_context(chunks)
    prompt = f"Context:\n{context}\n\nQuestion: {question}"
    resp = await _generate(prompt)
    return {"answer": (resp.text or "").strip(), "sources": _dedupe_sources(chunks)}
