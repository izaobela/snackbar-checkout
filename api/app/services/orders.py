import hashlib
import json
import logging
import sqlite3
from dataclasses import asdict
from typing import Any

from app.config import Settings
from app.db import repository
from app.db.connection import transaction
from app.errors import ApiError, error_body
from app.schemas import CardPayment, Menu, OrderIn
from app.services.menu import current_menu
from app.services.payments import Approved, Card, Declined, PaymentProcessor, ProcessorError
from app.services.pricing import MenuChanged, PricedOrder, price_order

log = logging.getLogger(__name__)

Reply = tuple[int, dict[str, Any]]


def request_hash(order: OrderIn) -> str:
    """A digest of the lines; the tender stays out (decisions.md, 4)."""
    canonical = [line.model_dump() for line in order.lines]
    return hashlib.sha256(json.dumps(canonical, sort_keys=True).encode()).hexdigest()


def create_order(
    conn: sqlite3.Connection,
    settings: Settings,
    processor: PaymentProcessor,
    order: OrderIn,
    key: str,
) -> dict[str, Any]:
    """Places the order and returns it. Every other outcome is an ApiError."""
    digest = request_hash(order)
    with transaction(conn):
        reply = _replay(conn, key, digest) or _attempt(
            conn, settings, processor, order, key, digest
        )
    status, body = reply
    if status != 201:
        raise ApiError.from_body(status, body)
    return body


def _replay(conn: sqlite3.Connection, key: str, digest: str) -> Reply | None:
    stored = repository.find_key(conn, key)
    if stored is None:
        return None
    if stored.request_hash != digest:
        raise ApiError(
            409, "idempotency_key_reused", "That key was already used for a different order."
        )
    return stored.status_code, stored.body


def _attempt(
    conn: sqlite3.Connection,
    settings: Settings,
    processor: PaymentProcessor,
    order: OrderIn,
    key: str,
    digest: str,
) -> Reply:
    menu = current_menu(conn, settings)  # read under the write lock: the prices of this moment
    priced = _price(menu, order)
    result = _charge(processor, order, priced)
    if isinstance(result, Declined):
        reply = _decline(conn, order, result, priced)
    else:
        reply = _place(conn, menu, order, result, priced)
    repository.save_key(conn, key, digest, *reply)
    return reply


def _price(menu: Menu, order: OrderIn) -> PricedOrder:
    try:
        return price_order(menu, order.lines, order.expected_total_cents)
    except MenuChanged as exc:
        raise ApiError(
            409,
            "menu_changed",
            "The menu changed while you were ordering.",
            changes=[asdict(change) for change in exc.changes],
            current_totals=exc.current.totals() if exc.current else None,
        ) from exc


def _charge(
    processor: PaymentProcessor, order: OrderIn, priced: PricedOrder
) -> Approved | Declined:
    card = None
    if isinstance(order.payment, CardPayment):
        p = order.payment
        card = Card(number=p.number, exp_month=p.exp_month, exp_year=p.exp_year, cvc=p.cvc)
    try:
        return processor.charge(priced.total_cents, card)
    except ProcessorError as exc:
        # Unknown whether the charge happened: store nothing, keep the key free for the retry.
        log.warning("processor unavailable: %s", exc)
        raise ApiError(
            503,
            "payment_unavailable",
            "We could not reach the card network. Try again in a moment.",
        ) from exc


def _decline(
    conn: sqlite3.Connection, order: OrderIn, result: Declined, priced: PricedOrder
) -> Reply:
    _record_payment(conn, None, order, result, priced)
    log.info("payment declined: %s", result.code)
    body = error_body(
        "payment_declined", result.message, decline_code=result.code, last4=result.last4
    )
    return 402, body


def _place(
    conn: sqlite3.Connection, menu: Menu, order: OrderIn, result: Approved, priced: PricedOrder
) -> Reply:
    # Scanned items are already in the person's hands; a number is for what the counter makes.
    needs_counter = any(line.source == "menu" for line in priced.lines)
    pickup_number = repository.next_pickup_number(conn) if needs_counter else None
    order_id = repository.insert_order(conn, priced, menu.currency, pickup_number)
    repository.take_stock(conn, priced.lines)
    _record_payment(conn, order_id, order, result, priced)
    created = repository.get_order(conn, order_id)
    if created is None:
        raise RuntimeError("order vanished inside its own transaction")
    log.info("order %s placed, pickup %s, %d cents", order_id, pickup_number, priced.total_cents)
    return 201, created


def _record_payment(
    conn: sqlite3.Connection,
    order_id: str | None,
    order: OrderIn,
    result: Approved | Declined,
    priced: PricedOrder,
) -> None:
    declined = result if isinstance(result, Declined) else None
    repository.insert_payment(
        conn,
        order_id=order_id,
        method=order.payment.method,
        brand=result.brand,
        last4=result.last4,
        status="declined" if declined else "approved",
        decline_code=declined.code if declined else None,
        amount_cents=priced.total_cents,
    )
