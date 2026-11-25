from contextlib import asynccontextmanager

from fastapi import FastAPI

from .db import engine
from .routes import transcripts


@asynccontextmanager
async def lifespan(app):
    yield
    await engine.dispose()


app = FastAPI(title="Speech to Text", lifespan=lifespan)
app.include_router(transcripts.router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"ok": True}
