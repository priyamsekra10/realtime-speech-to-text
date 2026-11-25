import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, computed_field


class SegmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    idx: int
    text: str
    start_ms: int
    end_ms: int
    lang: str | None = None


class TranscriptOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    text: str
    engine: str
    model: str
    status: str
    duration_ms: int
    created_at: datetime
    updated_at: datetime

    @computed_field
    @property
    def word_count(self) -> int:
        return len(self.text.split())


class TranscriptDetail(TranscriptOut):
    segments: list[SegmentOut] = []


class TranscriptCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    text: str = Field(default="", max_length=20000)


class TranscriptUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    text: str | None = Field(default=None, max_length=20000)


class Page(BaseModel):
    items: list[TranscriptOut]
    total: int


class Stats(BaseModel):
    count: int
    words: int
    duration_ms: int
