"""Token-optimized, citation-aware answer generation.

Answers stream. The work splits in two: `prepare_answer` is synchronous and
settles everything knowable before the model is called — most importantly the
source list, which retrieval already determined. The caller can therefore send
sources to the client *first* and have citation badges resolve as the text
arrives, instead of appearing in a lump at the end.
"""
from __future__ import annotations

import re
from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import date

from google.genai import types

from ..config import settings
from .gemini_client import client, gemini_retry

# Retrieval returning nothing used to short-circuit to a canned "I don't have
# enough information in the provided documents" without ever calling the model.
# That string is a fine answer to an unanswerable *question* and a broken answer
# to "Hi there". All three states below go through the model instead; what
# changes is the instruction it gets, so refusing stays the model's decision
# about the message rather than a property of the retrieval result.

_PERSONA = (
    "You are DocQA, an assistant that answers questions grounded in the user's "
    "uploaded documents. Be concise and natural. Use markdown when it helps "
    "(lists, tables, bold) but don't dress up a one-line answer."
)

_GROUNDED = (
    "Answer from the context below. Each passage is labelled with a number like "
    "[2]. Cite the claims you make with that number and nothing else — write [2], "
    "never the file name. Cite at the end of the sentence or clause the passage "
    "supports; if two passages support one claim, write [1][3]. Do not cite the "
    "same number repeatedly in one sentence. If the context covers only part of "
    "the question, answer that part and say what's missing rather than filling "
    "the gap from your own knowledge."
)

# The two ungrounded states share a shape: chat freely, refuse document claims.
# They differ in what the user should do next, which is the whole point of
# separating them — "upload a file" and "try rephrasing" are not interchangeable.
_UNGROUNDED_RULES = (
    "- Greetings, small talk, thanks, and questions about what you are or how to "
    "use you: answer normally and briefly, no disclaimer needed.\n"
    "- Anything that would need document content to answer: {refusal} Never "
    "answer it from your own knowledge and never invent document contents.\n"
    "- If you're unsure which of the two a message is, treat it as the second.\n"
    "- Never write a citation marker in this state. You have no context, so there "
    "is nothing to cite; earlier turns may show citations, but copying one here "
    "would attribute a claim to a document that was not consulted."
)

_NO_DOCUMENTS = (
    "This workspace has no processed documents, so you have no context at all.\n"
    + _UNGROUNDED_RULES.format(
        refusal=(
            "say plainly that this workspace has no documents uploaded yet, and "
            "invite them to upload one to ask about it."
        )
    )
)

_NO_MATCH = (
    "This workspace has {n}, but none of that content matched this message.\n"
    + _UNGROUNDED_RULES.format(
        refusal=(
            "say the uploaded documents don't appear to cover it, and suggest "
            "rephrasing or uploading a document that does."
        )
    )
)


# Both citation shapes: the [2] form _GROUNDED now asks for, and the older
# [source: name, p.N] form, which the model still imitates when a stored answer
# using it is replayed in the history. Leading whitespace is consumed so removing
# a trailing marker doesn't leave a gap before the full stop.
_CITATION_RE = re.compile(r"[ \t]*(?:\[source:[^\]]*\]|\[\d+\])")

# The tail of a buffer that might still grow into a citation: an unclosed "[…",
# optionally preceded by the whitespace _CITATION_RE would eat with it. A chunk
# boundary can fall anywhere, so "[2]" routinely arrives as "[2" then "]".
# Anchored with \Z rather than $ so a trailing newline isn't held back too.
_HOLD_RE = re.compile(r"[ \t]*(?:\[[^\]]*)?\Z")


class _CitationStripper:
    """Removes citation markers from a stream that must not contain any.

    The prompt already forbids citations in an ungrounded answer, but measurably
    fails to stop them: with a cited answer replayed in the history the model
    mimics the format roughly three times in four. A citation pointing at a
    document that was never retrieved is the one thing a RAG product must not
    emit, so it's enforced here rather than requested in the prompt.

    Streaming makes that enforcement stateful. Text can only be released once
    it's certain no later chunk could turn it into a marker — otherwise a "[2]"
    split across two deltas is emitted as "[2" and never matched, or worse, is
    painted on screen and then has to be taken back.
    """

    def __init__(self) -> None:
        self._held = ""

    def feed(self, text: str) -> str:
        """Return the part of `text` that is now safe to emit, stripped."""
        buffer = self._held + text
        cut = _HOLD_RE.search(buffer).start()  # always matches, possibly empty
        self._held = buffer[cut:]
        return _CITATION_RE.sub("", buffer[:cut])

    def flush(self) -> str:
        """Release the tail once no more chunks are coming.

        An unterminated "[" was only ever a *potential* marker; at end of stream
        it's just text the model wrote, so it survives the strip and is emitted.
        """
        out = _CITATION_RE.sub("", self._held)
        self._held = ""
        return out


def _plural_docs(n: int) -> str:
    return "1 processed document" if n == 1 else f"{n} processed documents"


def _system_prompt(*, grounded: bool, doc_count: int) -> str:
    if grounded:
        rules = _GROUNDED
    elif doc_count == 0:
        rules = _NO_DOCUMENTS
    else:
        rules = _NO_MATCH.format(n=_plural_docs(doc_count))
    return f"Today is {date.today().isoformat()}. {_PERSONA}\n\n{rules}"


