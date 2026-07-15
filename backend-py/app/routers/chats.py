"""Chat threads: CRUD over the conversations inside a workspace.

Kept separate from `chat.py` (which owns asking questions) so the retrieval path
and the thread-management path don't tangle. Every route resolves ownership
through the parent workspace's `user_id`.
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from .. import crud
from ..auth import CurrentUser
from ..models import Chat, ChatCreate, ChatRename

router = APIRouter(prefix="/api/chats", tags=["chats"])

TITLE_MAX_CHARS = 120


@router.get("/workspace/{workspace_id}", response_model=list[Chat])
async def list_chats(workspace_id: UUID, user_id: UUID = CurrentUser):
    if not await crud.get_owned_workspace(workspace_id, user_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Workspace not found")
    return await crud.list_chats(workspace_id)


@router.post("/workspace/{workspace_id}", response_model=Chat, status_code=status.HTTP_201_CREATED)
async def create_chat(workspace_id: UUID, body: ChatCreate, user_id: UUID = CurrentUser):
    if not await crud.get_owned_workspace(workspace_id, user_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Workspace not found")
    title = (body.title or "").strip() or "New chat"
    return await crud.create_chat(workspace_id, title[:TITLE_MAX_CHARS])


@router.patch("/{chat_id}", response_model=Chat)
async def rename_chat(chat_id: UUID, body: ChatRename, user_id: UUID = CurrentUser):
    if not await crud.get_owned_chat(chat_id, user_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Chat not found")
    title = body.title.strip()
    if not title:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Title is required")
    return await crud.rename_chat(chat_id, title[:TITLE_MAX_CHARS])


@router.delete("/{chat_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_chat(chat_id: UUID, user_id: UUID = CurrentUser):
    if not await crud.get_owned_chat(chat_id, user_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Chat not found")
    await crud.delete_chat(chat_id)
