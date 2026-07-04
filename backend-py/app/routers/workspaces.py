"""Workspace CRUD, scoped to the authenticated user."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from .. import crud
from ..auth import CurrentUser
from ..models import Workspace, WorkspaceCreate

router = APIRouter(prefix="/api/workspaces", tags=["workspaces"])


@router.post("", response_model=Workspace, status_code=status.HTTP_201_CREATED)
async def create_workspace(body: WorkspaceCreate, user_id: UUID = CurrentUser):
    return await crud.create_workspace(user_id, body.name or "My Workspace")


@router.get("", response_model=list[Workspace])
async def list_workspaces(user_id: UUID = CurrentUser):
    return await crud.list_workspaces(user_id)


@router.get("/{workspace_id}", response_model=Workspace)
async def get_workspace(workspace_id: UUID, user_id: UUID = CurrentUser):
    ws = await crud.get_owned_workspace(workspace_id, user_id)
    if not ws:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Workspace not found")
    return ws


@router.delete("/{workspace_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workspace(workspace_id: UUID, user_id: UUID = CurrentUser):
    deleted = await crud.delete_workspace(workspace_id, user_id)
    if not deleted:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Workspace not found")
