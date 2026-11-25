import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from sqlalchemy import update

from . import spa
from .config import settings
from .db import Session, engine
from .models import Transcript
from .routes import live, transcripts

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)


def load_engines():
    found = {}
    if settings.whisper_enabled and Path(settings.whisper_model).is_dir():
        from .stt.whisper import WhisperEngine

        found["whisper"] = WhisperEngine(
            settings.whisper_model, settings.whisper_threads, settings.words, settings.whisper_recheck
        )
    if settings.gemini_api_key:
        from .stt.gemini import GeminiEngine

        langs = [x.strip() for x in settings.gemini_languages.split(",") if x.strip()]
        found["gemini"] = GeminiEngine(settings.gemini_api_key, settings.gemini_model, settings.words, langs)
    log.info("speech engines: %s", ", ".join(found) or "none")
    return found


@asynccontextmanager
async def lifespan(app):
    app.state.engines = load_engines()
    app.state.live = 0
    async with Session() as db:
        await db.execute(update(Transcript).where(Transcript.status == "recording").values(status="done"))
        await db.commit()
    yield
    await engine.dispose()


app = FastAPI(title="Speech to Text", lifespan=lifespan)
app.include_router(transcripts.router, prefix="/api")
app.include_router(live.router)


@app.get("/api/health")
async def health():
    return {"ok": True}


@app.get("/api/engines")
async def engines():
    return {
        "engines": [{"name": e.name, "model": e.label} for e in app.state.engines.values()],
        "max_seconds": settings.max_session_seconds,
    }


dist = Path(settings.static_dir)
if dist.is_dir():
    spa.mount(app, dist)
