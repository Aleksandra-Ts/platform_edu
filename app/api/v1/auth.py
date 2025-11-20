"""Роуты для аутентификации"""
from fastapi import APIRouter, Depends, Form, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.security import create_access_token, pwd_context, validate_password_strength
from app.core.database import get_db
from app.models import User
from app.schemas import ChangePasswordRequest

router = APIRouter()


@router.post("/login")
def login(
    request: Request,
    login: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db),
):
    """Вход в систему"""
    user = db.query(User).filter(User.login == login).first()
    if not user:
        raise HTTPException(status_code=401, detail="Неверный логин или пароль")

    if user.is_temporary and not user.is_password_changed:
        if user.temporary_password is None or password != user.temporary_password:
            raise HTTPException(status_code=401, detail="Неверный логин или пароль")
        return {"message": "Требуется смена пароля", "need_change": True, "user_id": user.id}

    if not user.password_hash or not pwd_context.verify(password, user.password_hash):
        raise HTTPException(status_code=401, detail="Неверный логин или пароль")

    token = create_access_token(data={"sub": user.id})
    return {"access_token": token, "token_type": "bearer", "user_id": user.id, "role": user.role}


@router.post("/change_password/{user_id}")
def change_password(
    user_id: int,
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
):
    """Смена временного пароля"""
    if payload.new_password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="Пароли не совпадают")
    validate_password_strength(payload.new_password)
    user = db.query(User).filter(User.id == user_id).first()
    if not user or user.is_password_changed:
        raise HTTPException(status_code=400, detail="Неверный пользователь или пароль уже изменен")
    
    user.password_hash = pwd_context.hash(payload.new_password)
    user.temporary_password = None
    user.is_password_changed = True
    user.is_temporary = False
    db.commit()
    return {"message": "Пароль успешно изменен"}

