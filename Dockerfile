FROM node:22-alpine AS web
WORKDIR /web
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim AS model
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu \
 && pip install --no-cache-dir transformers ctranslate2
ARG WHISPER_REPO=Oriserve/Whisper-Hindi2Hinglish-Swift
RUN ct2-transformers-converter --model $WHISPER_REPO --output_dir /model \
    --quantization int8 --copy_files tokenizer.json preprocessor_config.json

FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:0.10.9 /uv /usr/local/bin/uv
WORKDIR /app
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY backend/ ./
COPY --from=web /web/dist ./static
COPY --from=model /model /models/hinglish-swift
ENV PATH="/app/.venv/bin:$PATH" WHISPER_MODEL=/models/hinglish-swift STATIC_DIR=static
EXPOSE 8000
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
