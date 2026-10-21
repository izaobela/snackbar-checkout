from dataclasses import dataclass
from typing import Literal

from app.schemas import LineIn, Menu, Source


@dataclass(frozen=True)
class PricedLine:
    item_id: str
    name: str
    unit_price_cents: int
    qty: int
    source: Source = "menu"

    @property
    def total_cents(self) -> int:
        return self.unit_price_cents * self.qty


@dataclass(frozen=True)
class PricedOrder:
    lines: tuple[PricedLine, ...]
    subtotal_cents: int
    tax_cents: int
    total_cents: int

    def totals(self) -> dict[str, int]:
        return {
            "subtotal_cents": self.subtotal_cents,
            "tax_cents": self.tax_cents,
            "total_cents": self.total_cents,
        }


@dataclass(frozen=True)
class Change:
    item_id: str
    name: str
    reason: Literal["price_changed", "unavailable", "limited"]
    old_price_cents: int
    new_price_cents: int | None
    left: int | None = None  # for "limited": how many the order can still have


class MenuChanged(Exception):
    """An ordered item is sold out, gone, short, or priced differently from what was shown."""

    def __init__(self, changes: list[Change], current: PricedOrder | None) -> None:
        super().__init__("menu changed")
        self.changes = changes
        self.current = current  # what is left, at today's prices; None if nothing is


def tax_for(subtotal_cents: int, rate_bps: int) -> int:
    """Tax on the whole subtotal, in basis points, rounded half up. Integers all the way."""
    return (subtotal_cents * rate_bps + 5_000) // 10_000


def price_order(
    menu: Menu, lines: list[LineIn], expected_total_cents: int | None = None
) -> PricedOrder:
    """Prices every line at today's menu, or raises MenuChanged with what differs."""
    changes: list[Change] = []
    priced: list[PricedLine] = []
    for line in lines:
        item = menu.item(line.item_id)
        if item is None or not item.available:
            name = item.name if item else line.item_id
            changes.append(Change(line.item_id, name, "unavailable", line.unit_price_cents, None))
            continue
        if item.price_cents != line.unit_price_cents:
            changes.append(
                Change(item.id, item.name, "price_changed", line.unit_price_cents, item.price_cents)
            )
        qty = line.qty
        if item.stock is not None and item.stock < qty:
            # Fewer left than asked for: keep what there is.
            changes.append(
                Change(
                    item.id,
                    item.name,
                    "limited",
                    line.unit_price_cents,
                    item.price_cents,
                    left=item.stock,
                )
            )
            qty = item.stock
        priced.append(PricedLine(item.id, item.name, item.price_cents, qty, line.source))
    current = _total(priced, menu.tax_rate_bps) if priced else None
    if changes or current is None:
        raise MenuChanged(changes, current)
    if expected_total_cents is not None and current.total_cents != expected_total_cents:
        # Same prices, different total: the tax rate moved under the order.
        raise MenuChanged([], current)
    return current


def _total(lines: list[PricedLine], tax_rate_bps: int) -> PricedOrder:
    subtotal = sum(line.total_cents for line in lines)
    tax = tax_for(subtotal, tax_rate_bps)
    return PricedOrder(tuple(lines), subtotal, tax, subtotal + tax)
