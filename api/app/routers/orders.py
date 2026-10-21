import re
from typing import Annotated, Any

from fastapi import APIRouter, Header, Response

from app.db import repository
from app.deps import DbDep, ProcessorDep, SettingsDep
from app.errors import ApiError
from app.schemas import OrderIn, OrderOut
from app.services import orders

router = APIRouter()

# A UUID fits.
KEY_PATTERN = re.compile(r"^[A-Za-z0-9._:-]{8,128}$")


@router.post("/orders", status_code=201, response_model=OrderOut)
def create_order(
    order: OrderIn,
    response: Response,
    conn: DbDep,
    settings: SettingsDep,
    processor: ProcessorDep,
    idempotency_key: Annotated[str | None, Header()] = None,
) -> dict[str, Any]:
    if not idempotency_key:
        raise ApiError(
            400,
            "idempotency_key_required",
            "Send an Idempotency-Key header so a retry cannot create a second order.",
        )
    if not KEY_PATTERN.fullmatch(idempotency_key):
        raise ApiError(
            400,
            "idempotency_key_invalid",
            "Idempotency-Key must be 8 to 128 letters, digits, dots, dashes or colons.",
        )
    created = orders.create_order(conn, settings, processor, order, idempotency_key)
    response.headers["Location"] = f"/api/orders/{created['id']}"
    return created


@router.get("/orders/{order_id}", response_model=OrderOut)
def get_order(order_id: str, conn: DbDep) -> dict[str, Any]:
    order = repository.get_order(conn, order_id)
    if order is None:
        raise ApiError(404, "not_found", "No such order.")
    return order
