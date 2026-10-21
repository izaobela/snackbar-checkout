import sqlite3
from collections.abc import Iterator
from typing import Annotated

from fastapi import Depends, Request

from app.config import Settings
from app.db.connection import connect
from app.schemas import Menu
from app.services.menu import current_menu
from app.services.payments import PaymentProcessor


def get_settings(request: Request) -> Settings:
    settings: Settings = request.app.state.settings
    return settings


def get_db(request: Request) -> Iterator[sqlite3.Connection]:
    conn = connect(request.app.state.settings.db_path)
    try:
        yield conn
    finally:
        conn.close()


def get_processor(request: Request) -> PaymentProcessor:
    processor: PaymentProcessor = request.app.state.processor
    return processor


SettingsDep = Annotated[Settings, Depends(get_settings)]
DbDep = Annotated[sqlite3.Connection, Depends(get_db)]
ProcessorDep = Annotated[PaymentProcessor, Depends(get_processor)]


def get_menu(conn: DbDep, settings: SettingsDep) -> Menu:
    return current_menu(conn, settings)


MenuDep = Annotated[Menu, Depends(get_menu)]
