import os
import uuid

os.environ["WHISPER_ENABLED"] = "false"
os.environ["GEMINI_API_KEY"] = ""

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.stt.fake import FakeEngine  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        app.state.engines["fake"] = FakeEngine()
        yield c


@pytest.fixture
def me():
    return {"X-Client-Id": str(uuid.uuid4())}
