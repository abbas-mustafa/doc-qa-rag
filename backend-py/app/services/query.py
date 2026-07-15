"""Query transformation: rewrite a conversational follow-up into a query that
retrieval can actually match.

Embeddings match on content words. "Why is that a risk?" has almost none — the
subject lives in the previous turn — so it retrieves nothing, and the answerer
then truthfully reports that the documents don't cover a question the documents
do in fact cover. Condensing against the conversation restores the missing nouns
before the query is embedded.

The rewrite is only ever used for retrieval. The answerer still receives the
user's original wording, so this never changes what they appear to have asked.
"""
from __future__ import annotations

import logging

from google.genai import types

from ..config import settings
from .gemini_client import client, gemini_retry_fast

logger = logging.getLogger(__name__)

# Long assistant answers are trimmed in the transcript: the condenser only needs
# enough of the prior turn to resolve a reference, not the whole answer.
_MAX_MSG_CHARS = 400

# A rewrite should be about the length of a question. Anything much longer means
# the model started explaining or answering instead, and shouldn't be embedded.
_MAX_QUERY_CHARS = 300

# Hard ceiling on the response. Comfortably fits any real query; a rewrite that
# runs past it is malfunctioning, and the length check above rejects the result.
_MAX_OUTPUT_TOKENS = 128

_SYSTEM = (
    "You rewrite the latest message of a conversation into a standalone search "
    "query for a document retrieval system.\n"
    "Rules:\n"
    "- Resolve references ('it', 'that', 'the second one', 'why?') using the "
    "conversation so the query stands alone with no history.\n"
    "- Keep the user's own terminology. Add no facts, and never answer the "
    "question.\n"
    "- If the message already stands alone, return it unchanged.\n"
    "- If it is a greeting, thanks, or anything other than a request for "
    "document content, return it unchanged. Never invent a topical query for a "
    "message that isn't asking about documents.\n"
    "- Output only the query text: no quotes, no prefix, no explanation."
)


def _transcript(history: list[dict]) -> str:
    lines = []
    for m in history:
        speaker = "User" if m["role"] == "user" else "Assistant"
        content = " ".join(m["content"].split())
        if len(content) > _MAX_MSG_CHARS:
            content = content[:_MAX_MSG_CHARS] + "…"
        lines.append(f"{speaker}: {content}")
    return "\n".join(lines)


@gemini_retry_fast
async def _rewrite(prompt: str):
    return await client.aio.models.generate_content(
        model=settings.condense_model,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=_SYSTEM,
            temperature=0.0,
            # Mechanical rewrite — reasoning tokens buy nothing and this sits on
            # the critical path of the user's answer.
            thinking_config=types.ThinkingConfig(thinking_budget=0),
            max_output_tokens=_MAX_OUTPUT_TOKENS,
        ),
    )


async def condense_question(question: str, history: list[dict]) -> str:
    """Return a standalone retrieval query for `question`.

    Falls back to the original question on any failure. A condenser problem must
    degrade retrieval to its previous quality, never fail the user's answer.
    """
    if not history:
        return question

    prompt = (
        f"Conversation:\n{_transcript(history)}\n\n"
        f"Latest message: {question}\n\nStandalone query:"
    )
    try:
        resp = await _rewrite(prompt)
    except Exception:
        logger.warning("Query condensing failed; retrieving with the raw question", exc_info=True)
        return question

    condensed = " ".join((resp.text or "").split())
    if not condensed or len(condensed) > _MAX_QUERY_CHARS:
        logger.warning("Discarding unusable condensed query (%d chars)", len(condensed))
        return question
    return condensed
