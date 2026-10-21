from typing import Annotated, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.cards import cvc_length_for, detect_brand, digits_only, expiry_in_future, luhn_ok

MAX_PRICE_CENTS = 1_000_000

# Where a line came from: scanned items are in the person's hands, menu items get made.
Source = Literal["scan", "menu"]

# Unknown keys in the seed file are typos.
STRICT = ConfigDict(extra="forbid")


class Category(BaseModel):
    model_config = STRICT

    id: str
    name: str


class Item(BaseModel):
    model_config = STRICT

    id: str
    category: str
    name: str
    description: str = ""
    price_cents: int = Field(ge=0, le=MAX_PRICE_CENTS)
    tags: list[str] = []
    allergens: list[str] = []
    available: bool = True
    stock: int | None = Field(default=None, ge=0)  # None: not counted
    image: str | None = None
    code: str | None = None

    @model_validator(mode="after")
    def sold_out_when_none_left(self) -> Self:
        # A count of zero is sold out.
        if self.stock == 0:
            self.available = False
        return self


class MenuData(BaseModel):
    """The categories and items: what the seed file holds and the menu tables store."""

    model_config = STRICT

    categories: list[Category]
    items: list[Item]

    @model_validator(mode="after")
    def unique_ids(self) -> Self:
        ids = [item.id for item in self.items]
        if len(ids) != len(set(ids)):
            raise ValueError("duplicate item id in menu")
        codes = [item.code for item in self.items if item.code]
        if len(codes) != len(set(codes)):
            raise ValueError("duplicate product code in menu")
        categories = {c.id for c in self.categories}
        for item in self.items:
            if item.category not in categories:
                raise ValueError(f"item {item.id} has unknown category {item.category}")
        return self

    def item(self, item_id: str) -> Item | None:
        return next((item for item in self.items if item.id == item_id), None)


class Menu(MenuData):
    """What GET /api/menu returns: the data plus the deployment's currency and tax rate."""

    currency: str = Field(pattern=r"^[A-Z]{3}$")  # an ISO code, or the formatter throws
    tax_rate_bps: int


class LineIn(BaseModel):
    model_config = ConfigDict(extra="ignore")

    item_id: str = Field(pattern=r"^[a-z0-9-]{1,64}$")
    qty: int = Field(ge=1, le=20)
    # The price the customer saw; compared, never charged.
    unit_price_cents: int = Field(ge=0, le=MAX_PRICE_CENTS)
    source: Source = "menu"


class TapPayment(BaseModel):
    model_config = ConfigDict(extra="ignore")

    method: Literal["tap"]


class CardPayment(BaseModel):
    model_config = ConfigDict(extra="ignore")

    method: Literal["card"]
    number: str = Field(repr=False, max_length=32)  # digits with spaces or dashes
    exp_month: int = Field(ge=1, le=12, repr=False)
    exp_year: int = Field(ge=2000, le=2100, repr=False)
    cvc: str = Field(repr=False, max_length=8)

    @field_validator("number")
    @classmethod
    def check_number(cls, value: str) -> str:
        digits = digits_only(value)
        if not 13 <= len(digits) <= 19:
            raise ValueError("That card number looks too short or too long.")
        if not luhn_ok(digits):
            raise ValueError("That card number does not look right. Check the digits.")
        return digits

    @field_validator("cvc")
    @classmethod
    def check_cvc(cls, value: str) -> str:
        digits = digits_only(value)
        if not 3 <= len(digits) <= 4:
            raise ValueError("The security code is 3 digits, or 4 on an American Express card.")
        return digits

    @model_validator(mode="after")
    def check_card(self) -> Self:
        if not expiry_in_future(self.exp_month, self.exp_year):
            raise ValueError("That expiry date has passed.")
        if len(self.cvc) != cvc_length_for(detect_brand(self.number)):
            raise ValueError("The security code length does not match the card.")
        return self


Payment = Annotated[TapPayment | CardPayment, Field(discriminator="method")]


class OrderIn(BaseModel):
    model_config = ConfigDict(extra="ignore")

    lines: list[LineIn] = Field(min_length=1, max_length=50)
    payment: Payment
    # The total the screen showed. Optional, so the API can be driven by hand.
    expected_total_cents: int | None = Field(default=None, ge=0, le=1_000_000_000)

    @model_validator(mode="after")
    def no_duplicate_lines(self) -> Self:
        ids = [line.item_id for line in self.lines]
        if len(ids) != len(set(ids)):
            raise ValueError("An item appears twice. Combine it into one line.")
        return self


class OrderLine(BaseModel):
    item_id: str
    name: str
    unit_price_cents: int
    qty: int
    source: Source


class PaymentOut(BaseModel):
    method: str
    brand: str
    last4: str


class OrderOut(BaseModel):
    id: str
    pickup_number: str | None  # None when nothing has to be made at the counter
    status: str
    currency: str
    subtotal_cents: int
    tax_cents: int
    total_cents: int
    created_at: str
    lines: list[OrderLine]
    payment: PaymentOut
