# Iza & Bela snack bar checkout

A self-service checkout for a snack bar, made for a tablet on the counter. The customer scans or picks what they want, pays (simulated) and gets a pickup number. React client, Python API, SQLite, one container.

This page covers how to run it, what to try, and how it is put together. If you would like to understand how I took each decision, and what I considered instead, please see [docs/decisions.md](docs/decisions.md). The references I based those decisions on are in [docs/references.md](docs/references.md), how it was built in [docs/process.md](docs/process.md), and the photo and font credits in [docs/credits.md](docs/credits.md).

## Run it with Docker

You need Docker with Compose.

1. In the repository root:

   ```bash
   docker compose up --build --wait
   ```

   The first build takes a few minutes: it installs the Python and Node dependencies and builds the client. The command returns when the healthcheck passes.

2. Open http://localhost:8420.

3. When you are done, `docker compose down` stops the container and keeps the database. `docker compose down -v` also removes the database, so the next start seeds the menu again.

If port 8420 is busy on your machine, run `PORT=9000 docker compose up --build --wait` and open http://localhost:9000. `make up` and `make down` run the same commands.

## Run it without Docker

You need Python 3.12 or newer, Node 22.13 or newer, and [uv](https://docs.astral.sh/uv/).

1. `make install` installs both sides (`uv sync` in `api/`, `npm ci` in `web/`).
2. `make dev` starts the API on http://localhost:8420 and the Vite dev server on http://localhost:5180, which proxies `/api`. Open http://localhost:5180.
3. `make check` runs lint, types and both test suites, the same as CI.

The native API keeps its database in `api/data/snackbar.db`. Delete that file to start from the seed again.

## A tour of the screens

1. **Welcome.** Two ways in: scan your products, or browse the menu.
2. **Scan.** The camera is simulated, and the screen says so. Tap a product on the strip under the scanner and it is placed in front of the lens, recognised, and added to the order; no codes, because a scanner knows what it is looking at. Scanned items are already in your hands, so an order of scanned items ends with a receipt and no pickup number. A real recogniser would plug in at that point; everything after it is the same path the menu uses.
3. **Browse.** Photos, categories, and the allergens on every item. Sold-out items stay visible but cannot be tapped. The order panel keeps the running total on screen.
4. **Pay.** Tap the card on the reader (simulated, always approves), or pay with card. The keypad fills the fields, and a keyboard or a paste works too. Use any future expiry, such as 12/30, and a 3-digit security code (4 on American Express).

   | Card number | Result |
   |---|---|
   | 4242 4242 4242 4242 | approved, Visa |
   | 5555 5555 5555 4444 | approved, Mastercard |
   | 3782 822463 10005 | approved, American Express, 4-digit code |
   | 4000 0000 0000 0002 | declined |
   | 4000 0000 0000 9995 | insufficient funds |
   | 4000 0000 0000 0069 | expired card |
   | 4000 0000 0000 0127 | incorrect security code |
   | 4000 0000 0000 0119 | processing error |

   A number that fails the check digit, a past expiry or a code of the wrong length is refused on the screen, before anything is sent. Only the brand and the last four digits are ever stored.
5. **Pick up.** A pickup number when something has to be made at the counter (and, in a mixed order, which items to collect), or "You're all set" when everything was scanned. Either way, the receipt as the counter printer would print it, with the order code as a barcode. Back to the welcome screen after 15 seconds, or right away with Done.
6. **Walk away.** After 60 seconds without a tap, a warning appears with 20 seconds to answer. Then the order is cleared for the next person.

## Try the hard parts

Each one is reproducible from a second terminal. The commands below are for Docker; without Docker, replace `docker compose exec kiosk python` with `cd api && uv run python`.

1. **A price changes while someone is paying.** Put a Flat white in the cart and tap Pay. Then:

   ```bash
   docker compose exec kiosk python -m app.manage price flat-white 500
   ```

   Tap the card. The screen says the flat white is now $5.00, was $4.50, and asks you to confirm the new total. Confirm, and the order is placed at the new price. Put it back with `price flat-white 450`.

2. **An item sells out while someone is paying.** Put two items in the cart, tap Pay, then run `available flat-white off` the same way. Tap the card: the screen takes the flat white out of the order and asks you to confirm the rest. Put it back with `available flat-white on`.

3. **The register goes down mid-order.** Tap Pay, run `docker compose stop kiosk`, then tap the card. The client retries twice with backoff, then keeps the order on screen with a Try again button. Run `docker compose start kiosk` and tap Try again: one order, one charge.

4. **A declined card, then another.** Pay with card using 4000 0000 0000 0002. The decline is explained in plain words and the typed card is gone. Tap the card on the reader: approved.

5. **Reload at any point.** Press F5 on the menu or on the payment screen. The cart is still there; the card digits are not. If a request was out when you reloaded, Pay again replays that order instead of placing a second one.

6. **A double tap.** Tap the card twice, fast. One order.

## Changing prices and stock

The menu lives in the database. `data/menu.json` seeds it on the first start and is not read again. The counter changes prices, availability and stock with one command:

```bash
docker compose exec kiosk python -m app.manage price flat-white 500
docker compose exec kiosk python -m app.manage available blueberry-muffin on
docker compose exec kiosk python -m app.manage stock sparkling-water 12
```

Each command is a transaction on the same write lock the orders use. It waits for an order being placed, and an order never sees two prices. The client refreshes the menu every 30 seconds; an order placed against an old price gets the 409 described above.

Stock is optional per item. A counted item shows how many are left when it is about to run out, is sold out at zero, and is counted down inside the order's transaction, so two orders for the last unit cannot both succeed. An order asking for more than is left gets a 409 that keeps what there is. The seed counts one sparkling water: order it, then try again.

## How it holds up

| Situation | What happens |
|---|---|
| A double tap, or a retry after a timeout | Every order carries an `Idempotency-Key`. The same key gets the first answer back: one order, one charge. |
| A price, the tax, the availability or the stock changed since the screen was drawn | The server prices the order itself and compares, line by line and in total. Any difference is a 409 that the screen explains and asks to confirm; a line short on stock keeps what is left. |
| The API is down or slow | Two retries with backoff and the same key, then Try again with the order still on screen. |
| The card network does not answer | 503, nothing stored, the key stays free. The retry asks again; a real gateway would receive the same key as its idempotency key, so asking twice cannot charge twice. |
| The menu cannot be loaded | A full-screen message with a Retry button, and the page keeps probing on its own. |
| Card declined | 402 with the reason in plain words. The next attempt uses a new key. |
| Reload or pull-to-refresh | The cart and the order key live in sessionStorage. Card details never do. |

## The API

| Method | Path | |
|---|---|---|
| GET | `/api/menu` | Categories, items, prices in cents, availability, the tax rate. |
| POST | `/api/orders` | Lines (item id, quantity, where it came from: `scan` or `menu`, the unit price that was shown), the total that was shown, a payment, and an `Idempotency-Key` header. 201 with the order. 409 `menu_changed`, 402 `payment_declined`, 503 `payment_unavailable`, 409 `idempotency_key_reused`, 422 `validation_error`, 400 for a missing or malformed key, 413 for an oversized body. |
| GET | `/api/orders/{id}` | One order. |
| GET | `/api/health` | Liveness, used by the Docker healthcheck. |

Every error, an unexpected one included, has the shape `{ "error": { "code", "message", ... } }`. Interactive docs are at http://localhost:8420/api/docs.

## Why it is built this way

The short version. The reasoning, the alternatives and what would change each choice are in [docs/decisions.md](docs/decisions.md).

- FastAPI and the standard library's `sqlite3`, no ORM: one kiosk, one writer, a hundred lines of SQL.
- The menu is data in the database, read under the order's write lock, so a price cannot move while an order is being placed.
- The server prices every order; the client's prices and total are compared, never charged.
- An idempotency key per order, stored with the reply, kept on the client until the cart changes.
- Integer cents everywhere; tax in basis points, rounded once.
- A fake processor with Stripe's test numbers, and a 503 when it does not answer.
- React 19 with TanStack Query, one hook for the checkout, no router, no state library.
- One container, one origin, a healthcheck that makes `--wait` mean something.
- A simulated scanner that says it is simulated.
- Kiosk rules: 48 px targets, three taps for one item, an idle timer that warns before it clears.
- Every number has a reason: the 60 s idle timer, the retries and deadlines, the caps (decision 13).
- Security basics for a shop LAN.
- A playful 8-bit look, chosen because I like it and this is not a real product; for the public I would pick something quieter, and the tokens file is where that change lives.

## Security basics

- Every SQL statement is parameterised; the tables are STRICT with CHECK constraints, so a money column cannot hold a float or a negative.
- Every field, header and path parameter is bounded: patterns, ranges, a bounded `Idempotency-Key`, a 64 KB body limit.
- Card numbers and security codes are validated, used once, and never stored, logged or echoed.
- Responses carry `nosniff`, `X-Frame-Options: DENY`, a strict Content-Security-Policy, `Referrer-Policy: no-referrer`, a Permissions-Policy that denies the camera, and `Cache-Control: no-store` on the API.
- The container runs as a non-root user on a read-only filesystem, holds no secrets, and installs from the lockfiles. `npm audit` and `pip-audit` run in CI.

Not here, by design: TLS (it belongs on the proxy in front), a per-device token, and the processor's hosted fields for card entry. Decision 11 says why.

## Tests

```bash
make check    # lint, types, 83 API tests and 56 client tests, the same as CI
make e2e      # two Playwright scenarios with axe, against a running stack on 8420
```

- `api/tests`: pricing and rounding, orders, idempotency (20 identical requests at once), payments, a processor outage, menu changes from the counter (one of them while an order is in flight), stock counts (the last unit, two orders for it at once), the counter command, the security bounds and headers.
- `web/src`: the pure parts (cart, checkout, card entry, money) and the whole flow through the UI with the network mocked: happy path, double tap, retries, the 409 screen, declines, keyed cards, reload, idle.
- `web/e2e`: browse and tap to pay; scan, a declined card, then tap.

## Layout

```
api/     FastAPI app: routers/ (HTTP), services/ (orders, pricing, payments, menu), db/ (connection, schema.sql, repository), manage.py (the counter command), tests/
web/     Vite + React client: screens/, components/, hooks/ (cart, checkout, idle), lib/ (pure logic), api/ (fetch and queries), e2e/
data/    menu.json, the seed for the menu tables
docs/    decisions, references, process, credits
```

## What I left out

These were left out on purpose: each one adds complexity the brief does not ask for, and a take-home should stay readable. For a real product I would add them, and this is where each one goes:

| Left out | Where it would go |
|---|---|
| Real product recognition | the simulated scanner recognises the tapped product after a short pause and calls the same cart `add` the menu uses; a real recogniser would return item ids with confidences and call the same thing, with a confirm step for the doubtful ones |
| Product images in storage | today the 18 photos are static files in the client; a real menu puts them in object storage behind a CDN, with the URL in the item row, so the counter can change a photo without a build |
| Modifiers and combos | the `items` table and the seed shape, `pricing.py`, the cart line identity |
| Tips and promotions | `price_order` in `pricing.py`; the order panel |
| Kitchen or counter display | `GET /api/orders` with a cursor, the `status` column, polling first |
| Real payments | the `payments.py` Protocol; the processor's hosted fields in place of the keypad |
| Login, menu editing | an authenticated endpoint calling the same transactions the counter command uses today |
| A device token and TLS | one dependency in `deps.py` and a proxy in front; decision 11 |
| Metrics | time-to-pay and tap counts, with no personal data, to tune the timings in decision 13 from real use |
| Offline ordering | nothing; payment cannot be authorised offline, so the honest state is "cannot take orders" |
| Second language | the copy is inline today; an i18n library when the second language is real |
| A receipt printer | the screen already shows the receipt with the order code; the printer gets the same data, and a QR to a receipt URL avoids collecting an email on a kiosk |

If this became real, the order would be: the counter display, a store time zone for the pickup counter, metrics, the real processor, and Postgres behind the same repository functions when a second API host or a reporting job appears.

## How I worked, and AI

Claude Code and I worked together on this. I used it to research, with sources I then read, and to write part of the code and the tests. I set the structure of the files and folders on both sides (routers, services and a database package on the API; screens, components, hooks and pure logic in `lib/` on the client) and held the code to a few patterns: one error envelope, parameterised SQL behind repository functions, pure functions tested on their own, shared components instead of copies, bounded inputs, and no duplicated logic. Each decision in [docs/decisions.md](docs/decisions.md) has its reasons and the sources behind it, and [docs/process.md](docs/process.md) shows how the work went: the rules set before code, the way the tools were driven, and what I chose not to implement.

## Known gaps

- Portrait is untested; a counter tablet is landscape.
- The pickup counter resets per server day, in UTC.
- The scanner offers every product, and the server takes a line's source as sent, so a made-to-order item that is scanned gets no pickup number and nobody makes it. The fix is a flag on the item saying the counter prepares it: the server would derive the pickup number from the items, and the scanner would list only what can sit on the tray. Not implemented at this time.
- Card digits are visible while typing, and the kiosk talks to the API over plain HTTP on the LAN. A real deployment terminates TLS in front and uses the processor's hosted fields, so no card number reaches this API.

## Credits

Product photos are from Unsplash and the fonts are bundled from npm; the photographers and the font licences are listed in [docs/credits.md](docs/credits.md).
