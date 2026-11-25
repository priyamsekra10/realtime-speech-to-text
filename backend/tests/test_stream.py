import asyncio
import wave
from pathlib import Path

import numpy as np
import pytest

from app.stt import whisper
from app.stt.base import SR
from app.stt.whisper import WhisperEngine, WhisperStream, sane, window

MODEL = Path(__file__).parents[2] / "models" / "hinglish-swift"
CLIP = Path(__file__).parents[2] / "samples" / "all.wav"

tone = (np.sin(np.arange(SR) * 0.2) * 0.5 * 32767).astype(np.int16).tobytes()
quiet = b"\0\0" * SR


def loud(audio):
    out, start = [], None
    for i in range(0, len(audio), 160):
        on = np.abs(audio[i : i + 160]).max() > 0.1
        if on and start is None:
            start = i
        if not on and start is not None:
            out.append({"start": start, "end": i})
            start = None
    if start is not None:
        out.append({"start": start, "end": len(audio)})
    return out


class Stub:
    async def decode(self, audio, beam=1):
        return f"{len(audio) * 1000 // SR} ms"


async def start():
    s = WhisperStream(Stub())
    s.task = asyncio.create_task(s.run())
    return s


def test_pause_closes_an_utterance(monkeypatch):
    monkeypatch.setattr(whisper, "spans", loud)

    async def go():
        s = await start()
        await s.feed(tone + quiet)
        first = await asyncio.wait_for(s.out.get(), 2)
        await s.feed(tone)
        await s.end()
        return first, [ev async for ev in s.events()]

    first, rest = asyncio.run(go())
    assert (first.kind, first.text, first.start_ms, first.end_ms) == ("final", "1000 ms", 0, 1000)
    last = [ev for ev in rest if ev.kind == "final"]
    assert [(ev.text, ev.start_ms, ev.end_ms) for ev in last] == [("1000 ms", 2000, 3000)]


def test_open_speech_gives_partials(monkeypatch):
    monkeypatch.setattr(whisper, "spans", loud)

    async def go():
        s = await start()
        await s.feed(tone)
        ev = await asyncio.wait_for(s.out.get(), 2)
        await s.close()
        return ev

    ev = asyncio.run(go())
    assert (ev.kind, ev.text) == ("partial", "1000 ms")


def test_silence_is_dropped(monkeypatch):
    monkeypatch.setattr(whisper, "spans", loud)

    async def go():
        s = await start()
        await s.feed(quiet * 3)
        await asyncio.sleep(0.2)
        kept = len(s.buf)
        await s.end()
        return kept, [ev async for ev in s.events()]

    kept, events = asyncio.run(go())
    assert events == []
    assert kept == whisper.KEEP


def test_short_speech_gets_a_short_window():
    assert window(3 * SR) == 1000
    assert window(10 * SR) == 1500
    assert window(18 * SR) == 3000


def test_runaway_text_is_dropped():
    assert sane("Please mujhe paanch sau kilo cement ka quotation bhej do")
    assert sane("haan haan haan")
    assert not sane("5 5 5 5 5 5 5 5 5 5 5 5")
    assert not sane("K" + "A" * 60)


@pytest.mark.skipif(not (MODEL.is_dir() and CLIP.is_file()), reason="needs the model and a sample clip")
def test_real_model_on_hinglish_clip():
    w = wave.open(str(CLIP))
    pcm = w.readframes(w.getnframes())

    async def go():
        s = await WhisperEngine(str(MODEL)).open()
        for i in range(0, len(pcm), 3200):
            await s.feed(pcm[i : i + 3200])
            await asyncio.sleep(0.02)
        await s.end()
        return [ev async for ev in s.events()]

    events = asyncio.run(go())
    text = " ".join(ev.text for ev in events if ev.kind == "final").lower()
    assert any(ev.kind == "partial" for ev in events)
    assert len([ev for ev in events if ev.kind == "final"]) >= 3
    for word in ("office", "meeting", "cement", "friday", "weather", "dinner"):
        assert word in text
