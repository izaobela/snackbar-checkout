# How this was built

## Before any code

I read the brief twice and wrote down the person it is for: standing at a counter, alone, in a hurry, and about to do something nobody planned for. That gave me rules that every later choice had to pass:

1. A one-item order is three taps: the item, Pay, the card.
2. The server owns the money: prices, tax, the total, and whether the order exists at all.
3. Every way the network or the person can misbehave gets one designed state with plain words on it. Never a spinner that never ends, never an error code on the screen.
4. It runs with one command on a machine that has never seen it.
5. It stays inside the brief. Anything beyond it needs a reason written down.

## The way of working

- **Research first:** separate passes on kiosk UX, idempotency and retry patterns, SQLite settings, kiosk accessibility, and what real self-checkout products do. I read the sources myself; the ones that shaped a choice are in [references.md](references.md), attached to the decision they fed.
- **Decisions before code:** each one in [decisions.md](decisions.md) with the alternative I considered and what would make me change it. The code had to follow the document, not the other way round.
- **Structure before drafts:** the folders on both sides (routers, services and a database package on the API; screens, components, hooks and pure logic in `lib/` on the client) and the patterns the code had to keep: one error envelope, parameterised SQL behind repository functions, pure functions tested on their own, shared components instead of copies, bounded inputs, no duplicated logic.
- **Drafts one area at a time:** Claude Code drafted modules and tests from the decisions, one area per pass. I read every draft and reworked what did not hold. The first draft of the order handler, for instance, replayed a stored decline through the success response model, which would have been a 500 on the second tap of a declined card; a test caught it before the first commit.
- **Review with a fresh context:** after the drafts, review passes over the whole repository with no memory of writing it, and then three narrow ones with reviewers told to refute each other's findings: backend structure and money handling, the failure path of an order, the security basics, and a last one on the transaction semantics after the menu moved into the database. Every finding was checked against the code before anything changed, and every fix came with a test. They caught a retry button that resubmitted a tap when the person had typed a card, a key reused after a 409, a background menu refresh that would have repriced the payment screen silently, a reload that would have placed a second order, a key minted with a browser API that does not exist over plain HTTP on a LAN, and a tax change that slipped through as a 201.
- **Proof:** each change was run in a browser against the real API before it was kept, the two Playwright scenarios run against the built stack, and CI builds the container and drives the counter command inside it, which is the one thing my own machine could not do.
- **A map of the questions:** alongside the code I kept a private map of the questions this project can raise, from "what if the person taps twice" to "how does a price change reach five thousand kiosks", each with where the answer lives in the code. Writing it found gaps before anyone could ask.

## What I chose not to implement at this time

Each of these would add code the brief does not ask for. I preferred the simpler thing, and wrote down where the fuller one would go:

- A paused mode that probes the health endpoint after repeated failures and disables everything that could send. Instead: two retries and an inline Try again, the same safety in far less code.
- A help button with its endpoint, fault-injection endpoints and a demo drawer in the production order path, request ids and JSON logging, a stale-claim reclaim and periodic pruning in the idempotency store. Right for a fleet, noise for one kiosk.
- A menu version history so the server could diff old and new prices. Instead: the client sends the price it showed, which is simpler and survives a restart.
- A state-machine library with a transition table and a generated diagram, a strings map for one language, a hand-written retry client. Instead: one hook, inline copy, and TanStack Query.
- One decision record per choice, with a journal and a changelog. Instead: one decisions page.
- The menu as a JSON file the API re-reads on every edit. Instead: tables in the database, read under the order's lock, because a file cannot promise that a price will not move during an order (decision 2).
- A real camera reading QR codes. Instead: a simulated scanner that says so (decision 9).

The security headers and the body-size cap are in because the threat model asked for them (decision 11).

## What changed because of a question

Questions against the running app changed the code, each one answered in the same commit: a client should never be able to choose its price, so the menu moved under the orders' lock; I could not type or paste into the card fields on a laptop, so they became real inputs; a kiosk should know its stock, so the last unit cannot be sold twice; the camera already knows the product, so the codes left the scanner; the receipt the counter would print belongs on the confirmation screen. The commit is one because each of these is part of the same answer, not a patch on top of it.
