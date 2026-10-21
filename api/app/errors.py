import logging
from typing import Any, Self

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

log = logging.getLogger(__name__)


def error_body(code: str, message: str, **extra: Any) -> dict[str, Any]:
    """The one error shape every response uses: {"error": {"code", "message", ...}}."""
    return {"error": {"code": code, "message": message, **extra}}


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str, **extra: Any) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.extra = extra

    @classmethod
    def from_body(cls, status: int, body: dict[str, Any]) -> Self:
        """Rebuilds a stored reply, so a replayed decline is raised like a fresh one."""
        error = dict(body["error"])
        return cls(status, error.pop("code"), error.pop("message"), **error)

    def body(self) -> dict[str, Any]:
        return error_body(self.code, self.message, **self.extra)


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def api_error(_: Request, exc: ApiError) -> JSONResponse:
        return JSONResponse(exc.body(), status_code=exc.status)

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        # The default handler echoes the submitted value, which may be a card number.
        fields = [
            {
                "field": ".".join(str(part) for part in err["loc"] if part != "body"),
                "message": str(err["msg"]).removeprefix("Value error, "),
            }
            for err in exc.errors()
        ]
        message = "Something in the order did not look right."
        return JSONResponse(error_body("validation_error", message, fields=fields), status_code=422)

    @app.exception_handler(HTTPException)
    async def http_error(_: Request, exc: HTTPException) -> JSONResponse:
        body = error_body("http_error", str(exc.detail))
        return JSONResponse(body, status_code=exc.status_code, headers=exc.headers)

    @app.exception_handler(Exception)
    async def unexpected_error(request: Request, exc: Exception) -> JSONResponse:
        # Starlette re-raises after this, so the traceback still reaches the server log.
        log.error(
            "unhandled %s on %s %s (Idempotency-Key %s)",
            type(exc).__name__,
            request.method,
            request.url.path,
            request.headers.get("idempotency-key", "")[:128],
        )
        message = "Something went wrong on our side. Try again in a moment."
        return JSONResponse(error_body("internal_error", message), status_code=500)
