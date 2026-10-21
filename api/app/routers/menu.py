from fastapi import APIRouter

from app.deps import MenuDep
from app.schemas import Menu

router = APIRouter()


@router.get("/menu", response_model=Menu)
def get_menu(menu: MenuDep) -> Menu:
    return menu
