"""FastAPI application entrypoint."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings
from .db import close_pool, open_pool
from .routers import chat, chats, documents, workspaces

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(asctime)s %(name)s %(message)s")
logger = logging.getLogger("docqa")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await open_pool()
    logger.info("Database pool opened")
    yield
    await close_pool()
    logger.info("Database pool closed")


app = FastAPI(title="DocQA API", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"error": "Internal server error"},
    )


@app.get("/health")
async def health():
    return {"status": "ok"}


app.include_router(workspaces.router)
app.include_router(documents.router)
app.include_router(chats.router)
app.include_router(chat.router)