def _assign_sources(chunks: list[dict]) -> tuple[list[dict], list[int]]:
    """Number the sources, and say which number each chunk belongs to.

    Passages are labelled with their *source* number rather than their position
    in the context, because sources are deduplicated by (document, page) while
    chunks are not. Numbering by position would let the model cite [5] when the
    answer only carries four pills, leaving a citation pointing at nothing. Here
    two chunks from the same page share one number, so every number the model can
    emit indexes a pill the user can actually see.

    Returns (sources, source_number_per_chunk) with numbers 1-based, matching the
    order of `sources` — so the client can map [n] to sources[n - 1].
    """
    seen: dict[tuple, int] = {}
    sources: list[dict] = []
    numbers: list[int] = []
    for c in chunks:
        key = (str(c["document_id"]), c.get("page_number"))
        if key not in seen:
            sources.append(
                {
                    "documentId": c["document_id"],
                    "documentName": c["original_name"],
                    "pageNumber": c.get("page_number"),
                    "elementType": c.get("element_type"),
                }
            )
            seen[key] = len(sources)  # 1-based
        numbers.append(seen[key])
    return sources, numbers


def _build_context(chunks: list[dict], numbers: list[int]) -> tuple[str, int]:
    """Pack chunks into a context block, capped at max_context_chars to avoid
    spending tokens on content that won't fit or help.

    Also returns the highest source number that survived the cap. Numbers are
    assigned in chunk order, so dropping a tail of chunks always leaves the
    prefix 1..n — letting the caller trim the pill list to exactly the sources
    the model was actually shown, with no gaps in the numbering.
    """
    lines: list[str] = []
    used = 0
    highest = 0
    for c, n in zip(chunks, numbers):
        page = f", p.{c['page_number']}" if c.get("page_number") else ""
        header = f"[{n}] ({c['original_name']}{page})"
        body = c["content"].strip()
        entry = f"{header}\n{body}"
        if used + len(entry) > settings.max_context_chars:
            remaining = settings.max_context_chars - used - len(header) - 1
            if remaining > 200:  # only include a partial if it's still useful
                lines.append(f"{header}\n{body[:remaining]}")
                highest = max(highest, n)
            break
        lines.append(entry)
        used += len(entry)
        highest = max(highest, n)
    return "\n\n".join(lines), highest


def _build_contents(question: str, context: str, history: list[dict]) -> list[types.Content]:
    """Replay the conversation tail, then the current turn.

    Only the live question carries retrieved context: re-attaching each prior
    turn's chunks would blow the token budget and lets stale context outweigh the
    passages actually retrieved for the question being asked.
    """
    contents: list[types.Content] = [
        types.Content(
            role="model" if m["role"] == "assistant" else "user",
            parts=[types.Part.from_text(text=m["content"])],
        )
        for m in history
    ]
    turn = f"Context:\n{context}\n\nQuestion: {question}" if context else question
    contents.append(types.Content(role="user", parts=[types.Part.from_text(text=turn)]))
    return contents


@dataclass(frozen=True)
class PreparedAnswer:
    """Everything settled before the model is called, including the sources."""

    contents: list[types.Content]
    system_instruction: str
    temperature: float
    sources: list[dict]
    grounded: bool


def prepare_answer(
    question: str,
    chunks: list[dict],
    *,
    history: list[dict] | None = None,
    doc_count: int = 0,
) -> PreparedAnswer:
    grounded = bool(chunks)
    sources: list[dict] = []
    context = ""
    if grounded:
        sources, numbers = _assign_sources(chunks)
        context, highest = _build_context(chunks, numbers)
        sources = sources[:highest]

    return PreparedAnswer(
        contents=_build_contents(question, context, history or []),
        system_instruction=_system_prompt(grounded=grounded, doc_count=doc_count),
        # Grounded answers should stick to the passages; ungrounded ones are
        # conversational, where 0.2 reads clipped and robotic.
        temperature=0.2 if grounded else 0.6,
        sources=sources,
        grounded=grounded,
    )


@gemini_retry
async def _open_stream(prepared: PreparedAnswer):
    """Start the stream and pull its first chunk, together, under one retry.

    generate_content_stream builds a *lazy* generator: awaiting it issues no
    request, so a 429 surfaces on the first iteration rather than at the call.
    Retrying only the call would therefore be decorative — it would never see
    the error it exists to handle. Pulling the first chunk here puts the actual
    request inside the retry.

    It is also the only part that can be retried. Once a delta has been sent the
    user has read it, and a second attempt would restart the answer mid-sentence
    rather than resume it.
    """
    stream = await client.aio.models.generate_content_stream(
        model=settings.chat_model,
        contents=prepared.contents,
        config=types.GenerateContentConfig(
            system_instruction=prepared.system_instruction,
            temperature=prepared.temperature,
        ),
    )
    return await anext(stream, None), stream


async def stream_answer(prepared: PreparedAnswer) -> AsyncIterator[str]:
    """Yield the answer in deltas, as the model produces them."""
    first, stream = await _open_stream(prepared)
    stripper = None if prepared.grounded else _CitationStripper()

    async def chunks() -> AsyncIterator[str]:
        if first is not None:
            yield first.text or ""
        async for chunk in stream:
            yield chunk.text or ""

    async for text in chunks():
        if not text:
            continue
        out = text if stripper is None else stripper.feed(text)
        if out:
            yield out

    if stripper is not None:
        tail = stripper.flush()
        if tail:
            yield tail
