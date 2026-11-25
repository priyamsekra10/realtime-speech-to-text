from dataclasses import dataclass
from typing import AsyncIterator, Protocol

SR = 16000


@dataclass
class Event:
    kind: str
    text: str
    start_ms: int = 0
    end_ms: int = 0
    lang: str | None = None


class Stream(Protocol):
    async def feed(self, pcm: bytes) -> None: ...

    async def end(self) -> None: ...

    def events(self) -> AsyncIterator[Event]: ...

    async def close(self) -> None: ...


class Engine(Protocol):
    name: str
    label: str

    async def open(self) -> Stream: ...
