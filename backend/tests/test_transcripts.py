import uuid


def make(client, me, title="Vendor call", text="kal tak quotation bhej do"):
    r = client.post("/api/transcripts", json={"title": title, "text": text}, headers=me)
    assert r.status_code == 201
    return r.json()


def test_create_and_read(client, me):
    t = make(client, me)
    assert t["engine"] == "manual"
    assert t["word_count"] == 5
    assert t["segments"] == []

    r = client.get(f"/api/transcripts/{t['id']}", headers=me)
    assert r.status_code == 200
    assert r.json()["title"] == "Vendor call"


def test_list_newest_first_and_paged(client, me):
    for i in range(3):
        make(client, me, title=f"note {i}")
    r = client.get("/api/transcripts", params={"limit": 2}, headers=me).json()
    assert r["total"] == 3
    assert [t["title"] for t in r["items"]] == ["note 2", "note 1"]

    r = client.get("/api/transcripts", params={"limit": 2, "offset": 2}, headers=me).json()
    assert [t["title"] for t in r["items"]] == ["note 0"]


def test_search_title_and_text(client, me):
    make(client, me, title="Cement order", text="paanch sau kilo")
    make(client, me, title="Standup", text="deployment Friday ko hai")
    r = client.get("/api/transcripts", params={"q": "friday"}, headers=me).json()
    assert [t["title"] for t in r["items"]] == ["Standup"]
    r = client.get("/api/transcripts", params={"q": "CEMENT"}, headers=me).json()
    assert r["total"] == 1


def test_update(client, me):
    t = make(client, me)
    r = client.patch(f"/api/transcripts/{t['id']}", json={"text": "naya text"}, headers=me)
    assert r.status_code == 200
    body = r.json()
    assert body["text"] == "naya text"
    assert body["title"] == "Vendor call"
    assert t["updated_at"] == t["created_at"]
    assert body["updated_at"] > body["created_at"]

    r = client.patch(f"/api/transcripts/{t['id']}", json={"title": ""}, headers=me)
    assert r.status_code == 422


def test_delete(client, me):
    t = make(client, me)
    assert client.delete(f"/api/transcripts/{t['id']}", headers=me).status_code == 204
    assert client.get(f"/api/transcripts/{t['id']}", headers=me).status_code == 404
    assert client.delete(f"/api/transcripts/{t['id']}", headers=me).status_code == 404


def test_other_browser_cannot_see_or_change(client, me):
    t = make(client, me)
    other = {"X-Client-Id": str(uuid.uuid4())}
    assert client.get(f"/api/transcripts/{t['id']}", headers=other).status_code == 404
    assert client.patch(f"/api/transcripts/{t['id']}", json={"title": "x"}, headers=other).status_code == 404
    assert client.delete(f"/api/transcripts/{t['id']}", headers=other).status_code == 404
    assert client.get("/api/transcripts", headers=other).json()["total"] == 0


def test_client_id_is_required(client):
    assert client.get("/api/transcripts").status_code == 422
    assert client.get("/api/transcripts", headers={"X-Client-Id": "bad id!"}).status_code == 422


def test_stats(client, me):
    def stats():
        return client.get("/api/transcripts/stats", headers=me).json()

    assert stats() == {"count": 0, "words": 0, "duration_ms": 0}
    make(client, me, text="ek do teen")
    make(client, me, text="")
    assert stats() == {"count": 2, "words": 3, "duration_ms": 0}
