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


# -------------------------------------------------------------------- messages


async def save_message(
    workspace_id: UUID, role: str, content: str, sources: list | None = None
) -> None:
    await execute(
        "INSERT INTO messages (workspace_id, role, content, sources) VALUES (%s, %s, %s, %s)",
        (
            str(workspace_id),
            role,
            content,
            json.dumps(sources, default=str) if sources is not None else None,
        ),
    )


async def get_history(workspace_id: UUID) -> list[dict]:
    return await fetch_all(
        "SELECT * FROM messages WHERE workspace_id = %s ORDER BY created_at ASC",
        (str(workspace_id),),
    )
