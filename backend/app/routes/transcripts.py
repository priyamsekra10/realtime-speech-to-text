import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..db import get_db
from ..models import Transcript
from ..schemas import Page, Stats, TranscriptCreate, TranscriptDetail, TranscriptUpdate

router = APIRouter(prefix="/transcripts", tags=["transcripts"])

ID = r"^[A-Za-z0-9-]{8,64}$"
Owner = Annotated[str, Header(alias="X-Client-Id", pattern=ID)]
DB = Annotated[AsyncSession, Depends(get_db)]


async def find(db: AsyncSession, owner: str, id: uuid.UUID) -> Transcript:
    q = (
        select(Transcript)
        .where(Transcript.id == id, Transcript.owner == owner)
        .options(selectinload(Transcript.segments))
    )
    t = (await db.execute(q)).scalar_one_or_none()
    if not t:
        raise HTTPException(404, "transcript not found")
    return t


@router.get("", response_model=Page)
async def list_transcripts(
    owner: Owner,
    db: DB,
    q: str = Query(default="", max_length=100),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    where = [Transcript.owner == owner]
    if q.strip():
        like = f"%{q.strip()}%"
        where.append(or_(Transcript.title.ilike(like), Transcript.text.ilike(like)))
    total = await db.scalar(select(func.count()).select_from(Transcript).where(*where))
    rows = await db.scalars(
        select(Transcript).where(*where).order_by(Transcript.created_at.desc()).limit(limit).offset(offset)
    )
    return Page(items=rows.all(), total=total)


@router.get("/stats", response_model=Stats)
async def stats(owner: Owner, db: DB):
    words = func.cardinality(func.regexp_split_to_array(func.nullif(func.btrim(Transcript.text), ""), r"\s+"))
    row = (
        await db.execute(
            select(
                func.count(),
                func.coalesce(func.sum(words), 0),
                func.coalesce(func.sum(Transcript.duration_ms), 0),
            ).where(Transcript.owner == owner)
        )
    ).one()
    return Stats(count=row[0], words=row[1], duration_ms=row[2])


@router.post("", response_model=TranscriptDetail, status_code=201)
async def create(body: TranscriptCreate, owner: Owner, db: DB):
    t = Transcript(owner=owner, title=body.title.strip(), text=body.text.strip(), engine="manual")
    db.add(t)
    await db.commit()
    return await find(db, owner, t.id)


@router.get("/{id}", response_model=TranscriptDetail)
async def read(id: uuid.UUID, owner: Owner, db: DB):
    return await find(db, owner, id)


@router.patch("/{id}", response_model=TranscriptDetail)
async def update(id: uuid.UUID, body: TranscriptUpdate, owner: Owner, db: DB):
    t = await find(db, owner, id)
    if body.title is not None:
        t.title = body.title.strip()
    if body.text is not None:
        t.text = body.text.strip()
    t.updated_at = func.now()
    await db.commit()
    await db.refresh(t, ["updated_at"])
    return t


@router.delete("/{id}", status_code=204)
async def delete(id: uuid.UUID, owner: Owner, db: DB):
    t = await find(db, owner, id)
    await db.delete(t)
    await db.commit()
