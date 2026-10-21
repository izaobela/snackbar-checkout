FROM node:24-slim AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
COPY data/menu.json /data/menu.json
RUN npm run build

FROM python:3.13-slim
COPY --from=ghcr.io/astral-sh/uv:0.13.0 /uv /bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never

WORKDIR /app
COPY api/pyproject.toml api/uv.lock ./
RUN uv sync --frozen --no-dev
COPY api/app ./app
COPY data/menu.json /data/menu.json
COPY --from=web /web/dist ./web-dist

RUN useradd --uid 10001 --create-home kiosk \
    && mkdir -p /data/db \
    && chown -R kiosk:kiosk /data
USER kiosk

ENV SNACKBAR_DB_PATH=/data/db/snackbar.db \
    SNACKBAR_MENU_PATH=/data/menu.json \
    SNACKBAR_WEB_DIST=/app/web-dist \
    PATH="/app/.venv/bin:${PATH}"

EXPOSE 8420
HEALTHCHECK --interval=5s --timeout=3s --start-period=10s --retries=6 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8420/api/health', timeout=2)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8420", "--no-server-header"]
