"""Аутентификация и авторизация"""
import logging
import re
from datetime import datetime, timedelta

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jwt import PyJWTError
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.core.config import ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES, SECRET_KEY
from app.core.database import get_db
from app.models import User

logger = logging.getLogger(__name__)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")


def init_pwd_context() -> CryptContext:
    """Инициализация контекста для хеширования паролей"""
    try:
        ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
        ctx.hash("probe")
        return ctx
    except Exception as exc:
        logger.warning(
            "bcrypt backend unavailable (%s), falling back to pbkdf2_sha256", exc
        )
        return CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


pwd_context = init_pwd_context()


def create_access_token(data: dict, expires_delta: timedelta = None):
    """Генерация JWT-токена"""
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    if "sub" in to_encode and not isinstance(to_encode["sub"], str):
        to_encode["sub"] = str(to_encode["sub"])
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def validate_password_strength(password: str) -> None:
    """Валидация силы пароля"""
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Пароль должен быть не короче 8 символов")
    if not re.search(r"[A-Za-z]", password):
        raise HTTPException(status_code=400, detail="Пароль должен содержать латинские буквы")
    if not re.search(r"\d", password):
        raise HTTPException(status_code=400, detail="Пароль должен содержать цифры")
    if not re.search(r"[^\w\s]", password):
        raise HTTPException(status_code=400, detail="Пароль должен содержать специальный символ")
    if not password.isascii():
        raise HTTPException(status_code=400, detail="Пароль должен содержать только латинские символы")
    if re.search(r"\s", password):
        raise HTTPException(status_code=400, detail="Пароль не должен содержать пробелы")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    """Получение текущего пользователя из токена"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Не удалось проверить учетные данные")
        try:
            user_id_int = int(user_id)
        except (TypeError, ValueError):
            raise HTTPException(status_code=401, detail="Не удалось проверить учетные данные") from None
        user = db.query(User).filter(User.id == user_id_int).first()
        if user is None:
            raise HTTPException(status_code=401, detail="Пользователь не найден")
        return user

    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Срок действия токена истек")
    except PyJWTError:
        raise HTTPException(status_code=401, detail="Не удалось проверить учетные данные")


def require_admin(user: User = Depends(get_current_user)) -> User:
    """Проверка прав администратора"""
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Доступ запрещен")
    return user

