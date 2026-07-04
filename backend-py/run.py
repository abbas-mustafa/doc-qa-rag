"""Dev/prod launcher.

On Windows, psycopg's async stack needs a SelectorEventLoop. We run uvicorn's
server inside a loop created via asyncio.run(loop_factory=...), which avoids the
deprecated event-loop-policy API. (Autoreload is not used in this mode; edit and
restart, or use `uvicorn app.main:app --reload` during development.)
"""
import asyncio
import sys

import uvicorn

from app.config import settings


async def _serve() -> None:
    config = uvicorn.Config(
        "app.main:app",
        host="0.0.0.0",
        port=settings.port,
        log_level="info",
    )
    await uvicorn.Server(config).serve()


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.run(_serve(), loop_factory=asyncio.SelectorEventLoop)
    else:
        asyncio.run(_serve())
