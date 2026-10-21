import re
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

SCHEMA = Path(__file__).with_name("schema.sql")


def connect(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    # FastAPI may run a request's dependency and handler on different threads.
    conn = sqlite3.connect(path, autocommit=True, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=5000")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_schema(conn: sqlite3.Connection) -> None:
    schema = SCHEMA.read_text(encoding="utf-8")
    conn.executescript(schema)
    # Databases created before these columns existed are brought up to date here.
    if "stock" not in columns(conn, "items"):
        conn.execute(
            "ALTER TABLE items ADD COLUMN stock INTEGER CHECK (stock IS NULL OR stock >= 0)"
        )
    if "source" not in columns(conn, "order_lines"):
        conn.execute(
            "ALTER TABLE order_lines ADD COLUMN source TEXT NOT NULL DEFAULT 'menu'"
            " CHECK (source IN ('scan', 'menu'))"
        )
    if _required(conn, "orders", "pickup_number"):
        _rebuild(conn, "orders", schema)


def columns(conn: sqlite3.Connection, table: str) -> set[str]:
    return {str(row["name"]) for row in conn.execute(f"PRAGMA table_info({table})")}


def _required(conn: sqlite3.Connection, table: str, column: str) -> bool:
    for row in conn.execute(f"PRAGMA table_info({table})"):
        if row["name"] == column:
            return bool(row["notnull"])
    return False


def _rebuild(conn: sqlite3.Connection, table: str, schema: str) -> None:
    """SQLite cannot relax NOT NULL in place: copy the rows into the table as schema.sql has it."""
    match = re.search(rf"CREATE TABLE IF NOT EXISTS {table} \((.*?)\) STRICT;", schema, re.S)
    if match is None:
        raise RuntimeError(f"schema.sql has no table {table}")
    names = ", ".join(sorted(columns(conn, table)))
    conn.execute("PRAGMA foreign_keys=OFF")  # the drop would otherwise cascade into order_lines
    try:
        conn.executescript(
            f"BEGIN;"
            f" CREATE TABLE {table}_next ({match.group(1)}) STRICT;"
            f" INSERT INTO {table}_next ({names}) SELECT {names} FROM {table};"
            f" DROP TABLE {table};"
            f" ALTER TABLE {table}_next RENAME TO {table};"
            f" COMMIT;"
        )
    finally:
        conn.execute("PRAGMA foreign_keys=ON")


@contextmanager
def transaction(conn: sqlite3.Connection) -> Iterator[sqlite3.Connection]:
    """Write transaction that takes the lock up front: a second writer waits (up to
    busy_timeout, 5 s) instead of failing halfway through."""
    conn.execute("BEGIN IMMEDIATE")
    try:
        yield conn
    except BaseException:
        conn.execute("ROLLBACK")
        raise
    conn.execute("COMMIT")
