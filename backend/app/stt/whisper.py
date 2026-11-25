import asyncio
from pathlib import Path

import ctranslate2
import numpy as np
from faster_whisper import WhisperModel
from faster_whisper.tokenizer import Tokenizer
from faster_whisper.vad import VadOptions, get_speech_timestamps

from .base import SR, Event

STEP = SR // 2
KEEP = SR // 2
MAX_OPEN = 20 * SR
PAUSE = SR // 10
TAIL = SR // 5
VAD = VadOptions(min_silence_duration_ms=500, speech_pad_ms=200)


def spans(audio):
    return get_speech_timestamps(audio, VAD)


def window(samples):
    if samples <= 8 * SR:
        return 1000
    if samples <= 13 * SR:
        return 1500
    return 3000


def sane(text):
    words = text.split()
    if any(len(w) > 40 for w in words):
        return False
    return len(words) <= 6 or len(set(words)) > 2


class WhisperEngine:
    name = "whisper"

    def __init__(self, path, threads=2, words=(), recheck=False):
        self.model = WhisperModel(path, device="cpu", compute_type="int8", cpu_threads=threads)
        self.label = Path(path).name
        self.recheck = recheck
        self.hint = ", ".join(words) or None
        self.tok = Tokenizer(
            self.model.hf_tokenizer, self.model.model.is_multilingual, task="transcribe", language="en"
        )
        self.prompt = self.model.get_prompt(self.tok, [], without_timestamps=True, hotwords=self.hint)
        self.busy = asyncio.Lock()

    def text(self, audio):
        segs, _ = self.model.transcribe(
            audio,
            language="en",
            beam_size=5,
            condition_on_previous_text=False,
            without_timestamps=True,
            hotwords=self.hint,
        )
        return " ".join(s.text.strip() for s in segs).strip()

    def quick(self, audio):
        n = window(len(audio))
        feats = self.model.feature_extractor(audio)[:, :n]
        feats = np.pad(feats, ((0, 0), (0, n - feats.shape[1])))
        view = ctranslate2.StorageView.from_array(np.ascontiguousarray(feats[None], dtype=np.float32))
        out = self.model.model.generate(view, [self.prompt], beam_size=1, max_length=200)
        ids = [t for t in out[0].sequences_ids[0] if t < self.tok.eot]
        text = self.tok.decode(ids).strip()
        return text if sane(text) else ""

    async def decode(self, audio, beam=1):
        async with self.busy:
            return await asyncio.to_thread(self.quick if beam == 1 else self.text, audio)

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
        self.heard = ("", 0)
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
            text = await self.eng.decode(buf[first:])
            self.heard = (text, self.offset + len(buf))
            if text.rstrip("."):
                self.out.put_nowait(Event("partial", text.rstrip("."), self.ms(first), self.ms(len(buf))))
            return False

        text, upto = self.heard
        if self.eng.recheck:
            text = ""
        elif stop != last or upto < self.offset + stop - TAIL:
            text = await self.eng.decode(buf[first:stop])
        if not text:
            text = await self.eng.decode(buf[first:stop], beam=5)
        if text:
            self.out.put_nowait(Event("final", text, self.ms(first), self.ms(stop)))
        self.heard = ("", 0)
        self.cut(stop)
        return True
