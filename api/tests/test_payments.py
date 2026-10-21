from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from tests.conftest import GOOD_CARD, order, place


def test_tap_is_approved(client: TestClient, menu: dict[str, Any]) -> None:
    res = place(client, order(menu, ("iced-tea", 1)))
    assert res.status_code == 201
    assert res.json()["payment"]["method"] == "tap"


def test_keyed_card_is_approved(client: TestClient, menu: dict[str, Any]) -> None:
    res = place(client, order(menu, ("iced-tea", 1), payment=GOOD_CARD))
    assert res.status_code == 201
    assert res.json()["payment"] == {"method": "card", "brand": "visa", "last4": "4242"}


@pytest.mark.parametrize(
    ("number", "code"),
    [
        ("4000000000000002", "generic_decline"),
        ("4000000000009995", "insufficient_funds"),
        ("4000000000000069", "expired_card"),
        ("4000000000000127", "incorrect_cvc"),
        ("4000000000000119", "processing_error"),
    ],
)
def test_known_decline_numbers(
    client: TestClient, menu: dict[str, Any], number: str, code: str
) -> None:
    card = {**GOOD_CARD, "number": number}
    res = place(client, order(menu, ("iced-tea", 1), payment=card))
    assert res.status_code == 402
    error = res.json()["error"]
    assert error["code"] == "payment_declined"
    assert error["decline_code"] == code
    assert error["last4"] == number[-4:]
    assert "4000" not in error["message"]


def test_card_number_is_never_stored(
    client: TestClient, menu: dict[str, Any], db_path: Path
) -> None:
    res = place(client, order(menu, ("iced-tea", 1), payment=GOOD_CARD))
    assert res.status_code == 201
    assert "4242424242424242" not in res.text
    assert b"4242424242424242" not in db_path.read_bytes()


def test_amex_needs_a_four_digit_code(client: TestClient, menu: dict[str, Any]) -> None:
    card = {**GOOD_CARD, "number": "378282246310005", "cvc": "123"}
    res = place(client, order(menu, ("iced-tea", 1), payment=card))
    assert res.status_code == 422
    assert "does not match the card" in res.text
