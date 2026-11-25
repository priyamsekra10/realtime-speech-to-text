import asyncio
from pathlib import Path

import numpy as np
from faster_whisper import WhisperModel
from faster_whisper.vad import VadOptions, get_speech_timestamps

from .base import SR, Event

STEP = SR // 2
KEEP = SR // 2
MAX_OPEN = 20 * SR
PAUSE = SR // 10
VAD = VadOptions(min_silence_duration_ms=500, speech_pad_ms=200)


def spans(audio):
    return get_speech_timestamps(audio, VAD)


class WhisperEngine:
    name = "whisper"

    def __init__(self, path, threads=2, words=()):
        self.model = WhisperModel(path, device="cpu", compute_type="int8", cpu_threads=threads)
        self.label = Path(path).name
        self.hint = ", ".join(words) or None
        self.busy = asyncio.Lock()

    def text(self, audio, beam):
        segs, _ = self.model.transcribe(
            audio,
            language="en",
            beam_size=beam,
            condition_on_previous_text=False,
            without_timestamps=True,
            hotwords=self.hint,
        )
        return " ".join(s.text.strip() for s in segs).strip()

    async def decode(self, audio, beam=1):
        async with self.busy:
            return await asyncio.to_thread(self.text, audio, beam)

    async def open(self):
        s = WhisperStream(self)
        s.task = asyncio.create_task(s.run())
        return s


class WhisperStream:
    def __init__(self, eng):
        self.eng = eng
        self.buf = np.zeros(0, np.float32)
        self.offset = 0
        self.fresh = 0
        self.ended = False
        self.out = asyncio.Queue()
        self.task = None

    async def feed(self, pcm):
        a = np.frombuffer(pcm, np.int16).astype(np.float32) / 32768
        self.buf = np.concatenate([self.buf, a])
        self.fresh += len(a)

    async def end(self):
        self.ended = True

    async def events(self):
        while (ev := await self.out.get()) is not None:
            yield ev

    async def close(self):
        if self.task:
            self.task.cancel()

    async def run(self):
        try:
            while not self.ended:
                if self.fresh >= STEP:
                    await self.step()
                else:
                    await asyncio.sleep(0.05)
            while await self.step(flush=True):
                pass
        finally:
            self.out.put_nowait(None)

    def ms(self, i):
        return (self.offset + i) * 1000 // SR

    def cut(self, n):
        self.buf = self.buf[n:]
        self.offset += n

    async def step(self, flush=False):
        buf = self.buf
        self.fresh = 0
        if len(buf) < SR // 5:
            return False
        found = await asyncio.to_thread(spans, buf)
        if not found:
            self.cut(max(0, len(buf) - KEEP))
            return False

        first = found[0]["start"]
        last = found[-1]["end"]
        if flush or len(buf) - last >= PAUSE:
            stop = last
        elif len(found) > 1:
            stop = found[-2]["end"]
        elif len(buf) - first > MAX_OPEN:
            stop = len(buf)
        else:
            stop = 0

        if not stop:
            text = (await self.eng.decode(buf[first:])).rstrip(".")
            if text:
                self.out.put_nowait(Event("partial", text, self.ms(first), self.ms(len(buf))))
            return False

        text = await self.eng.decode(buf[first:stop], beam=5)
        if text:
            self.out.put_nowait(Event("final", text, self.ms(first), self.ms(stop)))
        self.cut(stop)
        return True
