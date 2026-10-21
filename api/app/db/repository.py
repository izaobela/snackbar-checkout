import json
import sqlite3
import uuid
from collections.abc import Iterable
from datetime import UTC, datetime
from typing import Any, NamedTuple

from app.schemas import Category, Item, MenuData
from app.services.pricing import PricedLine, PricedOrder


def now() -> datetime:
    return datetime.now(UTC)


def now_iso() -> str:
    return now().isoformat(timespec="seconds").replace("+00:00", "Z")


# Menu


def count_items(conn: sqlite3.Connection) -> int:
    return int(conn.execute("SELECT COUNT(*) FROM items").fetchone()[0])


def count_categories(conn: sqlite3.Connection) -> int:
    return int(conn.execute("SELECT COUNT(*) FROM categories").fetchone()[0])


def insert_menu(conn: sqlite3.Connection, data: MenuData) -> None:
    conn.executemany(
        "INSERT INTO categories (id, name, position) VALUES (?, ?, ?)",
        [(c.id, c.name, position) for position, c in enumerate(data.categories)],
    )
    conn.executemany(
        "INSERT INTO items (id, category, name, description, price_cents, tags, allergens,"
        " available, stock, image, code, position)"
        " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
            (
                item.id,
                item.category,
                item.name,
                item.description,
                item.price_cents,
                json.dumps(item.tags),
                json.dumps(item.allergens),
                int(item.available),
                item.stock,
                item.image,
                item.code,
                position,
            )
            for position, item in enumerate(data.items)
        ],
    )


def load_menu(conn: sqlite3.Connection) -> MenuData:
    # Two reads; only items change after the seed.
    categories = [
        Category(id=row["id"], name=row["name"])
        for row in conn.execute("SELECT id, name FROM categories ORDER BY position")
    ]
    items = [
        Item(
            id=row["id"],
            category=row["category"],
            name=row["name"],
            description=row["description"],
            price_cents=row["price_cents"],
            tags=json.loads(row["tags"]),
            allergens=json.loads(row["allergens"]),
            available=bool(row["available"]),
            stock=row["stock"],
            image=row["image"],
            code=row["code"],
        )
        for row in conn.execute("SELECT * FROM items ORDER BY position")
    ]
    return MenuData(categories=categories, items=items)


def update_price(conn: sqlite3.Connection, item_id: str, price_cents: int) -> bool:
    cursor = conn.execute("UPDATE items SET price_cents = ? WHERE id = ?", (price_cents, item_id))
    return cursor.rowcount == 1


def update_available(conn: sqlite3.Connection, item_id: str, available: bool) -> bool:
    cursor = conn.execute("UPDATE items SET available = ? WHERE id = ?", (int(available), item_id))
    return cursor.rowcount == 1


def update_stock(conn: sqlite3.Connection, item_id: str, stock: int | None) -> bool:
    cursor = conn.execute("UPDATE items SET stock = ? WHERE id = ?", (stock, item_id))
    return cursor.rowcount == 1


def take_stock(conn: sqlite3.Connection, lines: Iterable[PricedLine]) -> None:
    """Counts the order out of the stock of the items that are counted. Under the write
    lock, after pricing checked there is enough, so the CHECK never fires."""
    conn.executemany(
        "UPDATE items SET stock = stock - ? WHERE id = ? AND stock IS NOT NULL",
        [(line.qty, line.item_id) for line in lines],
    )


# Idempotency


class StoredReply(NamedTuple):
    request_hash: str
    status_code: int
    body: dict[str, Any]


def find_key(conn: sqlite3.Connection, key: str) -> StoredReply | None:
    row = conn.execute(
        "SELECT request_hash, status_code, response_body FROM idempotency_keys WHERE key = ?",
        (key,),
    ).fetchone()
    if row is None:
        return None
    return StoredReply(
        row["request_hash"], int(row["status_code"]), json.loads(row["response_body"])
    )


def save_key(
    conn: sqlite3.Connection, key: str, request_hash: str, status_code: int, body: dict[str, Any]
) -> None:
    conn.execute(
        "INSERT INTO idempotency_keys (key, request_hash, status_code, response_body, created_at)"
        " VALUES (?, ?, ?, ?, ?)",
        (key, request_hash, status_code, json.dumps(body), now_iso()),
    )


# Orders


def next_pickup_number(conn: sqlite3.Connection) -> str:
    """01, 02, ... per server day (UTC, the same clock as created_at)."""
    day = now().date().isoformat()
    seq = conn.execute(
        "INSERT INTO pickup_counter (day, last_seq) VALUES (?, 1)"
        " ON CONFLICT (day) DO UPDATE SET last_seq = last_seq + 1 RETURNING last_seq",
        (day,),
    ).fetchone()[0]
    return f"{seq:02d}"


def insert_order(
    conn: sqlite3.Connection, priced: PricedOrder, currency: str, pickup_number: str | None
) -> str:
    order_id = str(uuid.uuid4())
    conn.execute(
        "INSERT INTO orders (id, pickup_number, currency, subtotal_cents, tax_cents, total_cents,"
        " created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (
            order_id,
            pickup_number,
            currency,
            priced.subtotal_cents,
            priced.tax_cents,
            priced.total_cents,
            now_iso(),
        ),
    )
    conn.executemany(
        "INSERT INTO order_lines (order_id, position, item_id, name, unit_price_cents, qty,"
        " source) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
            (
                order_id,
                position,
                line.item_id,
                line.name,
                line.unit_price_cents,
                line.qty,
                line.source,
            )
            for position, line in enumerate(priced.lines)
        ],
    )
    return order_id


def insert_payment(
    conn: sqlite3.Connection,
    *,
    order_id: str | None,
    method: str,
    brand: str,
    last4: str,
    status: str,
    decline_code: str | None,
    amount_cents: int,
) -> None:
    conn.execute(
        "INSERT INTO payments (id, order_id, method, brand, last4, status, decline_code,"
        " amount_cents, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            str(uuid.uuid4()),
            order_id,
            method,
            brand,
            last4,
            status,
            decline_code,
            amount_cents,
            now_iso(),
        ),
    )


def get_order(conn: sqlite3.Connection, order_id: str) -> dict[str, Any] | None:
    row = conn.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
    if row is None:
        return None
    lines = conn.execute(
        "SELECT item_id, name, unit_price_cents, qty, source FROM order_lines"
        " WHERE order_id = ? ORDER BY position",
        (order_id,),
    ).fetchall()
    payment = conn.execute(
        "SELECT method, brand, last4 FROM payments WHERE order_id = ? AND status = 'approved'",
        (order_id,),
    ).fetchone()
    return {
        **dict(row),
        "lines": [dict(line) for line in lines],
        "payment": dict(payment) if payment else None,
    }
