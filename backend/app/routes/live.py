import asyncio
import json
import logging

from fastapi import APIRouter, Query, WebSocket

from ..config import settings
from ..db import Session
from ..models import Segment, Transcript
from ..stt.base import SR
from .transcripts import ID

router = APIRouter()
log = logging.getLogger(__name__)


async def send(ws, **msg):
    try:
        await ws.send_json(msg)
    except Exception:
        pass


def name(text):
    words = text.split()
    title = " ".join(words[:8])
    return title[:197] + "..." if len(title) > 200 else title + ("..." if len(words) > 8 else "")


@router.websocket("/ws/transcribe")
async def transcribe(
    ws: WebSocket,
    engine: str = "whisper",
    client_id: str = Query(pattern=ID),
):
    await ws.accept()
    state = ws.app.state
    eng = state.engines.get(engine)
    if not eng:
        await send(ws, type="error", message=f"The {engine} engine is not available on this server.")
        return await ws.close()
    if state.live >= settings.max_sessions:
        await send(ws, type="error", message="The server is busy. Try again in a minute.")
        return await ws.close()

    state.live += 1
    try:
        await session(ws, eng, client_id)
    finally:
        state.live -= 1
    try:
        await ws.close()
    except Exception:
        pass


async def session(ws, eng, owner):
    try:
        stream = await eng.open()
    except Exception:
        log.exception("could not open %s", eng.name)
        return await send(ws, type="error", message="Could not start the speech engine.")

    async with Session() as db:
        t = Transcript(owner=owner, title="Recording", engine=eng.name, model=eng.label, status="recording")
        db.add(t)
        await db.commit()
    await send(
        ws,
        type="ready",
        id=str(t.id),
        engine=eng.name,
        model=eng.label,
        max_seconds=settings.max_session_seconds,
    )

    parts = []

    async def pump():
        async for ev in stream.events():
            if ev.kind == "final":
                async with Session() as db:
                    db.add(
                        Segment(
                            transcript_id=t.id,
                            idx=len(parts),
                            text=ev.text,
                            start_ms=ev.start_ms,
                            end_ms=ev.end_ms,
                            lang=ev.lang,
                        )
                    )
                    await db.commit()
                parts.append(ev.text)
            await send(ws, type=ev.kind, text=ev.text, start_ms=ev.start_ms, end_ms=ev.end_ms, lang=ev.lang)

    task = asyncio.create_task(pump())
    samples = 0
    reason = "stopped"
    try:
        while True:
            msg = await ws.receive()
            if msg["type"] == "websocket.disconnect":
                reason = "disconnected"
                break
            if task.done():
                reason = "engine"
                break
            data = msg.get("bytes")
            if data:
                data = data[: len(data) // 2 * 2]
                await stream.feed(data)
                samples += len(data) // 2
                if samples >= settings.max_session_seconds * SR:
                    reason = "limit"
                    break
            elif msg.get("text") and json.loads(msg["text"]).get("type") == "stop":
                break
    except Exception:
        log.exception("live session failed")
        reason = "engine"
    finally:
        try:
            await stream.end()
            await asyncio.wait_for(task, 30)
        except Exception:
            task.cancel()
        await stream.close()
        saved = await finish(t.id, parts, samples)
        await send(ws, type="done", reason=reason, id=str(t.id) if saved else None)


async def finish(id, parts, samples):
    async with Session() as db:
        t = await db.get(Transcript, id)
        if not t:
            return False
        if not parts:
            await db.delete(t)
            await db.commit()
            return False
        t.text = " ".join(parts)
        t.title = name(t.text)
        t.duration_ms = samples * 1000 // SR
        t.status = "done"
        await db.commit()
        return True
