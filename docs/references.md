# References

What shaped the choices, grouped by what each source informed. Nothing is quoted from them; the decisions they fed are in [decisions.md](decisions.md).

## The brief and the product

- Mashgin, "AI-powered self-service checkout eliminates the wait" (Intel Network Builders): https://builders.intel.com/docs/networkbuilders/ai-powered-self-service-checkout-eliminates-the-wait-1716806962.pdf
- Mashgin FAQ, how items are recognised: https://faq.mashgin.com/faq/how-mashgin-recognizes-items
- Mashgin FAQ, checkout speed and throughput: https://faq.mashgin.com/faq/checkout-speed-and-throughput
- Mashgin help, how customers ask for help on the kiosk: https://help.mashgin.com/kiosk/qSr8Mrx46DYbzViGbbDmXV/how-customers-ask-for-help-on-the-kiosk/7LhXiKYACBYreKp3txjRtW

## Idempotency and retries (decisions 4 and 5)

- Stripe, Idempotent requests: https://docs.stripe.com/api/idempotent_requests
- Stripe engineering, Designing robust and predictable APIs with idempotency: https://stripe.com/blog/idempotency
- Brandur Leach, Implementing Stripe-like idempotency keys in Postgres: https://brandur.org/idempotency-keys
- IETF draft, The Idempotency-Key HTTP header field: https://www.ietf.org/archive/id/draft-ietf-httpapi-idempotency-key-header-07.html
- RFC 9110, HTTP semantics, idempotent methods: https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2
- Marc Brooker, Exponential backoff and jitter: https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
- Marc Brooker, Will circuit breakers solve my problems?: https://brooker.co.za/blog/2022/02/16/circuit-breakers.html
- Google SRE book, Addressing cascading failures: https://sre.google/sre-book/addressing-cascading-failures/

## Money and pricing (decisions 3 and 6)

- Python tutorial, Floating-point arithmetic: https://docs.python.org/3/tutorial/floatingpoint.html
- Martin Fowler, Money (Patterns of Enterprise Application Architecture): https://martinfowler.com/eaaCatalog/money.html
- OWASP, Web parameter tampering: https://owasp.org/www-community/attacks/Web_Parameter_Tampering
- OWASP Web Security Testing Guide, business logic data validation: https://wstg.owasp.org/v4.2/4-Web_Application_Security_Testing/10-Business_Logic_Testing/01-Test_Business_Logic_Data_Validation
- OWASP Web Security Testing Guide, ability to forge requests: https://wstg.owasp.org/v4.2/4-Web_Application_Security_Testing/10-Business_Logic_Testing/02-Test_Ability_to_Forge_Requests
- MDN, Intl.NumberFormat: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/NumberFormat

## Payments (decision 5)

- Stripe, Testing, the test card numbers: https://docs.stripe.com/testing
- Stripe, Decline codes: https://docs.stripe.com/declines/codes
- Stripe, Errors, the 402: https://docs.stripe.com/api/errors
- Luhn algorithm: https://en.wikipedia.org/wiki/Luhn_algorithm
- PCI SSC FAQ, sensitive authentication data before authorisation: https://www.pcisecuritystandards.org/faq/articles/Frequently_Asked_Question/for-pci-dss-can-sensitive-account-data-be-stored-before-authorization/

## Data (decisions 1 and 2)

- SQLite, Appropriate uses for SQLite: https://www.sqlite.org/whentouse.html
- SQLite, Write-ahead logging: https://www.sqlite.org/wal.html
- SQLite, Transactions, including `BEGIN IMMEDIATE`: https://www.sqlite.org/lang_transaction.html
- SQLite, busy_timeout: https://www.sqlite.org/c3ref/busy_timeout.html
- SQLite, Atomic commit: https://www.sqlite.org/atomiccommit.html
- Python, the sqlite3 module: https://docs.python.org/3/library/sqlite3.html

## The API (decisions 1, 8 and 11)

- FastAPI, Bigger applications: https://fastapi.tiangolo.com/tutorial/bigger-applications/
- FastAPI, Handling errors: https://fastapi.tiangolo.com/tutorial/handling-errors/
- FastAPI, Testing: https://fastapi.tiangolo.com/tutorial/testing/
- FastAPI, Lifespan events: https://fastapi.tiangolo.com/advanced/events/
- Pydantic, Settings management: https://pydantic.dev/docs/validation/latest/concepts/pydantic_settings/
- OWASP cheat sheet, Input validation: https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
- OWASP cheat sheet, Logging: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
- OWASP cheat sheet, HTTP security response headers: https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html
- MDN, Content Security Policy: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP
- OWASP API Security, Unrestricted resource consumption: https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption
- The Twelve-Factor App, Config: https://12factor.net/config

