"""Pydantic request/response models."""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class WorkspaceCreate(BaseModel):
    name: str | None = None


class Workspace(BaseModel):
    id: UUID
    name: str
    created_at: datetime


class Document(BaseModel):
    id: UUID
    workspace_id: UUID
    filename: str
    original_name: str
    mime_type: str | None = None
    page_count: int | None = None
    status: str
    error: str | None = None
    created_at: datetime


class Source(BaseModel):
    documentId: UUID
    documentName: str
    pageNumber: int | None = None
    elementType: str | None = None


class ChatMessage(BaseModel):
    id: UUID | None = None
    role: str
    content: str
    sources: list[Source] | None = None
    created_at: datetime | None = None


class AskRequest(BaseModel):
    question: str


class AskResponse(BaseModel):
    answer: str
    sources: list[Source]
    question: str
    workspaceId: UUID
