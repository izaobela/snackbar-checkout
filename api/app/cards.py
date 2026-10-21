from datetime import UTC, datetime
from typing import Literal

Brand = Literal["visa", "mastercard", "amex", "discover", "unknown"]


def digits_only(value: str) -> str:
    return "".join(ch for ch in value if ch.isdigit())


def luhn_ok(number: str) -> bool:
    digits = [int(ch) for ch in number]
    if len(digits) < 2:
        return False
    total = 0
    parity = len(digits) % 2
    for index, digit in enumerate(digits):
        if index % 2 == parity:
            digit *= 2
            if digit > 9:
                digit -= 9
        total += digit
    return total % 10 == 0


def detect_brand(number: str) -> Brand:
    if number.startswith("4"):
        return "visa"
    if number[:2] in {"34", "37"}:
        return "amex"
    if number[:2] in {"51", "52", "53", "54", "55"} or 2221 <= int(number[:4] or "0") <= 2720:
        return "mastercard"
    if number.startswith("6011") or number[:2] == "65":
        return "discover"
    return "unknown"


def cvc_length_for(brand: Brand) -> int:
    return 4 if brand == "amex" else 3


def expiry_in_future(month: int, year: int, now: datetime | None = None) -> bool:
    current = now or datetime.now(UTC)
    return (year, month) >= (current.year, current.month)
