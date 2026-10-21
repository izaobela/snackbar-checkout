import time
from dataclasses import dataclass, field
from typing import Protocol

from app.cards import detect_brand


@dataclass(frozen=True)
class Card:
    number: str = field(repr=False)
    exp_month: int = field(repr=False)
    exp_year: int = field(repr=False)
    cvc: str = field(repr=False)


@dataclass(frozen=True)
class Approved:
    brand: str
    last4: str


@dataclass(frozen=True)
class Declined:
    brand: str
    last4: str
    code: str
    message: str


class ProcessorError(Exception):
    """The processor did not answer. Whether the charge happened is unknown."""


class PaymentProcessor(Protocol):
    def charge(self, amount_cents: int, card: Card | None) -> Approved | Declined:
        """Charges the amount, or raises ProcessorError when the processor cannot be reached."""
        ...


# Stripe's test card numbers.
TEST_DECLINES: dict[str, tuple[str, str]] = {
    "4000000000000002": ("generic_decline", "Your card was declined. Try another card."),
    "4000000000009995": ("insufficient_funds", "Your card was declined for insufficient funds."),
    "4000000000000069": ("expired_card", "That card has expired. Check the date or use another."),
    "4000000000000127": ("incorrect_cvc", "The security code did not match. Check the back."),
    "4000000000000119": ("processing_error", "We could not reach your bank. Try again shortly."),
}


class FakeProcessor:
    """Approves everything except the test numbers above. A tap counts as a 4242 Visa."""

    def __init__(self, delay_seconds: float = 0.0) -> None:
        self._delay = delay_seconds

    def charge(self, amount_cents: int, card: Card | None) -> Approved | Declined:
        if self._delay:
            time.sleep(self._delay)
        if card is None:
            return Approved("visa", "4242")
        brand = detect_brand(card.number)
        last4 = card.number[-4:]
        if card.number in TEST_DECLINES:
            code, message = TEST_DECLINES[card.number]
            return Declined(brand, last4, code, message)
        return Approved(brand, last4)
