import shutil
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from httpx2 import Response

from app.config import Settings
from app.db.connection import connect
from app.main import create_app
from app.services.menu import change_availability, change_price
from app.services.payments import FakeProcessor, PaymentProcessor

SEED_MENU = Path(__file__).resolve().parents[2] / "data" / "menu.json"

TAP = {"method": "tap"}
GOOD_CARD = {
    "method": "card",
    "number": "4242424242424242",
    "exp_month": 12,
    "exp_year": 2030,
    "cvc": "123",
}


@pytest.fixture
def menu_path(tmp_path: Path) -> Path:
    return Path(shutil.copy(SEED_MENU, tmp_path / "menu.json"))


@pytest.fixture
def db_path(tmp_path: Path) -> Path:
    return tmp_path / "test.db"


@pytest.fixture
def processor() -> PaymentProcessor:
    """Override in a test module to put a different processor behind the app."""
    return FakeProcessor()


@pytest.fixture
def app(menu_path: Path, db_path: Path, tmp_path: Path, processor: PaymentProcessor) -> FastAPI:
    settings = Settings(db_path=db_path, menu_path=menu_path, web_dist=tmp_path / "no-dist")
    return create_app(settings, processor=processor)


@pytest.fixture
def client(app: FastAPI) -> Iterator[TestClient]:
    with TestClient(app, raise_server_exceptions=False) as client:
        yield client


@pytest.fixture
def menu(client: TestClient) -> dict[str, Any]:
    body: dict[str, Any] = client.get("/api/menu").json()
    return body


def order(
    menu: dict[str, Any],
    *items: tuple[str, int],
    payment: dict[str, Any] = TAP,
    source: str = "menu",
) -> dict[str, Any]:
    prices = {item["id"]: item["price_cents"] for item in menu["items"]}
    return {
        "lines": [
            {"item_id": i, "qty": qty, "unit_price_cents": prices[i], "source": source}
            for i, qty in items
        ],
        "payment": payment,
    }


def place(client: TestClient, body: dict[str, Any], key: str = "a") -> Response:
    """POST /api/orders under an Idempotency-Key. The same key name replays the first answer."""
    return client.post("/api/orders", json=body, headers={"Idempotency-Key": f"test-key-{key}"})


def reprice(db_path: Path, item_id: str, cents: int) -> None:
    """What the counter does with `python -m app.manage price`, on its own connection."""
    conn = connect(db_path)
    try:
        change_price(conn, item_id, cents)
    finally:
        conn.close()


def sell_out(db_path: Path, item_id: str) -> None:
    conn = connect(db_path)
    try:
        change_availability(conn, item_id, False)
    finally:
        conn.close()
