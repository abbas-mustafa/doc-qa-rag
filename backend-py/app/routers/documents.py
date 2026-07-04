"""Document upload + processing pipeline, scoped to the authenticated user."""
from __future__ import annotations

import logging
import os
import uuid
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, HTTPException, UploadFile, status

from .. import crud
from ..auth import CurrentUser
from ..config import settings
from ..models import Document
from ..services.chunking import chunk_elements
from ..services.embeddings import embed_texts
from ..services.parsing import parse_document

logger = logging.getLogger("docqa.documents")

router = APIRouter(prefix="/api/documents", tags=["documents"])

UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

_ALLOWED = {
    "application/pdf": ".pdf",
    "text/plain": ".txt",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
}
_CHUNK = 1024 * 1024  # 1MB streaming buffer


async def _save_upload(file: UploadFile, dest: Path) -> None:
    """Stream the upload to disk, enforcing the size limit without buffering it all in memory."""
    size = 0
    with open(dest, "wb") as out:
        while chunk := await file.read(_CHUNK):
            size += len(chunk)
            if size > settings.max_file_size_bytes:
                out.close()
                dest.unlink(missing_ok=True)
                raise HTTPException(
                    status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    f"File exceeds {settings.max_file_size_mb} MB limit",
                )
            out.write(chunk)


async def _process_document(document_id: UUID, file_path: str, mime_type: str) -> None:
    """Background pipeline: parse -> chunk -> embed -> store, flipping status."""
    try:
        parsed = await parse_document(file_path, mime_type)
        chunks = chunk_elements(parsed.elements)
        if chunks:
            embeddings = await embed_texts([c.text for c in chunks])
            rows = [
                {
                    "content": c.text,
                    "chunk_index": c.chunk_index,
                    "page_number": c.page_number,
                    "element_type": c.element_type,
                    "embedding": emb,
                }
                for c, emb in zip(chunks, embeddings)
            ]
            await crud.insert_chunks(document_id, rows)
        await crud.update_document_status(document_id, "ready", parsed.page_count)
        logger.info("Processed document %s: %d chunks", document_id, len(chunks))
    except Exception as exc:  # noqa: BLE001
        logger.exception("Processing failed for document %s", document_id)
        await crud.update_document_status(document_id, "failed", error=str(exc)[:500])


@router.post("/upload/{workspace_id}", status_code=status.HTTP_202_ACCEPTED)
async def upload_document(
    workspace_id: UUID,
    file: UploadFile,
    background: BackgroundTasks,
    user_id: UUID = CurrentUser,
):
    if not await crud.get_owned_workspace(workspace_id, user_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Workspace not found")

    ext = _ALLOWED.get(file.content_type or "")
    if ext is None:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            "Unsupported file type. Upload PDF, DOCX, or TXT.",
        )

    stored_name = f"{uuid.uuid4()}{ext}"
    dest = UPLOAD_DIR / stored_name
    await _save_upload(file, dest)

    document = await crud.create_document(
        workspace_id, stored_name, file.filename or stored_name, file.content_type
    )
    background.add_task(_process_document, document["id"], str(dest), file.content_type)

    return {"message": "Document uploaded, processing started", "document": document}


@router.get("/workspace/{workspace_id}", response_model=list[Document])
async def list_documents(workspace_id: UUID, user_id: UUID = CurrentUser):
    if not await crud.get_owned_workspace(workspace_id, user_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Workspace not found")
    return await crud.list_documents(workspace_id)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(document_id: UUID, user_id: UUID = CurrentUser):
    doc = await crud.get_owned_document(document_id, user_id)
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")
    await crud.delete_document(document_id)
    # Best-effort cleanup of the stored file.
    try:
        os.remove(UPLOAD_DIR / doc["filename"])
    except OSError:
        pass
