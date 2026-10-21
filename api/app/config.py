from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="SNACKBAR_", env_file=".env", extra="ignore")

    db_path: Path = Path("data/snackbar.db")
    menu_path: Path = Path("../data/menu.json")  # seeds the menu tables on the first start
    web_dist: Path = Path("../web/dist")
    currency: str = "USD"
    tax_rate_bps: int = 825
