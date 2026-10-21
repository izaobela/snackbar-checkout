CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    position INTEGER NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL REFERENCES categories (id),
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price_cents INTEGER NOT NULL CHECK (price_cents BETWEEN 0 AND 1000000),
    tags TEXT NOT NULL DEFAULT '[]',
    allergens TEXT NOT NULL DEFAULT '[]',
    available INTEGER NOT NULL DEFAULT 1 CHECK (available IN (0, 1)),
    stock INTEGER CHECK (stock IS NULL OR stock >= 0),
    image TEXT,
    code TEXT UNIQUE,
    position INTEGER NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    pickup_number TEXT,
    status TEXT NOT NULL DEFAULT 'placed',
    currency TEXT NOT NULL,
    subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
    tax_cents INTEGER NOT NULL CHECK (tax_cents >= 0),
    total_cents INTEGER NOT NULL CHECK (total_cents = subtotal_cents + tax_cents),
    created_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS order_lines (
    order_id TEXT NOT NULL REFERENCES orders (id),
    position INTEGER NOT NULL,
    item_id TEXT NOT NULL,
    name TEXT NOT NULL,
    unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
    qty INTEGER NOT NULL CHECK (qty >= 1),
    source TEXT NOT NULL DEFAULT 'menu' CHECK (source IN ('scan', 'menu')),
    PRIMARY KEY (order_id, position)
) STRICT;

CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    order_id TEXT REFERENCES orders (id),
    method TEXT NOT NULL,
    brand TEXT NOT NULL,
    last4 TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('approved', 'declined')),
    decline_code TEXT,
    amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
    created_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS idempotency_keys (
    key TEXT PRIMARY KEY,
    request_hash TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    response_body TEXT NOT NULL,
    created_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS pickup_counter (
    day TEXT PRIMARY KEY,
    last_seq INTEGER NOT NULL
) STRICT;
