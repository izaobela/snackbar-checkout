"""The menu lives in the database: seeded once from the file, changed by the counter."""

import json
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.config import Settings
from app.db.connection import SCHEMA, columns, connect, init_schema
from app.main import create_app
from app.services.menu import seed_if_empty
from app.services.payments import Approved, Card, Declined
from tests.conftest import order, place, reprice, sell_out


def test_serves_the_seed_menu(client: TestClient) -> None:
    body = client.get("/api/menu").json()
    assert body["currency"] == "USD"
    assert body["tax_rate_bps"] == 825
    assert len(body["categories"]) == 5
    assert len(body["items"]) == 18
    assert {i["id"] for i in body["items"] if not i["available"]} == {
        "blueberry-muffin",
        "ice-cream-sandwich",
    }


def test_a_price_change_shows_on_the_next_request(client: TestClient, db_path: Path) -> None:
    reprice(db_path, "flat-white", 999)
    item = next(i for i in client.get("/api/menu").json()["items"] if i["id"] == "flat-white")
    assert item["price_cents"] == 999


def test_selling_out_shows_on_the_next_request(client: TestClient, db_path: Path) -> None:
    sell_out(db_path, "flat-white")
    item = next(i for i in client.get("/api/menu").json()["items"] if i["id"] == "flat-white")
    assert item["available"] is False


def test_the_seed_runs_once(
    client: TestClient, db_path: Path, menu_path: Path, tmp_path: Path
) -> None:
    reprice(db_path, "flat-white", 999)
    settings = Settings(db_path=db_path, menu_path=menu_path, web_dist=tmp_path / "no-dist")
    with TestClient(create_app(settings)) as restarted:
        assert restarted.get("/api/menu").json()["items"][0]["price_cents"] == 999


def test_an_unknown_item_cannot_be_changed(client: TestClient, db_path: Path) -> None:
    with pytest.raises(LookupError):
        reprice(db_path, "ghost", 1)


def test_a_missing_seed_file_fails_fast(tmp_path: Path) -> None:
    conn = connect(tmp_path / "empty.db")
    init_schema(conn)
    with pytest.raises(FileNotFoundError):
        seed_if_empty(conn, tmp_path / "missing.json")


def test_a_seed_with_duplicate_ids_is_rejected(tmp_path: Path) -> None:
    path = tmp_path / "menu.json"
    item = {"id": "a", "category": "c", "name": "A", "price_cents": 1}
    path.write_text(json.dumps({"categories": [{"id": "c", "name": "C"}], "items": [item, item]}))
    conn = connect(tmp_path / "empty.db")
    init_schema(conn)
    with pytest.raises(ValueError, match="duplicate"):
        seed_if_empty(conn, path)


class HeldCharge:
    """A processor that signals when the charge starts and waits to be released."""

    def __init__(self) -> None:
        self.charging = threading.Event()
        self.release = threading.Event()

    def charge(self, amount_cents: int, card: Card | None) -> Approved | Declined:
        self.charging.set()
        self.release.wait(5)
        return Approved("visa", "4242")


def test_a_price_change_waits_for_the_order_in_flight(
    app: FastAPI, client: TestClient, menu: dict[str, Any], db_path: Path
) -> None:
    held = HeldCharge()
    app.state.processor = held
    body = order(menu, ("flat-white", 1))
    with ThreadPoolExecutor(max_workers=2) as pool:
        placing = pool.submit(place, client, body)
        assert held.charging.wait(5)  # the order holds the write lock, mid-charge
        repricing = pool.submit(reprice, db_path, "flat-white", 500)
        with pytest.raises(TimeoutError):
            repricing.result(timeout=0.3)  # the counter's change is waiting, not applied
        held.release.set()
        placed = placing.result(5)
        repricing.result(5)
    assert placed.status_code == 201
    assert placed.json()["total_cents"] == 487  # charged at the price the order started with
    assert placed.json()["lines"][0]["unit_price_cents"] == 450  # and stored that way
    assert client.get("/api/menu").json()["items"][0]["price_cents"] == 500


def test_a_half_seeded_database_is_reported(tmp_path: Path) -> None:
    conn = connect(tmp_path / "half.db")
    init_schema(conn)
    conn.execute("INSERT INTO categories (id, name, position) VALUES ('drinks', 'Drinks', 0)")
    with pytest.raises(RuntimeError, match="half seeded"):
        seed_if_empty(conn, tmp_path / "unused.json")


def test_two_orders_for_the_last_unit_at_once(client: TestClient, menu: dict[str, Any]) -> None:
    body = order(menu, ("sparkling-water", 1))
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda n: place(client, body, f"race-{n}"), range(2)))
    assert sorted(r.status_code for r in results) == [201, 409]


def test_an_older_database_gains_the_stock_column(tmp_path: Path) -> None:
    conn = connect(tmp_path / "old.db")
    older = SCHEMA.read_text(encoding="utf-8").replace(
        "    stock INTEGER CHECK (stock IS NULL OR stock >= 0),\n", ""
    )
    conn.executescript(older)
    assert "stock" not in columns(conn, "items")
    init_schema(conn)
    assert "stock" in columns(conn, "items")


def test_an_older_database_lets_orders_skip_the_pickup_number(tmp_path: Path) -> None:
    conn = connect(tmp_path / "old.db")
    older = (
        SCHEMA.read_text(encoding="utf-8")
        .replace("    pickup_number TEXT,\n", "    pickup_number TEXT NOT NULL,\n")
        .replace(
            "    source TEXT NOT NULL DEFAULT 'menu' CHECK (source IN ('scan', 'menu')),\n", ""
        )
    )
    conn.executescript(older)
    conn.execute(
        "INSERT INTO orders (id, pickup_number, currency, subtotal_cents, tax_cents, total_cents,"
        " created_at) VALUES ('old', '01', 'USD', 100, 8, 108, '2026-10-21T10:00:00Z')"
    )
    conn.execute(
        "INSERT INTO order_lines (order_id, position, item_id, name, unit_price_cents, qty)"
        " VALUES ('old', 0, 'iced-tea', 'Iced tea', 100, 1)"
    )
    init_schema(conn)
    assert "source" in columns(conn, "order_lines")
    conn.execute(
        "INSERT INTO orders (id, pickup_number, currency, subtotal_cents, tax_cents, total_cents,"
        " created_at) VALUES ('new', NULL, 'USD', 100, 8, 108, '2026-10-21T10:01:00Z')"
    )
    assert conn.execute("SELECT COUNT(*) FROM orders").fetchone()[0] == 2
    assert conn.execute("SELECT source FROM order_lines").fetchone()[0] == "menu"
