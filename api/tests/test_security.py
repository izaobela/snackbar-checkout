"""The basics for an API on a shop LAN: bounded input, parameterised SQL, quiet errors, headers."""

from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient

from tests.conftest import order, place


def test_a_key_that_does_not_look_like_a_key_is_rejected(
    client: TestClient, menu: dict[str, Any]
) -> None:
    for bad in ("short", "x" * 129, "has space", "semi;colon"):
        res = client.post(
            "/api/orders", json=order(menu, ("iced-tea", 1)), headers={"Idempotency-Key": bad}
        )
        assert res.status_code == 400, bad
        assert res.json()["error"]["code"] == "idempotency_key_invalid"


def test_an_oversized_body_is_refused_before_it_is_parsed(
    client: TestClient, menu: dict[str, Any]
) -> None:
    body = {**order(menu, ("iced-tea", 1)), "padding": "x" * 70_000}
    res = place(client, body)
    assert res.status_code == 413
    assert res.json()["error"]["code"] == "payload_too_large"


def test_sql_in_the_input_is_just_a_string(client: TestClient, menu: dict[str, Any]) -> None:
    body = order(menu, ("iced-tea", 1))
    body["lines"][0]["item_id"] = "iced-tea' OR 1=1 --"
    assert place(client, body).status_code == 422  # the id pattern stops it at the door
    assert client.get("/api/orders/' OR 1=1 --").status_code == 404  # bound as a parameter


def test_a_price_beyond_any_menu_is_rejected(client: TestClient, menu: dict[str, Any]) -> None:
    body = order(menu, ("iced-tea", 1))
    body["lines"][0]["unit_price_cents"] = 10**12
    assert place(client, body).status_code == 422


def test_api_responses_carry_the_basic_headers(client: TestClient) -> None:
    headers = client.get("/api/health").headers
    assert headers["x-content-type-options"] == "nosniff"
    assert headers["x-frame-options"] == "DENY"
    assert headers["referrer-policy"] == "no-referrer"
    assert headers["cache-control"] == "no-store"
    assert headers["content-security-policy"].startswith("default-src 'self'")
    assert "camera=()" in headers["permissions-policy"]


def test_the_docs_page_is_the_one_place_without_the_policy(client: TestClient) -> None:
    res = client.get("/api/docs")
    assert res.status_code == 200
    assert "content-security-policy" not in res.headers


def test_card_data_never_reaches_the_database(
    client: TestClient, menu: dict[str, Any], db_path: Path
) -> None:
    card = {
        "method": "card",
        "number": "5555555555554444",
        "exp_month": 11,
        "exp_year": 2031,
        "cvc": "987",
    }
    res = place(client, order(menu, ("iced-tea", 1), payment=card))
    assert res.status_code == 201
    stored = db_path.read_bytes()
    assert b"5555555555554444" not in stored
    assert b"987" not in stored.replace(b"1987", b"")  # the CVC, not a year in a timestamp
    assert res.json()["payment"] == {"method": "card", "brand": "mastercard", "last4": "4444"}


def test_card_fields_are_bounded_before_the_digits_are_counted(
    client: TestClient, menu: dict[str, Any]
) -> None:
    padded = "4242 4242 4242 4242" + " " * 40
    card = {"method": "card", "number": padded, "exp_month": 12, "exp_year": 2030, "cvc": "123"}
    res = place(client, order(menu, ("iced-tea", 1), payment=card))
    assert res.status_code == 422
    assert "4242" not in res.text
