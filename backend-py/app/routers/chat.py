"""Chat: retrieval-augmented Q&A over a workspace, scoped to the authenticated user.

Routes are keyed on `chat_id` rather than `workspace_id`: a workspace now holds
many threads, and the chat resolves its own workspace for retrieval. Ownership is
still enforced against the workspace's `user_id`, via crud.get_owned_chat.

Answers are delivered as Server-Sent Events. The retrieval half of the pipeline
runs *before* the response starts, so its failures are still ordinary HTTP
errors; only the model call, which cannot fail cleanly once bytes are on the
wire, reports through the stream.
"""
from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse

from .. import crud
from ..auth import CurrentUser
from ..config import settings
from ..models import AskRequest, ChatMessage
from ..services.embeddings import embed_query
from ..services.llm import prepare_answer, stream_answer
from ..services.query import condense_question
from ..services.retrieval import retrieve_relevant_chunks

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["chat"])

TITLE_MAX_CHARS = 60


def _sse(event: str, data: dict) -> str:
    """Frame one Server-Sent Event.

    The payload is JSON rather than bare text specifically because a delta may
    contain newlines, and a newline is SSE's field separator. json.dumps escapes
    them, so a markdown answer can't fracture its own frame.
    """
    return f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n"


def _title_from(question: str) -> str:
    """Derive a thread title from its opening question.

    Deliberately not an LLM call: titling is on the critical path of the user's
    first answer, and a second round-trip to Gemini would add latency and cost to
    every new thread for a string nobody reads closely. Truncates on a word
    boundary so titles don't end mid-word.
    """
    title = " ".join(question.split())
    if len(title) <= TITLE_MAX_CHARS:
        return title
    clipped = title[:TITLE_MAX_CHARS].rsplit(" ", 1)[0]
    return f"{clipped or title[:TITLE_MAX_CHARS]}…"


@router.post("/{chat_id}/stream")
async def ask_question_stream(chat_id: UUID, body: AskRequest, user_id: UUID = CurrentUser):
    question = body.question.strip()
    if not question:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Question is required")

    chat = await crud.get_owned_chat(chat_id, user_id)
    if not chat:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Chat not found")
    workspace_id = chat["workspace_id"]

    # Everything up to the model call is awaited here, before any bytes are
    # sent, so an auth, retrieval, or embedding failure is still a real HTTP
    # status the client can handle normally. Once a StreamingResponse begins the
    # status is already 200 and an error can only be reported in-band.
    #
    # Read before inserting, so the model sees the conversation as it stood and
    # the opening question is what titles the thread.
    history = await crud.get_recent_messages(chat_id, settings.history_messages)
    is_first_exchange = not history

    # Retrieval searches for the condensed query; the answerer still sees the
    # question as the user typed it.
    search_query = await condense_question(question, history)
    query_embedding = await embed_query(search_query)
    chunks = await retrieve_relevant_chunks(workspace_id, query_embedding)
    prepared = prepare_answer(
        question,
        chunks,
        history=history,
        # Only consulted when retrieval came back empty, to say "nothing uploaded
        # yet" rather than "your documents don't cover that".
        doc_count=await crud.count_ready_documents(workspace_id) if not chunks else 0,
    )

    async def events() -> AsyncIterator[str]:
        # Sources first: they're already known, and sending them ahead of the
        # text lets [n] markers resolve to badges as they stream in rather than
        # rendering as raw digits until the end.
        yield _sse("sources", {"sources": prepared.sources})

        parts: list[str] = []
        try:
            async for delta in stream_answer(prepared):
                parts.append(delta)
                yield _sse("delta", {"text": delta})
        except Exception:
            logger.exception("Answer stream failed for chat %s", chat_id)
            yield _sse("error", {"detail": "Failed to generate an answer. Please try again."})
            return

        answer = "".join(parts).strip()
        if not answer:
            logger.error("Model produced an empty answer for chat %s", chat_id)
            yield _sse("error", {"detail": "The model returned an empty answer. Please try again."})
            return

        # Persisted before `done` is sent, so the event means "saved", not just
        # "finished". If the client vanished mid-answer this generator is
        # cancelled at a yield above and nothing is written — which is the right
        # outcome: a half-sentence in the thread reads as breakage, and there's
        # no resume to justify keeping it.
        await crud.save_message(chat_id, workspace_id, "user", question)
        await crud.save_message(chat_id, workspace_id, "assistant", answer, prepared.sources)

        new_title: str | None = None
        if is_first_exchange:
            new_title = _title_from(question)
            await crud.rename_chat(chat_id, new_title)  # also bumps updated_at
        else:
            await crud.touch_chat(chat_id)

        yield _sse("done", {"chatId": chat_id, "chatTitle": new_title})

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={
            # no-transform tells intermediaries not to gzip the body: a
            # compressing proxy buffers to fill its window, which would hold the
            # whole answer back and silently undo the streaming.
            "Cache-Control": "no-cache, no-transform",
            # nginx-specific opt out of proxy_buffering, for the same reason.
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/{chat_id}/history", response_model=list[ChatMessage])
async def get_history(chat_id: UUID, user_id: UUID = CurrentUser):
    if not await crud.get_owned_chat(chat_id, user_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Chat not found")
    return await crud.get_history(chat_id)
