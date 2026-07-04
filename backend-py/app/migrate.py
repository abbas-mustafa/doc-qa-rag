"""Apply schema.sql to the configured database. Run: python -m app.migrate"""
import asyncio
import sys
from pathlib import Path

from .db import close_pool, get_connection, open_pool

SCHEMA_PATH = Path(__file__).parent / "schema.sql"


async def migrate() -> None:
    sql = SCHEMA_PATH.read_text(encoding="utf-8")
    await open_pool()
    try:
        async with get_connection() as conn:
            await conn.execute(sql)
        print("Schema applied successfully.")
    finally:
        await close_pool()


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.run(migrate(), loop_factory=asyncio.SelectorEventLoop)
    else:
        asyncio.run(migrate())
