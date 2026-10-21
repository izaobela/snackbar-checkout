import pytest

from app.schemas import LineIn, Menu
from app.services.pricing import MenuChanged, price_order, tax_for

MENU = Menu.model_validate(
    {
        "currency": "USD",
        "tax_rate_bps": 825,
        "categories": [{"id": "drinks", "name": "Drinks"}],
        "items": [
            {"id": "coffee", "category": "drinks", "name": "Coffee", "price_cents": 275},
            {"id": "tea", "category": "drinks", "name": "Tea", "price_cents": 325},
            {"id": "water", "category": "drinks", "name": "Water", "price_cents": 250, "stock": 1},
            {"id": "soda", "category": "drinks", "name": "Soda", "price_cents": 300, "stock": 0},
            {
                "id": "juice",
                "category": "drinks",
                "name": "Juice",
                "price_cents": 400,
                "available": False,
            },
        ],
    }
)


def line(item_id: str, qty: int, seen_price: int) -> LineIn:
    return LineIn(item_id=item_id, qty=qty, unit_price_cents=seen_price)


@pytest.mark.parametrize(
    ("subtotal", "tax"),
    # 200 and 1000 land exactly on a half cent at 8.25%: they must go up, not down.
    [(0, 0), (100, 8), (200, 17), (450, 37), (999, 82), (1000, 83), (1212, 100)],
)
def test_tax_rounds_half_up(subtotal: int, tax: int) -> None:
    assert tax_for(subtotal, 825) == tax


def test_totals() -> None:
    priced = price_order(MENU, [line("coffee", 2, 275), line("tea", 1, 325)])
    assert [(p.item_id, p.total_cents) for p in priced.lines] == [("coffee", 550), ("tea", 325)]
    assert (priced.subtotal_cents, priced.tax_cents, priced.total_cents) == (875, 72, 947)


def test_price_change_reports_old_and_new() -> None:
    with pytest.raises(MenuChanged) as info:
        price_order(MENU, [line("coffee", 1, 250), line("tea", 1, 325)])
    (change,) = info.value.changes
    assert (change.item_id, change.reason, change.old_price_cents, change.new_price_cents) == (
        "coffee",
        "price_changed",
        250,
        275,
    )
    assert info.value.current is not None
    assert info.value.current.total_cents == 650  # both lines, at today's prices


def test_sold_out_item_leaves_the_new_total() -> None:
    with pytest.raises(MenuChanged) as info:
        price_order(MENU, [line("juice", 1, 400), line("tea", 1, 325)])
    assert [c.reason for c in info.value.changes] == ["unavailable"]
    assert info.value.current is not None
    assert info.value.current.subtotal_cents == 325


def test_unknown_item_counts_as_unavailable() -> None:
    with pytest.raises(MenuChanged) as info:
        price_order(MENU, [line("ghost", 1, 100)])
    assert info.value.changes[0].reason == "unavailable"
    assert info.value.current is None


def test_a_different_total_with_the_same_prices_is_a_change_too() -> None:
    with pytest.raises(MenuChanged) as info:
        price_order(MENU, [line("tea", 1, 325)], expected_total_cents=325)
    assert info.value.changes == []
    assert info.value.current is not None
    assert info.value.current.total_cents == 352
    assert price_order(MENU, [line("tea", 1, 325)], expected_total_cents=352).total_cents == 352


def test_the_last_units_cap_the_line_and_say_so() -> None:
    with pytest.raises(MenuChanged) as info:
        price_order(MENU, [line("water", 2, 250), line("tea", 1, 325)])
    (change,) = info.value.changes
    assert (change.reason, change.left) == ("limited", 1)
    assert info.value.current is not None
    assert [(p.item_id, p.qty) for p in info.value.current.lines] == [("water", 1), ("tea", 1)]


def test_a_count_of_zero_is_sold_out() -> None:
    soda = MENU.item("soda")
    assert soda is not None and soda.available is False
    with pytest.raises(MenuChanged) as info:
        price_order(MENU, [line("soda", 1, 300)])
    assert info.value.changes[0].reason == "unavailable"
