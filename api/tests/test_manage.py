import sqlite3
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import manage
from app.services import menu as menu_service


def test_price_and_availability_commands(
    client: TestClient,
    db_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setenv("SNACKBAR_DB_PATH", str(db_path))
    assert manage.main(["price", "flat-white", "500"]) == 0
    assert manage.main(["available", "flat-white", "off"]) == 0
    item = next(i for i in client.get("/api/menu").json()["items"] if i["id"] == "flat-white")
    assert (item["price_cents"], item["available"]) == (500, False)
    assert manage.main(["available", "flat-white", "on"]) == 0
    assert "flat-white: for sale" in capsys.readouterr().out


def test_an_unknown_item_is_an_error(
    client: TestClient,
    db_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setenv("SNACKBAR_DB_PATH", str(db_path))
    assert manage.main(["price", "ghost", "100"]) == 1
    assert "no item with id 'ghost'" in capsys.readouterr().err


def test_a_lock_held_too_long_is_reported_not_swallowed(
    client: TestClient,
    db_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    def locked(*_: object) -> None:
        raise sqlite3.OperationalError("database is locked")

    monkeypatch.setenv("SNACKBAR_DB_PATH", str(db_path))
    monkeypatch.setattr(menu_service, "change_price", locked)
    assert manage.main(["price", "flat-white", "500"]) == 1
    assert "try again in a moment" in capsys.readouterr().err


def test_a_price_outside_the_ceiling_is_refused(
    db_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("SNACKBAR_DB_PATH", str(db_path))
    for cents in ("-1", "1000001"):
        with pytest.raises(SystemExit):
            manage.main(["price", "flat-white", cents])


def test_a_missing_database_is_not_created(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    missing = tmp_path / "nowhere" / "snackbar.db"
    monkeypatch.setenv("SNACKBAR_DB_PATH", str(missing))
    assert manage.main(["price", "flat-white", "500"]) == 1
    assert "no database at" in capsys.readouterr().err
    assert not missing.exists()


def test_the_stock_command(
    client: TestClient,
    db_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setenv("SNACKBAR_DB_PATH", str(db_path))
    assert manage.main(["stock", "sparkling-water", "12"]) == 0
    water = next(i for i in client.get("/api/menu").json()["items"] if i["id"] == "sparkling-water")
    assert (water["stock"], water["available"]) == (12, True)
    assert manage.main(["stock", "sparkling-water", "none"]) == 0
    assert "not counted" in capsys.readouterr().out
    water = next(i for i in client.get("/api/menu").json()["items"] if i["id"] == "sparkling-water")
    assert water["stock"] is None
    with pytest.raises(SystemExit):
        manage.main(["stock", "sparkling-water", "-1"])
