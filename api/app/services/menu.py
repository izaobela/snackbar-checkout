import json
import logging
import sqlite3
from pathlib import Path

from app.config import Settings
from app.db import repository
from app.db.connection import transaction
from app.schemas import Menu, MenuData

log = logging.getLogger(__name__)


def read_menu_file(path: Path) -> MenuData:
    return MenuData.model_validate(json.loads(path.read_text(encoding="utf-8")))


def seed_if_empty(conn: sqlite3.Connection, path: Path) -> None:
    """First start: the menu file goes into the database. After that the database is the menu."""
    with transaction(conn):
        if repository.count_items(conn):
            return
        if repository.count_categories(conn):
            raise RuntimeError("menu tables are half seeded; delete the database to seed again")
        repository.insert_menu(conn, read_menu_file(path))
    log.info("menu seeded from %s", path)


def current_menu(conn: sqlite3.Connection, settings: Settings) -> Menu:
    data = repository.load_menu(conn)
    return Menu(
        currency=settings.currency,
        tax_rate_bps=settings.tax_rate_bps,
        categories=data.categories,
        items=data.items,
    )


def change_price(conn: sqlite3.Connection, item_id: str, price_cents: int) -> None:
    """A transaction, like an order: whichever starts second waits for the first to commit."""
    with transaction(conn):
        if not repository.update_price(conn, item_id, price_cents):
            raise LookupError(item_id)


def change_availability(conn: sqlite3.Connection, item_id: str, available: bool) -> None:
    with transaction(conn):
        if not repository.update_available(conn, item_id, available):
            raise LookupError(item_id)


def change_stock(conn: sqlite3.Connection, item_id: str, stock: int | None) -> None:
    """How many are left; None stops counting the item."""
    with transaction(conn):
        if not repository.update_stock(conn, item_id, stock):
            raise LookupError(item_id)
