"""Chat: retrieval-augmented Q&A over a workspace, scoped to the authenticated user."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from .. import crud
from ..auth import CurrentUser
from ..models import AskRequest, AskResponse, ChatMessage
from ..services.embeddings import embed_query
from ..services.llm import generate_answer
from ..services.retrieval import retrieve_relevant_chunks

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("/{workspace_id}", response_model=AskResponse)
async def ask_question(workspace_id: UUID, body: AskRequest, user_id: UUID = CurrentUser):
    question = body.question.strip()
    if not question:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Question is required")
    if not await crud.get_owned_workspace(workspace_id, user_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Workspace not found")

    query_embedding = await embed_query(question)
    chunks = await retrieve_relevant_chunks(workspace_id, query_embedding)
    result = await generate_answer(question, chunks)

    await crud.save_message(workspace_id, "user", question)
    await crud.save_message(workspace_id, "assistant", result["answer"], result["sources"])

    return AskResponse(
        answer=result["answer"],
        sources=result["sources"],
        question=question,
        workspaceId=workspace_id,
    )


@router.get("/{workspace_id}/history", response_model=list[ChatMessage])
async def get_history(workspace_id: UUID, user_id: UUID = CurrentUser):
    if not await crud.get_owned_workspace(workspace_id, user_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Workspace not found")
    return await crud.get_history(workspace_id)
