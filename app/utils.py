"""Вспомогательные функции"""
from typing import Optional

from sqlalchemy.orm import Session

from app.core.security import pwd_context
from app.models import User
from app.schemas import UserResponse


def resolve_user_names(user: User) -> tuple[Optional[str], Optional[str], Optional[str]]:
    """Извлечение имени, фамилии и отчества из пользователя"""
    last = user.last_name
    first = user.first_name
    middle = user.middle_name
    if (not last or not first) and user.full_name:
        parts = user.full_name.split()
        if len(parts) >= 2:
            last = last or parts[0]
            first = first or parts[1]
            if len(parts) > 2:
                middle = middle or " ".join(parts[2:])
    return last, first, middle


def compose_full_name(last: Optional[str], first: Optional[str], middle: Optional[str]) -> str:
    """Составление полного имени из частей"""
    return " ".join(part for part in [last, first, middle] if part).strip()


def normalize_name(value: Optional[str]) -> Optional[str]:
    """Нормализация имени (удаление пробелов)"""
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


def build_user_response(user: User, group_name: Optional[str] = None) -> UserResponse:
    """Построение ответа с данными пользователя"""
    last_name, first_name, middle_name = resolve_user_names(user)
    full_name = compose_full_name(last_name, first_name, middle_name)
    return UserResponse(
        id=user.id,
        login=user.login,
        full_name=full_name,
        role=user.role,
        last_name=last_name,
        first_name=first_name,
        middle_name=middle_name,
        is_temporary=user.is_temporary,
        is_password_changed=user.is_password_changed,
        temporary_password=user.temporary_password,
        group_id=user.group_id,
        group_name=group_name,
    )


def create_default_admin(db: Session):
    """Создание администратора по умолчанию"""
    admin = db.query(User).filter(User.login == "admin").first()
    if not admin:
        full_name = compose_full_name("Admin", "Admin", None)
        admin = User(
            login="admin",
            password_hash=pwd_context.hash("admin"),
            temporary_password=None,
            full_name=full_name,
            last_name="Admin",
            first_name="Admin",
            middle_name=None,
            role="admin",
            is_temporary=False,
            is_password_changed=True
        )
        db.add(admin)
        db.commit()

