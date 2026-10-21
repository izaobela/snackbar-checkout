from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient

from tests.conftest import GOOD_CARD, order, place, reprice, sell_out


def test_places_an_order(client: TestClient, menu: dict[str, Any]) -> None:
    res = place(client, order(menu, ("flat-white", 2), ("iced-tea", 1)))
    assert res.status_code == 201
    body = res.json()
    assert body["pickup_number"] == "01"
    assert body["status"] == "placed"
    assert [(line["item_id"], line["qty"]) for line in body["lines"]] == [
        ("flat-white", 2),
        ("iced-tea", 1),
    ]
    assert (body["subtotal_cents"], body["tax_cents"], body["total_cents"]) == (1225, 101, 1326)
    assert body["payment"] == {"method": "tap", "brand": "visa", "last4": "4242"}
    assert res.headers["location"] == f"/api/orders/{body['id']}"
    assert client.get(res.headers["location"]).json() == body


def test_pickup_numbers_count_up(client: TestClient, menu: dict[str, Any]) -> None:
    first = place(client, order(menu, ("iced-tea", 1)), "a").json()
    second = place(client, order(menu, ("iced-tea", 1)), "b").json()
    assert (first["pickup_number"], second["pickup_number"]) == ("01", "02")


def test_lower_price_in_the_request_is_a_conflict(client: TestClient, menu: dict[str, Any]) -> None:
    body = order(menu, ("flat-white", 1))
    body["lines"][0]["unit_price_cents"] = 1
    res = place(client, body)
    assert res.status_code == 409
    error = res.json()["error"]
    assert error["code"] == "menu_changed"
    assert error["changes"] == [
        {
            "item_id": "flat-white",
            "name": "Flat white",
            "reason": "price_changed",
            "old_price_cents": 1,
            "new_price_cents": 450,
            "left": None,
        }
    ]
    assert error["current_totals"] == {"subtotal_cents": 450, "tax_cents": 37, "total_cents": 487}


def test_sold_out_item_is_a_conflict(client: TestClient, menu: dict[str, Any]) -> None:
    res = place(client, order(menu, ("blueberry-muffin", 1), ("iced-tea", 1)))
    assert res.status_code == 409
    error = res.json()["error"]
    assert [c["reason"] for c in error["changes"]] == ["unavailable"]
    assert error["current_totals"]["subtotal_cents"] == 325


def test_price_change_after_the_menu_was_shown(
    client: TestClient, menu: dict[str, Any], db_path: Path
) -> None:
    body = order(menu, ("flat-white", 1))
    reprice(db_path, "flat-white", 500)
    res = place(client, body)
    assert res.status_code == 409
    change = res.json()["error"]["changes"][0]
    assert (change["old_price_cents"], change["new_price_cents"]) == (450, 500)


def test_an_item_sold_out_after_the_menu_was_shown(
    client: TestClient, menu: dict[str, Any], db_path: Path
) -> None:
    body = order(menu, ("flat-white", 1), ("iced-tea", 1))
    sell_out(db_path, "flat-white")
    res = place(client, body)
    assert res.status_code == 409
    error = res.json()["error"]
    assert [(c["item_id"], c["reason"]) for c in error["changes"]] == [
        ("flat-white", "unavailable")
    ]
    assert error["current_totals"]["subtotal_cents"] == 325


def test_total_the_screen_showed_is_checked_too(client: TestClient, menu: dict[str, Any]) -> None:
    body = {**order(menu, ("flat-white", 1)), "expected_total_cents": 480}
    res = place(client, body)
    assert res.status_code == 409
    error = res.json()["error"]
    assert error["changes"] == []
    assert error["current_totals"]["total_cents"] == 487
    assert place(client, {**body, "expected_total_cents": 487}, "b").status_code == 201


def test_validation_errors_do_not_echo_the_input(client: TestClient, menu: dict[str, Any]) -> None:
    card = {**GOOD_CARD, "number": "1234567812345678"}
    res = place(client, order(menu, ("iced-tea", 1), payment=card))
    assert res.status_code == 422
    assert "1234567812345678" not in res.text
    error = res.json()["error"]
    assert error["code"] == "validation_error"
    assert error["fields"][0]["field"].endswith("number")
    assert error["fields"][0]["message"].startswith("That card number")


def test_duplicate_lines_are_rejected(client: TestClient, menu: dict[str, Any]) -> None:
    res = place(client, order(menu, ("iced-tea", 1), ("iced-tea", 2)))
    assert res.status_code == 422


def test_unknown_order_is_404(client: TestClient) -> None:
    res = client.get("/api/orders/nope")
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "not_found"


def test_the_last_unit_sells_once(client: TestClient, menu: dict[str, Any]) -> None:
    water = next(i for i in menu["items"] if i["id"] == "sparkling-water")
    assert (water["stock"], water["available"]) == (1, True)
    assert place(client, order(menu, ("sparkling-water", 1)), "first").status_code == 201

    water = next(i for i in client.get("/api/menu").json()["items"] if i["id"] == "sparkling-water")
    assert (water["stock"], water["available"]) == (0, False)
    res = place(client, order(menu, ("sparkling-water", 1)), "second")
    assert res.status_code == 409
    assert [c["reason"] for c in res.json()["error"]["changes"]] == ["unavailable"]


def test_asking_for_more_than_is_left_keeps_what_there_is(
    client: TestClient, menu: dict[str, Any]
) -> None:
    res = place(client, order(menu, ("sparkling-water", 2), ("iced-tea", 1)))
    assert res.status_code == 409
    error = res.json()["error"]
    assert [(c["item_id"], c["reason"], c["left"]) for c in error["changes"]] == [
        ("sparkling-water", "limited", 1)
    ]
    assert error["current_totals"]["subtotal_cents"] == 250 + 325


def test_scanned_items_need_no_pickup_number(client: TestClient, menu: dict[str, Any]) -> None:
    res = place(client, order(menu, ("sea-salt-chips", 2), source="scan"), "scan")
    assert res.status_code == 201
    assert res.json()["pickup_number"] is None
    assert res.json()["lines"][0]["source"] == "scan"
    # The counter was not touched: the next order that needs it is still the first of the day.
    assert place(client, order(menu, ("flat-white", 1)), "menu").json()["pickup_number"] == "01"


def test_a_mixed_order_gets_a_number_for_the_counter(
    client: TestClient, menu: dict[str, Any]
) -> None:
    body = order(menu, ("flat-white", 1))
    body["lines"].append({**order(menu, ("sea-salt-chips", 1), source="scan")["lines"][0]})
    res = place(client, body)
    assert res.status_code == 201
    assert res.json()["pickup_number"] == "01"
    assert [(line["item_id"], line["source"]) for line in res.json()["lines"]] == [
        ("flat-white", "menu"),
        ("sea-salt-chips", "scan"),
    ]
