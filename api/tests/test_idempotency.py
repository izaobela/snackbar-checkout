import sqlite3
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient

from tests.conftest import GOOD_CARD, order, place

DECLINED_CARD = {**GOOD_CARD, "number": "4000000000000002"}


def count(db_path: Path, table: str) -> int:
    with sqlite3.connect(db_path) as conn:
        return int(conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0])


def test_key_is_required(client: TestClient, menu: dict[str, Any]) -> None:
    res = client.post("/api/orders", json=order(menu, ("iced-tea", 1)))
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "idempotency_key_required"


def test_same_request_is_replayed(client: TestClient, menu: dict[str, Any], db_path: Path) -> None:
    body = order(menu, ("iced-tea", 1))
    first = place(client, body)
    second = place(client, body)
    assert first.status_code == second.status_code == 201
    assert first.json() == second.json()
    assert count(db_path, "orders") == 1


def test_another_card_for_the_same_lines_replays_the_placed_order(
    client: TestClient, menu: dict[str, Any], db_path: Path
) -> None:
    # The first reply got lost, the person pays again with a card: same order, charged once.
    body = order(menu, ("iced-tea", 1))
    first = place(client, body)
    second = place(client, {**body, "payment": GOOD_CARD})
    assert first.status_code == second.status_code == 201
    assert first.json() == second.json()
    assert count(db_path, "payments") == 1


def test_different_lines_with_same_key_are_rejected(
    client: TestClient, menu: dict[str, Any], db_path: Path
) -> None:
    place(client, order(menu, ("iced-tea", 1)))
    res = place(client, order(menu, ("iced-tea", 2)))
    assert res.status_code == 409
    assert res.json()["error"]["code"] == "idempotency_key_reused"
    assert count(db_path, "orders") == 1


def test_decline_is_replayed(client: TestClient, menu: dict[str, Any], db_path: Path) -> None:
    body = order(menu, ("iced-tea", 1), payment=DECLINED_CARD)
    first = place(client, body)
    second = place(client, body)
    assert first.status_code == second.status_code == 402
    assert first.json() == second.json()
    assert count(db_path, "payments") == 1
    assert count(db_path, "orders") == 0


def test_concurrent_identical_requests_create_one_order(
    client: TestClient, menu: dict[str, Any], db_path: Path
) -> None:
    body = order(menu, ("flat-white", 1))
    with ThreadPoolExecutor(max_workers=20) as pool:
        results = list(pool.map(lambda _: place(client, body, "same"), range(20)))
    assert {r.status_code for r in results} == {201}
    assert len({r.json()["id"] for r in results}) == 1
    assert count(db_path, "orders") == 1


def test_concurrent_distinct_keys_get_distinct_pickup_numbers(
    client: TestClient, menu: dict[str, Any]
) -> None:
    body = order(menu, ("flat-white", 1))
    with ThreadPoolExecutor(max_workers=20) as pool:
        results = list(pool.map(lambda n: place(client, body, str(n)), range(20)))
    assert {r.status_code for r in results} == {201}
    assert sorted(r.json()["pickup_number"] for r in results) == [f"{n:02d}" for n in range(1, 21)]
