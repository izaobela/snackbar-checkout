"""The processor does not answer, or the code behind it breaks. Nothing may be half-done."""

from pathlib import Path
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.services.payments import Approved, Card, Declined, ProcessorError
from tests.conftest import order, place
from tests.test_idempotency import count


class FlakyProcessor:
    """Fails the first charge the way a gateway timeout would, then approves."""

    def __init__(self) -> None:
        self.calls = 0

    def charge(self, amount_cents: int, card: Card | None) -> Approved | Declined:
        self.calls += 1
        if self.calls == 1:
            raise ProcessorError("gateway timed out")
        return Approved("visa", "4242")


class BrokenProcessor:
    def charge(self, amount_cents: int, card: Card | None) -> Approved | Declined:
        raise RuntimeError("bug in the adapter")


@pytest.fixture
def processor() -> FlakyProcessor:
    return FlakyProcessor()


def test_outage_is_a_503_and_the_same_key_tries_again(
    client: TestClient, menu: dict[str, Any], db_path: Path, processor: FlakyProcessor
) -> None:
    body = order(menu, ("iced-tea", 1))
    first = place(client, body)
    assert first.status_code == 503
    assert first.json()["error"]["code"] == "payment_unavailable"
    tables = ("orders", "payments", "idempotency_keys")
    assert [count(db_path, table) for table in tables] == [0, 0, 0]

    second = place(client, body)
    assert second.status_code == 201
    assert processor.calls == 2
    assert count(db_path, "orders") == 1


def test_an_unexpected_error_still_answers_in_json(
    app: FastAPI, client: TestClient, menu: dict[str, Any], db_path: Path
) -> None:
    app.state.processor = BrokenProcessor()
    res = place(client, order(menu, ("iced-tea", 1)))
    assert res.status_code == 500
    assert res.json()["error"] == {
        "code": "internal_error",
        "message": "Something went wrong on our side. Try again in a moment.",
    }
    assert count(db_path, "orders") == 0
    assert count(db_path, "idempotency_keys") == 0
