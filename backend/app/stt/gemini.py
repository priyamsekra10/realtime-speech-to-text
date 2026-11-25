import asyncio
import logging
import re
import time

from google import genai
from google.genai import types

from .base import SR, Event

log = logging.getLogger(__name__)

QUIET = 1.5
SETTLED = 0.6
DRAIN = 8
GLUED = re.compile(r"([.?!।])(?=[^\W\d_])")


def tidy(text):
    return GLUED.sub(r"\1 ", text).strip()


class GeminiEngine:
    name = "gemini"

    def __init__(self, key, model, words=(), languages=()):
        self.client = genai.Client(api_key=key, http_options={"api_version": "v1beta"})
        self.label = model
        self.words = list(words)
        self.languages = list(languages)

    def config(self):
        if "transcribe" in self.label:
            return types.LiveConnectConfig(
                response_modalities=["TEXT"],
                input_audio_transcription=types.AudioTranscriptionConfig(
                    language_codes=self.languages,
                    custom_vocabulary=self.words or None,
                ),
            )
        return types.LiveConnectConfig(
            response_modalities=["AUDIO"],
            input_audio_transcription=types.AudioTranscriptionConfig(),
        )

    async def open(self):
        s = GeminiStream()
        s.conn = self.client.aio.live.connect(model=self.label, config=self.config())
        s.session = await s.conn.__aenter__()
        s.task = asyncio.create_task(s.read())
        return s


class GeminiStream:
    def __init__(self):
        self.conn = None
        self.session = None
        self.task = None
        self.out = asyncio.Queue()
        self.sent = 0
        self.start = None
        self.pending = ""
        self.heard = time.monotonic()

    def now(self):
        return self.sent * 1000 // SR

    async def feed(self, pcm):
        await self.session.send_realtime_input(audio=types.Blob(data=pcm, mime_type=f"audio/pcm;rate={SR}"))
        self.sent += len(pcm) // 2

    async def read(self):
        try:
            while True:
                async for msg in self.session.receive():
                    self.handle(msg.server_content)
        except asyncio.CancelledError:
            raise
        except Exception:
            log.exception("gemini stream stopped")
        finally:
            self.flush()
            self.out.put_nowait(None)

    def handle(self, c):
        if not c:
            return
        self.heard = time.monotonic()
        t = c.interim_input_transcription
        if t and t.text:
            if self.start is None:
                self.start = self.now()
            self.pending = tidy(t.text)
            self.out.put_nowait(Event("partial", self.pending, self.start, self.now()))
        t = c.input_transcription
        if t and t.text and t.text.strip():
            start = self.now() if self.start is None else self.start
            self.out.put_nowait(Event("final", tidy(t.text), start, self.now(), t.language_code))
            self.start = None
            self.pending = ""

    def flush(self):
        if self.pending:
            self.out.put_nowait(Event("final", self.pending, self.start or 0, self.now()))
            self.pending = ""

    async def end(self):
        try:
            await self.session.send_realtime_input(audio_stream_end=True)
        except Exception:
            log.exception("gemini end of stream failed")
            return
        t0 = time.monotonic()
        self.heard = t0
        while time.monotonic() - t0 < DRAIN and not self.task.done():
            if time.monotonic() - self.heard > (QUIET if self.pending else SETTLED):
                break
            await asyncio.sleep(0.05)
        await self.stop()

    async def stop(self):
        if self.task and not self.task.done():
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass

    async def events(self):
        while (ev := await self.out.get()) is not None:
            yield ev

    async def close(self):
        await self.stop()
        if self.conn:
            try:
                await self.conn.__aexit__(None, None, None)
            except Exception:
                pass
