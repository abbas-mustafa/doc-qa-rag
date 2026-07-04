"""Vector similarity retrieval over a workspace's chunks."""
from __future__ import annotations

from uuid import UUID

from ..config import settings
from ..db import fetch_all


def _vector_literal(embedding: list[float]) -> str:
    # pgvector text input format; adapter-independent and safe for parameter binding.
    return "[" + ",".join(f"{x:.8f}" for x in embedding) + "]"


async def retrieve_relevant_chunks(
    workspace_id: UUID,
    query_embedding: list[float],
    top_k: int | None = None,
) -> list[dict]:
    top_k = top_k or settings.top_k
    rows = await fetch_all(
        """
        SELECT c.document_id, c.content, c.page_number, c.element_type,
               d.original_name,
               1 - (c.embedding <=> %(emb)s::vector) AS similarity
        FROM chunks c
        JOIN documents d ON d.id = c.document_id
        WHERE d.workspace_id = %(ws)s
        ORDER BY c.embedding <=> %(emb)s::vector
        LIMIT %(k)s
        """,
        {"emb": _vector_literal(query_embedding), "ws": str(workspace_id), "k": top_k},
    )
    return [r for r in rows if r["similarity"] is not None and r["similarity"] >= settings.similarity_threshold]
