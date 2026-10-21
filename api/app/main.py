import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.config import Settings
from app.db.connection import connect, init_schema
from app.errors import install_error_handlers
from app.middleware import install_middleware
from app.routers import health, menu, orders
from app.services.menu import seed_if_empty
from app.services.payments import FakeProcessor, PaymentProcessor


def create_app(
    settings: Settings | None = None, processor: PaymentProcessor | None = None
) -> FastAPI:
    settings = settings or Settings()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        conn = connect(settings.db_path)
        try:
            init_schema(conn)
            seed_if_empty(conn, settings.menu_path)  # a bad seed file fails here, not at an order
        finally:
            conn.close()
        yield

    app = FastAPI(
        title="Snack bar checkout",
        lifespan=lifespan,
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        redoc_url=None,
    )
    app.state.settings = settings
    app.state.processor = processor or FakeProcessor(delay_seconds=0.4)
    install_error_handlers(app)
    install_middleware(app)

    app.include_router(menu.router, prefix="/api")
    app.include_router(orders.router, prefix="/api")
    app.include_router(health.router, prefix="/api")

    if settings.web_dist.is_dir():
        app.mount("/", StaticFiles(directory=settings.web_dist, html=True), name="web")
    return app


app = create_app()
