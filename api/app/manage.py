"""Counter commands: change a price, mark an item sold out or back on sale, set its stock.

Each command is one transaction on the same database the orders use, so it waits for any
order that is being placed, and an order never sees two prices.

    python -m app.manage price flat-white 500
    python -m app.manage available blueberry-muffin on
    python -m app.manage stock sparkling-water 12
    python -m app.manage stock sparkling-water none   (stop counting it)
"""

import argparse
import sqlite3
import sys

from app.config import Settings
from app.db.connection import connect
from app.schemas import MAX_PRICE_CENTS
from app.services import menu


def stock_count(value: str) -> int | None:
    if value == "none":
        return None
    count = int(value)
    if count < 0:
        raise argparse.ArgumentTypeError("stock must be 0 or more, or none")
    return count


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m app.manage",
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    commands = parser.add_subparsers(dest="command", required=True)
    price = commands.add_parser("price", help="set an item's price, in cents")
    price.add_argument("item_id")
    price.add_argument("cents", type=int)
    available = commands.add_parser("available", help="mark an item on (for sale) or off")
    available.add_argument("item_id")
    available.add_argument("state", choices=["on", "off"])
    stock = commands.add_parser("stock", help="set how many are left, or none to stop counting")
    stock.add_argument("item_id")
    stock.add_argument("count", type=stock_count)
    args = parser.parse_args(argv)
    if args.command == "price" and not 0 <= args.cents <= MAX_PRICE_CENTS:
        parser.error(f"cents must be between 0 and {MAX_PRICE_CENTS}")

    db_path = Settings().db_path
    if not db_path.is_file():
        # connect() would create an empty database here, which is never what the counter means.
        print(f"no database at {db_path}; is SNACKBAR_DB_PATH the API's database?", file=sys.stderr)
        return 1

    conn = connect(db_path)
    try:
        if args.command == "price":
            menu.change_price(conn, args.item_id, args.cents)
            print(f"{args.item_id}: price set to {args.cents} cents")
        elif args.command == "available":
            menu.change_availability(conn, args.item_id, args.state == "on")
            print(f"{args.item_id}: {'for sale' if args.state == 'on' else 'sold out'}")
        else:
            menu.change_stock(conn, args.item_id, args.count)
            left = "not counted" if args.count is None else f"{args.count} left"
            print(f"{args.item_id}: {left}")
    except LookupError:
        print(f"no item with id {args.item_id!r}", file=sys.stderr)
        return 1
    except sqlite3.OperationalError as exc:
        # busy_timeout bounds the wait; past it, say so instead of skipping the change.
        print(f"could not change the menu ({exc}); try again in a moment", file=sys.stderr)
        return 1
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
