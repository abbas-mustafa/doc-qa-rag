"""Async Postgres connection pool (psycopg 3) with pgvector support."""
from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any, AsyncIterator

from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool
from pgvector.psycopg import register_vector_async

from .config import settings

_pool: AsyncConnectionPool | None = None


async def _configure_connection(conn) -> None:
    # Register pgvector adapters so Python lists <-> vector() work transparently.
    await register_vector_async(conn)


async def open_pool() -> None:
    global _pool
    if _pool is not None:
        return
    _pool = AsyncConnectionPool(
        conninfo=settings.database_url,
        min_size=1,
        max_size=10,
        open=False,
        configure=_configure_connection,
        kwargs={"row_factory": dict_row},
    )
    await _pool.open()


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


def get_pool() -> AsyncConnectionPool:
    if _pool is None:
        raise RuntimeError("Database pool is not initialized. Call open_pool() first.")
    return _pool


@asynccontextmanager
async def get_connection() -> AsyncIterator[Any]:
    async with get_pool().connection() as conn:
        yield conn


async def fetch_all(query: str, params: tuple | list | None = None) -> list[dict]:
    async with get_connection() as conn:
        cur = await conn.execute(query, params)
        return await cur.fetchall()


async def fetch_one(query: str, params: tuple | list | None = None) -> dict | None:
    async with get_connection() as conn:
        cur = await conn.execute(query, params)
        return await cur.fetchone()


async def execute(query: str, params: tuple | list | None = None) -> None:
    async with get_connection() as conn:
        await conn.execute(query, params)
