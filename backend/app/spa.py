import re
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

PAGES = re.compile(r"^(about|history(/[0-9a-f-]{36})?)?$")


def mount(app: FastAPI, dist: Path):
    dist = dist.resolve()
    app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    async def page(path: str):
        if path.startswith(("api/", "ws/")):
            raise HTTPException(404)
        f = (dist / path).resolve()
        if path and f.is_file() and dist in f.parents:
            return FileResponse(f)
        return FileResponse(dist / "index.html", status_code=200 if PAGES.match(path) else 404)
