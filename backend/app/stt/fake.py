import asyncio

from .base import SR, Event


class FakeEngine:
    name = "fake"
    label = "fake"

    def __init__(self, words=("namaste", "this", "is", "a", "test")):
        self.words = words

    async def open(self):
        return FakeStream(self.words)


class FakeStream:
    def __init__(self, words):
        self.words = words
        self.out = asyncio.Queue()
        self.n = 0
        self.said = []

    async def feed(self, pcm):
        self.n += len(pcm) // 2
        if len(self.said) < len(self.words) and self.n >= (len(self.said) + 1) * SR // 10:
            self.said.append(self.words[len(self.said)])
            self.out.put_nowait(Event("partial", " ".join(self.said), 0, self.n * 1000 // SR))

    async def end(self):
        if self.said:
            self.out.put_nowait(Event("final", " ".join(self.said), 0, self.n * 1000 // SR))
        self.out.put_nowait(None)

    async def events(self):
        while (ev := await self.out.get()) is not None:
            yield ev

    async def close(self):
        pass
