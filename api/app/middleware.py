from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse

from app.errors import error_body

MAX_BODY_BYTES = 64 * 1024  # an order with 50 lines is under 5 KB

# Swagger UI at /api/docs loads from a CDN and is left out of the policy.
CONTENT_SECURITY_POLICY = "; ".join(
    [
        "default-src 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        "style-src 'self'",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
    ]
)

CallNext = Callable[[Request], Awaitable[Response]]


def install_middleware(app: FastAPI) -> None:
    @app.middleware("http")
    async def limit_body(request: Request, call_next: CallNext) -> Response:
        # Checks Content-Length only; a chunked body is left to the handler.
        length = request.headers.get("content-length", "0")
        if length.isdigit() and int(length) > MAX_BODY_BYTES:
            body = error_body("payload_too_large", "That request is too large.")
            return JSONResponse(body, status_code=413)
        return await call_next(request)

    @app.middleware("http")
    async def security_headers(request: Request, call_next: CallNext) -> Response:
        response = await call_next(request)
        path = request.url.path
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        if not path.startswith("/api/docs"):
            response.headers["Content-Security-Policy"] = CONTENT_SECURITY_POLICY
        if path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        return response
