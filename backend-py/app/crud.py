"""Database access helpers. All workspace-scoped reads/writes enforce user ownership."""
from __future__ import annotations

import json
from uuid import UUID

from .db import execute, fetch_all, fetch_one, get_connection


def _vector_literal(embedding: list[float]) -> str:
    return "[" + ",".join(f"{x:.8f}" for x in embedding) + "]"


# ------------------------------------------------------------------ workspaces


async def create_workspace(user_id: UUID, name: str) -> dict:
    return await fetch_one(
        "INSERT INTO workspaces (name, user_id) VALUES (%s, %s) RETURNING *",
        (name, str(user_id)),
    )


async def list_workspaces(user_id: UUID) -> list[dict]:
    return await fetch_all(
        "SELECT * FROM workspaces WHERE user_id = %s ORDER BY created_at DESC",
        (str(user_id),),
    )


async def get_owned_workspace(workspace_id: UUID, user_id: UUID) -> dict | None:
    return await fetch_one(
        "SELECT * FROM workspaces WHERE id = %s AND user_id = %s",
        (str(workspace_id), str(user_id)),
    )


async def delete_workspace(workspace_id: UUID, user_id: UUID) -> bool:
    row = await fetch_one(
        "DELETE FROM workspaces WHERE id = %s AND user_id = %s RETURNING id",
        (str(workspace_id), str(user_id)),
    )
    return row is not None


# ------------------------------------------------------------------- documents


async def create_document(
    workspace_id: UUID, filename: str, original_name: str, mime_type: str
) -> dict:
    return await fetch_one(
        """
        INSERT INTO documents (workspace_id, filename, original_name, mime_type, status)
        VALUES (%s, %s, %s, %s, 'processing') RETURNING *
        """,
        (str(workspace_id), filename, original_name, mime_type),
    )


async def list_documents(workspace_id: UUID) -> list[dict]:
    return await fetch_all(
        "SELECT * FROM documents WHERE workspace_id = %s ORDER BY created_at DESC",
        (str(workspace_id),),
    )


async def count_ready_documents(workspace_id: UUID) -> int:
    """Documents actually available to retrieval. Lets the answerer tell "you
    haven't uploaded anything" apart from "your documents don't cover this",
    which are very different things to say to a user."""
    row = await fetch_one(
        "SELECT count(*) AS n FROM documents WHERE workspace_id = %s AND status = 'ready'",
        (str(workspace_id),),
    )
    return row["n"] if row else 0


async def get_owned_document(document_id: UUID, user_id: UUID) -> dict | None:
    return await fetch_one(
        """
        SELECT d.* FROM documents d
        JOIN workspaces w ON w.id = d.workspace_id
        WHERE d.id = %s AND w.user_id = %s
        """,
        (str(document_id), str(user_id)),
    )


async def delete_document(document_id: UUID) -> None:
    await execute("DELETE FROM documents WHERE id = %s", (str(document_id),))


async def update_document_status(
    document_id: UUID, status: str, page_count: int | None = None, error: str | None = None
) -> None:
    await execute(
        "UPDATE documents SET status = %s, page_count = %s, error = %s WHERE id = %s",
        (status, page_count, error, str(document_id)),
    )


async def insert_chunks(document_id: UUID, rows: list[dict]) -> None:
    """rows: list of {content, chunk_index, page_number, element_type, embedding}."""
    if not rows:
        return
    async with get_connection() as conn:
        async with conn.cursor() as cur:
            await cur.executemany(
                """
                INSERT INTO chunks
                    (document_id, content, chunk_index, page_number, element_type, embedding)
                VALUES (%s, %s, %s, %s, %s, %s::vector)
                """,
                [
                    (
                        str(document_id),
                        r["content"],
                        r["chunk_index"],
                        r["page_number"],
                        r["element_type"],
                        _vector_literal(r["embedding"]),
                    )
                    for r in rows
                ],
            )


# ----------------------------------------------------------------------- chats


async def create_chat(workspace_id: UUID, title: str = "New chat") -> dict:
    return await fetch_one(
        "INSERT INTO chats (workspace_id, title) VALUES (%s, %s) RETURNING *",
        (str(workspace_id), title),
    )


async def list_chats(workspace_id: UUID) -> list[dict]:
    return await fetch_all(
        "SELECT * FROM chats WHERE workspace_id = %s ORDER BY updated_at DESC",
        (str(workspace_id),),
    )


async def get_owned_chat(chat_id: UUID, user_id: UUID) -> dict | None:
    """A chat is owned transitively, via its workspace. Every chat-scoped route
    goes through here so ownership is never assumed from the chat id alone."""
    return await fetch_one(
        """
        SELECT c.* FROM chats c
        JOIN workspaces w ON w.id = c.workspace_id
        WHERE c.id = %s AND w.user_id = %s
        """,
        (str(chat_id), str(user_id)),
    )


async def rename_chat(chat_id: UUID, title: str) -> dict | None:
    return await fetch_one(
        "UPDATE chats SET title = %s, updated_at = now() WHERE id = %s RETURNING *",
        (title, str(chat_id)),
    )


async def delete_chat(chat_id: UUID) -> bool:
    row = await fetch_one("DELETE FROM chats WHERE id = %s RETURNING id", (str(chat_id),))
    return row is not None


async def touch_chat(chat_id: UUID) -> None:
    """Bump activity so the sidebar's newest-first ordering reflects real use."""
    await execute("UPDATE chats SET updated_at = now() WHERE id = %s", (str(chat_id),))


# -------------------------------------------------------------------- messages


async def save_message(
    chat_id: UUID,
    workspace_id: UUID,
    role: str,
    content: str,
    sources: list | None = None,
) -> None:
    await execute(
        """
        INSERT INTO messages (chat_id, workspace_id, role, content, sources)
        VALUES (%s, %s, %s, %s, %s)
        """,
        (
            str(chat_id),
            str(workspace_id),
            role,
            content,
            json.dumps(sources, default=str) if sources is not None else None,
        ),
    )


async def get_history(chat_id: UUID) -> list[dict]:
    return await fetch_all(
        "SELECT * FROM messages WHERE chat_id = %s ORDER BY created_at ASC",
        (str(chat_id),),
    )


async def get_recent_messages(chat_id: UUID, limit: int) -> list[dict]:
    """The tail of a conversation, oldest-first, for prompt replay.

    Ordered DESC then reversed so the LIMIT keeps the *newest* messages; ASC with
    a LIMIT would pin the prompt to the start of the thread forever.
    """
    rows = await fetch_all(
        "SELECT role, content FROM messages WHERE chat_id = %s ORDER BY created_at DESC LIMIT %s",
        (str(chat_id), limit),
    )
    return list(reversed(rows))
