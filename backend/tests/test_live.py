import pytest
from starlette.websockets import WebSocketDisconnect

from app.config import settings

FRAME = b"\0\0" * 1600


def url(me, engine="fake"):
    return f"/ws/transcribe?engine={engine}&client_id={me['X-Client-Id']}"


def drain(ws):
    out = []
    while True:
        m = ws.receive_json()
        out.append(m)
        if m["type"] in ("done", "error"):
            return out


def test_live_session_is_saved(client, me):
    with client.websocket_connect(url(me)) as ws:
        ready = ws.receive_json()
        assert ready["type"] == "ready"
        assert ready["engine"] == "fake"
        for _ in range(6):
            ws.send_bytes(FRAME)
        ws.send_json({"type": "stop"})
        msgs = drain(ws)

    kinds = [m["type"] for m in msgs]
    assert "partial" in kinds
    final = [m for m in msgs if m["type"] == "final"]
    assert [m["text"] for m in final] == ["namaste this is a test"]
    assert msgs[-1] == {"type": "done", "reason": "stopped", "id": ready["id"]}

    t = client.get(f"/api/transcripts/{ready['id']}", headers=me).json()
    assert t["text"] == "namaste this is a test"
    assert t["title"] == "namaste this is a test"
    assert t["status"] == "done"
    assert t["duration_ms"] == 600
    assert t["updated_at"] == t["created_at"]
    assert [s["text"] for s in t["segments"]] == ["namaste this is a test"]


def test_silent_session_is_not_saved(client, me):
    with client.websocket_connect(url(me)) as ws:
        ws.receive_json()
        ws.send_json({"type": "stop"})
        msgs = drain(ws)
    assert msgs[-1]["id"] is None
    assert client.get("/api/transcripts", headers=me).json()["total"] == 0


def test_session_stops_at_time_limit(client, me, monkeypatch):
    monkeypatch.setattr(settings, "max_session_seconds", 1)
    with client.websocket_connect(url(me)) as ws:
        ws.receive_json()
        for _ in range(10):
            ws.send_bytes(FRAME)
        msgs = drain(ws)
    assert msgs[-1]["reason"] == "limit"
    assert msgs[-1]["id"]


def test_unknown_engine(client, me):
    with client.websocket_connect(url(me, "nope")) as ws:
        assert ws.receive_json()["type"] == "error"


def test_busy_server(client, me, monkeypatch):
    monkeypatch.setattr(settings, "max_sessions", 0)
    with client.websocket_connect(url(me)) as ws:
        m = ws.receive_json()
    assert m["type"] == "error"
    assert "busy" in m["message"]


def test_bad_client_id_is_rejected(client):
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect("/ws/transcribe?engine=fake&client_id=x"):
            pass
