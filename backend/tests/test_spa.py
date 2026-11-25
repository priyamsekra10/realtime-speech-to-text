import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import spa


@pytest.fixture
def site(tmp_path):
    (tmp_path / "assets").mkdir()
    (tmp_path / "assets" / "app.js").write_text("js")
    (tmp_path / "index.html").write_text("<p>app</p>")
    (tmp_path / "favicon.svg").write_text("<svg/>")
    (tmp_path.parent / "secret.txt").write_text("no")
    app = FastAPI()
    spa.mount(app, tmp_path)
    return TestClient(app)


@pytest.mark.parametrize("path", ["/", "/about", "/history", "/history/0f6b7c49-cb0c-4712-9fa6-07a19aa325a8"])
def test_app_pages_get_the_app(site, path):
    r = site.get(path)
    assert r.status_code == 200
    assert r.text == "<p>app</p>"


def test_files_are_served(site):
    assert site.get("/favicon.svg").text == "<svg/>"
    assert site.get("/assets/app.js").text == "js"


@pytest.mark.parametrize("path", ["/.git/config", "/info.php", "/history/1/2", "/aboutx", "/wp-login.php"])
def test_anything_else_is_not_found(site, path):
    assert site.get(path).status_code == 404


def test_api_paths_do_not_fall_through_to_the_app(site):
    r = site.get("/api/nope")
    assert r.status_code == 404
    assert r.json() == {"detail": "Not Found"}


def test_cannot_read_outside_the_site_folder(site):
    r = site.get("/%2e%2e/secret.txt")
    assert r.status_code == 404
    assert "no" not in r.text
