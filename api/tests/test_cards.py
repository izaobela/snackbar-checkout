from datetime import UTC, datetime

import pytest

from app.cards import detect_brand, expiry_in_future, luhn_ok


@pytest.mark.parametrize(
    "number", ["4242424242424242", "5555555555554444", "378282246310005", "6011111111111117"]
)
def test_luhn_accepts_valid_numbers(number: str) -> None:
    assert luhn_ok(number)


@pytest.mark.parametrize("number", ["4242424242424241", "1234567812345678", "4"])
def test_luhn_rejects_typos(number: str) -> None:
    assert not luhn_ok(number)


@pytest.mark.parametrize(
    ("number", "brand"),
    [
        ("4242424242424242", "visa"),
        ("5555555555554444", "mastercard"),
        ("2223003122003222", "mastercard"),
        ("378282246310005", "amex"),
        ("6011111111111117", "discover"),
        ("9999999999999999", "unknown"),
    ],
)
def test_brands(number: str, brand: str) -> None:
    assert detect_brand(number) == brand


def test_expiry() -> None:
    now = datetime(2026, 10, 20, tzinfo=UTC)
    assert expiry_in_future(10, 2026, now)
    assert expiry_in_future(1, 2027, now)
    assert not expiry_in_future(9, 2026, now)
