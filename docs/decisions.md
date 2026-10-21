# Decisions

Thirteen choices that shape the code: why, what each one rests on, what I considered instead, and what would make me change it. The full list of sources is in [references.md](references.md).

## 1. FastAPI, the standard library's `sqlite3`, no ORM

**Why.** One kiosk, one writer, a few orders a minute. SQLite in WAL mode with a busy timeout handles that with room to spare, and a file on a volume is easier to run than a second container. The repository is about a hundred lines of SQL, which I would rather read than an ORM mapping for seven tables. The layout follows FastAPI's own guide for larger applications: routers, services, a database package.

**Based on.** SQLite, [Appropriate uses for SQLite](https://www.sqlite.org/whentouse.html) and [Write-ahead logging](https://www.sqlite.org/wal.html); FastAPI, [Bigger applications](https://fastapi.tiangolo.com/tutorial/bigger-applications/).

**Instead of.** Postgres in Compose (one more thing that can fail to start, for no gain here). SQLAlchemy (hides the transaction I want to reason about).

**Change it when** a second API host or a reporting job appears: Postgres behind the same repository functions.

## 2. The menu is data in the database, read under the order's lock

**Why.** Prices are money, so they live where the orders live. `data/menu.json` seeds the tables on the first start and is not read again. An order reads the menu inside its own write transaction, and a price or sold-out change from the counter command is a transaction on the same lock, so whichever starts second waits. An order never sees two prices, and a change never lands inside an order. Stock is an optional count per item: sold out at zero, counted down inside the order's transaction under the same lock, so two orders for the last unit cannot both succeed.

**Based on.** SQLite, [Transactions](https://www.sqlite.org/lang_transaction.html) (`BEGIN IMMEDIATE` takes the write lock up front) and [busy_timeout](https://www.sqlite.org/c3ref/busy_timeout.html) (the second writer waits instead of failing).

**Instead of.** A JSON file re-read on every edit (my first version; a file cannot promise any of that). An admin endpoint (there are no accounts yet, so a command on the box).

**Change it when** there is an admin: the same transactions behind an authenticated endpoint.

## 3. The server prices every order; the client sends what it showed

**Why.** A client-side total is a hidden form field waiting to be edited. The request carries each line's unit price and the total exactly as the screen showed them; the server charges its own price and compares. Any difference, a sold-out item included, is a 409 with the per-line changes and the new total, and the screen asks the person to confirm. A line short on stock is the third kind of change: the order keeps what is left, and the screen says so. Nothing is charged that was not on the screen.

**Based on.** OWASP, [Web parameter tampering](https://owasp.org/www-community/attacks/Web_Parameter_Tampering); OWASP Testing Guide, [business logic data validation](https://wstg.owasp.org/v4.2/4-Web_Application_Security_Testing/10-Business_Logic_Testing/01-Test_Business_Logic_Data_Validation) and [the ability to forge requests](https://wstg.owasp.org/v4.2/4-Web_Application_Security_Testing/10-Business_Logic_Testing/02-Test_Ability_to_Forge_Requests).

**Instead of.** Silent repricing (charges an amount nobody saw). A menu version hash (cannot say what changed after a restart).

**Change it when** the menu becomes a versioned pricebook: a version id per order is then the better audit trail.

## 4. An `Idempotency-Key` on every order

**Why.** A person taps twice, and venue Wi-Fi times out after the server committed. The client mints a key per cart and keeps it in sessionStorage next to the cart, so a retry, a Pay after a lost reply, and a reload all replay the same order. The server stores the key with a hash of the lines and the reply it gave: same lines, same answer, a decline included; different lines, 409. The tender is left out of the hash on purpose, so paying for an already placed order with another card replays it instead of charging it again. Lookup, charge and insert share one `BEGIN IMMEDIATE` transaction, so two identical requests at once serialise and the second replays the first.

**Based on.** Stripe, [Idempotent requests](https://docs.stripe.com/api/idempotent_requests) (the same key with the same parameters replays the stored reply; with different parameters it is an error) and [Designing robust and predictable APIs with idempotency](https://stripe.com/blog/idempotency); Brandur Leach, [Implementing Stripe-like idempotency keys in Postgres](https://brandur.org/idempotency-keys); the IETF draft for the [Idempotency-Key header](https://www.ietf.org/archive/id/draft-ietf-httpapi-idempotency-key-header-07.html); RFC 9110, [section 9.2.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2), POST is not idempotent on its own.

**Instead of.** A client order id with `INSERT OR IGNORE` (cannot replay the reply). Claiming the key, authorising outside the transaction, then completing (right with a remote processor; with an in-process fake, holding the lock across it is simpler).

**Change it when** the processor is real: claim, authorise outside the lock, complete, reclaim stale claims.

## 5. A fake processor that fails like a real one

**Why.** Payment need not be real; the failure paths must be. Tap approves. A keyed card passes Luhn, expiry and code checks, then Stripe's published test numbers decide, so every decline is reproducible by hand. When the processor does not answer at all, the order is a 503 with nothing stored and the key still free: the client retries, and a real gateway would receive that same key as its idempotency key. Only the brand and the last four digits are stored.

**Based on.** Stripe, [Testing](https://docs.stripe.com/testing) (the test card numbers), [Decline codes](https://docs.stripe.com/declines/codes) and [Errors](https://docs.stripe.com/api/errors) (the 402); the [Luhn algorithm](https://en.wikipedia.org/wiki/Luhn_algorithm); PCI SSC, [sensitive authentication data before authorisation](https://www.pcisecuritystandards.org/faq/articles/Frequently_Asked_Question/for-pci-dss-can-sensitive-account-data-be-stored-before-authorization/) (why the number and the code are never stored).

**Instead of.** Tap only (never exercises "enter payment"). Persisting declined orders (they would reach the kitchen).

**Change it when** a provider is chosen: the processor is a one-method Protocol, the keypad is where the provider's hosted fields mount, and a real tap carries the reader's authorisation instead of the word "tap".

## 6. Integer cents, tax rounded once

**Why.** `0.1 + 0.1 + 0.1` is not `0.3`. Prices are integer cents everywhere, the JSON included. Tax is basis points applied once to the subtotal and rounded half up; the only division by 100 is in the formatter. The client mirrors the rule for a running total that is never charged.

**Based on.** Python, [Floating-point arithmetic](https://docs.python.org/3/tutorial/floatingpoint.html); Martin Fowler, [Money](https://martinfowler.com/eaaCatalog/money.html) (amounts as integers in the smallest unit); MDN, [Intl.NumberFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/NumberFormat) (formatting is the one place a division happens, and it knows how many digits a currency has).

**Instead of.** `Decimal` (JSON cannot carry it). Per-line tax (one rate here, easy to add).

## 7. React 19 with TanStack Query, no router, no state library

**Why.** One URL, one screen at a time, two server resources. TanStack Query refreshes the menu, re-probes when it fails, and retries the order with the same variables, which is what keeps the key the same across retries. The checkout is one hook with a small state union, the cart a reducer, and the pure logic lives in `lib/` with its own tests.

**Based on.** [TanStack Query](https://tanstack.com/query/latest) and TkDodo, [Mastering mutations in React Query](https://tkdodo.eu/blog/mastering-mutations-in-react-query) (a retried mutation re-runs with the same variables); React, [Choosing the state structure](https://react.dev/learn/choosing-the-state-structure); Kent C. Dodds, [Application state management with React](https://kentcdodds.com/blog/application-state-management-with-react); MDN, [Window.sessionStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage) (dies with the tab, which is what a shared tablet needs).

**Instead of.** A hand-written fetch client with its own retry loop (my first version; more code for less). A router (Back would become a real navigation on a kiosk). Zustand or XState (six states, nothing to share).

**Change it when** a second page needs a URL, such as a counter view.

## 8. One container, one origin

**Why.** The API serves the built client: no CORS, one port, and `docker compose up --build --wait` is the whole setup, with a healthcheck that makes `--wait` mean something. The seed is baked into the image, the database lives on a volume, and the root filesystem is read-only.

**Based on.** FastAPI, [Deployment with Docker](https://fastapi.tiangolo.com/deployment/docker/); uv, [Using uv in Docker](https://docs.astral.sh/uv/guides/integration/docker/); Docker, [Building best practices](https://docs.docker.com/build/building/best-practices/); The Twelve-Factor App, [Config](https://12factor.net/config) (settings from the environment, nothing baked in but the seed).

**Instead of.** nginx in front (the production shape, and a second container to fail here). Two ports with CORS.

## 9. A simulated scanner that says so

**Why.** The product this brief comes from recognises what you put in front of it, so the welcome screen offers Scan next to Browse. Real recognition needs cameras and a model I do not have, so tapping a product on the strip under the scanner stands in for placing it in front of the lens, and the item lands in the order through the same `add` the menu uses. The screen says it is simulated. The products carry no codes on that screen: a scanner knows what it is looking at, and the person has the photo and the name. Each order line records where it came from, and an order made only of scanned items gets no pickup number and no call to the counter: the items are already in the person's hands. A mixed order gets a number for the part the counter makes and says which items those are.

**Based on.** Mashgin FAQ, [how items are recognised](https://faq.mashgin.com/faq/how-mashgin-recognizes-items): the real product recognises items by camera, which is what the screen pretends to do.

**Instead of.** The device camera reading QR codes (forces the reviewer to hold a phone up to a laptop). An in-browser image model (17 MB at runtime, and wrong often enough to undermine the demo).

**Change it when** there is a recogniser: it returns item ids with confidences, the screen confirms the doubtful ones, and calls the same `add`. Before that, a flag on the item saying the counter prepares it, so the server decides who needs a pickup number from the items rather than from the line's source, and the scanner lists only what can sit on the tray.

## 10. Kiosk behaviour

**Why.** The person is standing, alone and in a hurry: 48 px targets and 64 px for the ones that matter, 20 px body text, the total always visible, three taps for a one-item order. The card fields are real inputs filled by the on-screen keypad with the tablet's own keyboard suppressed, so a keyboard or a paste works on a laptop too, and the typed card is dropped after a decline. Sold-out items stay on the menu, visible and not tappable, so nobody wonders where the muffin went. Every item lists its allergens. The cart lives in sessionStorage, never localStorage. The timings, the idle timer included, are decision 13.

The confirmation shows the receipt the counter printer would print, with the order code as a Code 39 barcode drawn by forty lines of our own rather than a library loaded for one symbol.

**Based on.** WCAG 2.2, [Target size minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) (24 px is the floor; a kiosk needs more); Apple, [UI design tips](https://developer.apple.com/design/tips/) (44 pt); Android accessibility, [touch target size](https://support.google.com/accessibility/android/answer/7101858) (48 dp); Nielsen Norman Group, [Touch target size](https://www.nngroup.com/articles/touch-target-size/) and [Error message guidelines](https://www.nngroup.com/articles/error-message-guidelines/); MDN, [inputmode](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/inputmode) and [autocomplete](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/autocomplete); Baymard Institute, [Handling out-of-stock products](https://baymard.com/blog/handling-out-of-stock-products); FDA, [Food allergies](http://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/food-allergies).

**Instead of.** An attract screen, an "are you sure" on Pay, a tip screen (each one more tap for someone in a hurry).

## 11. Security basics for a shop LAN

**Why.** No accounts, and anyone on the LAN can reach the API, so it trusts nothing it receives: parameterised SQL, STRICT tables with CHECK constraints, bounded fields, key and body, card data in no store and no log, one error envelope for everything, and the standard response headers with a strict content security policy, because the client loads nothing from anywhere else. The page is denied the camera, since the scanner is simulated.

**Based on.** OWASP cheat sheets, [Input validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html), [Logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) (no card data in a log line) and [HTTP security response headers](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html) (nosniff, DENY, a Permissions-Policy, no-store, no Server header; the referrer policy here is stricter than its default, because the kiosk links nowhere); MDN, [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP); OWASP API Security, [Unrestricted resource consumption](https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption) (the body and key bounds); PCI SSC, [sensitive authentication data](https://www.pcisecuritystandards.org/faq/articles/Frequently_Asked_Question/for-pci-dss-can-sensitive-account-data-be-stored-before-authorization/).

**Instead of.** A per-device token (one dependency, the day there is an admin to issue it). TLS in the container (it belongs on the proxy in front). Rate limiting (one tablet).

**Change it when** there is more than one kiosk: a token per device, TLS at the edge, card fields with the processor.

## 12. The look: a pastel handheld console

**Why.** Because I like it, and because this is not a real product. A take-home is the one place where taste can lead: a snack bar can be playful where a bank cannot, and a simulated scanner may as well say so with a face. For a real counter, with the whole public standing in front of it, I would choose something quieter and more conventional, and the tokens file is where that change lives. Pastel blue and mint, square corners with a hard offset shadow that sinks when pressed, a pixel display face for titles and labels, and Inter for anything read at length and for every number: pixel digits are ambiguous (a 5 reads as an 8), so prices, totals, the keypad, card digits, codes and the pickup number never use it. The scanner is a little console that blinks, thinks and smiles; the product codes are its cartridges. All of it is tokens and CSS modules on the same components; no screen was duplicated for it.

**Based on.** Taste. The fonts and their licences are in [credits.md](credits.md).

**Instead of.** The terracotta counter look (warm and quiet, but a camera pretending to be a camera). A dark CRT screen (photos look wrong on it). A pixel font everywhere (unreadable at 17 px at arm's length; the first build had the prices in it, and I could not read them).

**Change it when** the brand has a real identity: the tokens file is the one place to change.

## 13. Timings and limits

**Why.** Every number in the app is a rule someone can ask about, so here they are with their reasons.

- **Idle: a warning after 60 s without a tap, 20 s to answer, then the order is cleared.** It runs on the scan and payment screens, and on the menu once something is in the cart. WCAG 2.2.1 asks that a time limit warn before it expires and give at least 20 seconds to extend it with a simple action, which is what the "Still there?" dialog does. The 60 s is a judgment: long enough to read a menu, short enough that the next person never meets a stranger's cart. Kiosk products expose the same limit as a setting.
- **Thank-you screen: 15 s, or Done.** Long enough to read a two-digit number, short enough for a queue. A judgment call.
- **Menu refresh: every 30 s, every 5 s while it cannot load, with a Retry button.** A price change reaches the screen within half a minute, and the 409 covers the window in between.
- **Request deadlines: 8 s for the menu, 15 s for an order; two retries on network and 5xx errors with backoff capped at 4 s; "Still working" after 5 s.** Retries carry the same key, so they cannot double-order. Backoff with a cap is the standard advice for a client retrying a struggling service; there is no jitter because one kiosk cannot stampede, and no circuit breaker because there is one dependency to break. The 5 s hint comes before the ten seconds at which attention is lost.
- **Caps: 20 of an item, 50 lines, a unit price up to 1,000,000 cents, an `Idempotency-Key` of 8 to 128 characters, a 64 KB body.** A snack bar order never comes near them; they exist so an unbounded request cannot cost memory or disk.
- **Tax: 8.25 percent, as 825 basis points, one rate.** A common US combined sales tax, applied once to the subtotal (decision 6).
- **Pickup numbers: 01, 02, and so on, per server day, only for orders with something the counter makes.** A two-digit number people can shout and hear. The day is UTC today; a store time zone is first among the next steps in the README.

**Based on.** WCAG 2.2, [Timing adjustable](https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html); Kiosk Group, [Idle time limit](https://support.kioskgroup.com/article/991-idle-time-limit) and Toast, [Setting up your kiosk](https://support.toasttab.com/en/article/Setting-Up-Your-Kiosk) (idle limits as a setting); Marc Brooker, [Exponential backoff and jitter](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/) and [Will circuit breakers solve my problems?](https://brooker.co.za/blog/2022/02/16/circuit-breakers.html); Nielsen Norman Group, [Response times, the 3 important limits](https://www.nngroup.com/articles/response-times-3-important-limits/); OWASP API Security, [Unrestricted resource consumption](https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption); MDN, [AbortSignal.timeout()](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static).

**Change it when** there is real use: time-to-pay and tap counts, with no personal data, would replace these judgments with measurements.