## The client (decisions 7 and 10)

- TanStack Query docs: https://tanstack.com/query/latest
- TkDodo, Mastering mutations in React Query: https://tkdodo.eu/blog/mastering-mutations-in-react-query
- React, Choosing the state structure: https://react.dev/learn/choosing-the-state-structure
- React, You might not need an effect: https://react.dev/learn/you-might-not-need-an-effect
- Kent C. Dodds, Application state management with React: https://kentcdodds.com/blog/application-state-management-with-react
- MDN, AbortSignal.timeout(): https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static
- MDN, Window.sessionStorage: https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage
- MDN, the inputmode attribute: https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/inputmode
- MDN, the autocomplete attribute: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/autocomplete
- MDN, prefers-reduced-motion: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
- CSS Modules: https://github.com/css-modules/css-modules

## Kiosk experience and accessibility (decisions 10 and 13)

- Nielsen Norman Group, Touch target size: https://www.nngroup.com/articles/touch-target-size/
- Nielsen Norman Group, Response times, the 3 important limits: https://www.nngroup.com/articles/response-times-3-important-limits/
- Nielsen Norman Group, Progress indicators: https://www.nngroup.com/articles/progress-indicators/
- Nielsen Norman Group, Error message guidelines: https://www.nngroup.com/articles/error-message-guidelines/
- Baymard Institute, Handling out-of-stock products: https://baymard.com/blog/handling-out-of-stock-products
- WCAG 2.2, Timing adjustable (2.2.1): https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html
- WCAG 2.2, Target size minimum (2.5.8): https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- WCAG 2.2, Resize text (1.4.4): https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html
- WCAG 2.2, Contrast minimum (1.4.3): https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- Apple, UI design tips, 44 pt targets: https://developer.apple.com/design/tips/
- Android accessibility, touch target size, 48 dp: https://support.google.com/accessibility/android/answer/7101858
- Android, Lock task mode for dedicated devices: https://developer.android.com/work/dpc/dedicated-devices/lock-task-mode
- Kiosk Group, Idle time limit: https://support.kioskgroup.com/article/991-idle-time-limit
- Toast, Setting up your kiosk: https://support.toasttab.com/en/article/Setting-Up-Your-Kiosk
- FDA, Food allergies, the allergen list on every item: http://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/food-allergies

## Testing

- Kent C. Dodds, The testing trophy and testing classifications: https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications
- Testing Library, Guiding principles: https://testing-library.com/docs/guiding-principles/
- Mock Service Worker, Philosophy: https://mswjs.io/docs/philosophy
- Playwright, Actionability: https://playwright.dev/docs/actionability
- axe-core: https://github.com/dequelabs/axe-core

## Tooling and the container (decision 8)

- uv, Using uv in Docker: https://docs.astral.sh/uv/guides/integration/docker/
- uv, Project layout: https://docs.astral.sh/uv/concepts/projects/layout/
- Docker, Building best practices: https://docs.docker.com/build/building/best-practices/
- FastAPI, Deployment with Docker: https://fastapi.tiangolo.com/deployment/docker/
- Uvicorn, Deployment: https://uvicorn.dev/deployment/
- Ruff: https://docs.astral.sh/ruff/
- Vite, Why Vite: https://vite.dev/guide/why
- Vitest, Why Vitest: https://vitest.dev/guide/why

## Working method

- Michael Nygard, Documenting architecture decisions: https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions
- Martin Fowler, Yagni: https://martinfowler.com/bliki/Yagni.html
- Tom Preston-Werner, Readme driven development: https://tom.preston-werner.com/2010/08/23/readme-driven-development.html
- Claude Code, Best practices: https://code.claude.com/docs/en/best-practices
- Addy Osmani, The 70% problem: https://addyosmani.com/agentic-engineering/the-70-percent-problem/
- Simon Willison, Using LLMs for code: https://simonwillison.net/2025/Mar/11/using-llms-for-code/

## Photos and fonts

- Unsplash License: https://unsplash.com/license. The photographers are listed in [credits.md](credits.md).
- Pixelify Sans: https://fonts.google.com/specimen/Pixelify+Sans and Inter: https://rsms.me/inter/, both under the SIL Open Font License 1.1.
