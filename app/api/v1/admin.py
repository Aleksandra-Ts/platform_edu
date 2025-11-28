"""Роуты для админ-панели"""
import io
import logging
from datetime import datetime
from typing import List, Optional
from urllib.parse import quote

import xlsxwriter
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_

from app.core.security import require_admin
from app.core.database import get_db
from app.models import Course, Group, User, course_groups
from app.core.security import pwd_context
from app.schemas import (
    CreateCourseRequest,
    CreateUserRequest,
    CourseResponse,
    GroupCreateRequest,
    GroupResponse,
    SetTemporaryPasswordRequest,
    UpdateCourseRequest,
    UpdateUserGroupRequest,
    UserResponse,
)
from app.utils import (
    build_user_response,
    compose_full_name,
    normalize_name,
    resolve_user_names,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/admin/users", response_model=List[UserResponse])
def list_users(
    skip: int = Query(0, ge=0, description="Количество записей для пропуска"),
    limit: int = Query(100, ge=1, le=500, description="Максимальное количество записей"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Получение списка всех пользователей с пагинацией"""
    # Получаем пользователей с пагинацией
    users = db.query(User).order_by(User.id).offset(skip).limit(limit).all()
    
    group_ids = {user.group_id for user in users if user.group_id is not None}
    groups_map = {}
    if group_ids:
        groups = db.query(Group).filter(Group.id.in_(group_ids)).all()
        groups_map = {group.id: group.name for group in groups}
    
    result = [
        build_user_response(user, groups_map.get(user.group_id))
        for user in users
    ]
    
    # Возвращаем результат (можно добавить метаданные в заголовки или в ответ)
    return result


@router.post("/admin/create_user")
def create_user(
    payload: CreateUserRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Создание нового пользователя"""
    login = payload.login
    if db.query(User).filter(User.login == login).first():
        raise HTTPException(status_code=400, detail="Пользователь с таким логином уже существует")

    last_name = normalize_name(payload.last_name)
    first_name = normalize_name(payload.first_name)
    middle_name = normalize_name(payload.middle_name)

    if not last_name or not first_name:
        raise HTTPException(status_code=400, detail="Имя и фамилия обязательны")

    group = None
    if payload.group_id is not None:
        group = db.query(Group).filter(Group.id == payload.group_id).first()
        if not group:
            raise HTTPException(status_code=400, detail="Указанная группа не найдена")
    if payload.role == "student" and group is None:
        raise HTTPException(status_code=400, detail="Группа обязательна для студентов")

    temp_password = payload.password.strip()
    if not temp_password:
        raise HTTPException(status_code=400, detail="Временный пароль не может быть пустым")

    user = User(
        login=payload.login,
        password_hash=None,
        temporary_password=temp_password,
        full_name=compose_full_name(last_name, first_name, middle_name),
        last_name=last_name,
        first_name=first_name,
        middle_name=middle_name,
        role=payload.role,
        group_id=group.id if group else None,
        is_temporary=True,
        is_password_changed=False
    )
    db.add(user)
    db.commit()
    return {
        "message": "Пользователь успешно создан",
        "user_id": user.id,
        "temporary_password": temp_password,
        "group_id": user.group_id,
    }


@router.put("/admin/users/{user_id}/group", response_model=UserResponse)
def update_user_group(
    user_id: int,
    payload: UpdateUserGroupRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Изменение группы студента"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    if user.role != "student":
        raise HTTPException(status_code=400, detail="Можно изменять группу только для студентов")
    
    if payload.group_id is not None:
        group = db.query(Group).filter(Group.id == payload.group_id).first()
        if not group:
            raise HTTPException(status_code=404, detail="Группа не найдена")
        user.group_id = payload.group_id
    else:
        user.group_id = None
    
    db.commit()
    db.refresh(user)
    
    group_name = None
    if user.group_id:
        group = db.query(Group).filter(Group.id == user.group_id).first()
        group_name = group.name if group else None
    
    return build_user_response(user, group_name)


@router.post("/admin/users/{user_id}/set_temporary_password")
def set_temporary_password(
    user_id: int,
    payload: SetTemporaryPasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Установка временного пароля для пользователя"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    # Генерируем пароль, если не указан
    if payload.password:
        temp_password = payload.password
    else:
        import random
        import string
        length = 12
        charset = string.ascii_letters + string.digits + '!@#$%^&*'
        temp_password = ''.join(random.choice(charset) for _ in range(length))
        # Убеждаемся, что пароль содержит разные типы символов
        if not any(c.isupper() for c in temp_password):
            temp_password = temp_password[:-1] + random.choice(string.ascii_uppercase)
        if not any(c.islower() for c in temp_password):
            temp_password = temp_password[:-1] + random.choice(string.ascii_lowercase)
        if not any(c.isdigit() for c in temp_password):
            temp_password = temp_password[:-1] + random.choice(string.digits)
        if not any(c in '!@#$%^&*' for c in temp_password):
            temp_password = temp_password[:-1] + random.choice('!@#$%^&*')
        # Перемешиваем
        temp_password = ''.join(random.sample(temp_password, len(temp_password)))
    
    user.temporary_password = temp_password
    user.is_temporary = True
    user.is_password_changed = False
    # Не меняем password_hash, чтобы пользователь мог войти со старым паролем до смены
    db.commit()
    db.refresh(user)
    
    group_name = None
    if user.group_id:
        group = db.query(Group).filter(Group.id == user.group_id).first()
        group_name = group.name if group else None
    
    user_response = build_user_response(user, group_name)
    # Возвращаем временный пароль в ответе
    return {
        **user_response.dict(),
        "temporary_password": temp_password
    }


@router.delete("/admin/delete_user/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Удаление пользователя"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    db.delete(user)
    db.commit()
    return {"message": "Пользователь успешно удален"}


@router.get("/admin/groups", response_model=List[GroupResponse])
def list_groups(
    skip: int = Query(0, ge=0, description="Количество записей для пропуска"),
    limit: int = Query(100, ge=1, le=500, description="Максимальное количество записей"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Получение списка всех групп с пагинацией"""
    groups = db.query(Group).order_by(Group.name).offset(skip).limit(limit).all()
    return [GroupResponse(id=group.id, name=group.name) for group in groups]


@router.post("/admin/groups", response_model=GroupResponse)
def create_group(
    payload: GroupCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Создание новой группы"""
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Название группы не может быть пустым")
    if db.query(Group).filter(Group.name == name).first():
        raise HTTPException(status_code=400, detail="Группа с таким названием уже существует")
    group = Group(name=name)
    db.add(group)
    db.commit()
    db.refresh(group)
    return GroupResponse(id=group.id, name=group.name)


@router.delete("/admin/groups/{group_id}")
def delete_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Удаление группы"""
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Группа не найдена")
    linked_user = db.query(User).filter(User.group_id == group_id).first()
    if linked_user:
        raise HTTPException(status_code=400, detail="Нельзя удалить группу, в которой есть пользователи")
    db.delete(group)
    db.commit()
    return {"message": "Группа удалена"}


@router.get("/admin/groups/{group_id}/users", response_model=List[UserResponse])
def list_group_users(
    group_id: int,
    skip: int = Query(0, ge=0, description="Количество записей для пропуска"),
    limit: int = Query(100, ge=1, le=500, description="Максимальное количество записей"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Получение списка пользователей группы с пагинацией"""
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Группа не найдена")
    users = (
        db.query(User)
        .filter(User.group_id == group_id)
        .order_by(User.last_name, User.first_name, User.id)
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [build_user_response(user, group.name) for user in users]


@router.get("/admin/courses", response_model=List[CourseResponse])
def list_courses(
    skip: int = Query(0, ge=0, description="Количество записей для пропуска"),
    limit: int = Query(100, ge=1, le=500, description="Максимальное количество записей"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Получение списка всех курсов с пагинацией"""
    # Используем joinedload для предзагрузки groups и teachers (избегаем N+1)
    from sqlalchemy.orm import joinedload
    courses = db.query(Course).options(
        joinedload(Course.groups),
        joinedload(Course.teachers)
    ).order_by(Course.name).offset(skip).limit(limit).all()
    
    result = []
    for course in courses:
        # Теперь groups и teachers уже загружены, нет дополнительных запросов
        group_ids = [g.id for g in course.groups]
        group_names = [g.name for g in course.groups]
        teacher_ids = [t.id for t in course.teachers]
        teacher_names = [t.full_name or t.login for t in course.teachers]
        result.append(CourseResponse(
            id=course.id,
            name=course.name,
            description=course.description,
            group_ids=group_ids,
            group_names=group_names,
            teacher_ids=teacher_ids,
            teacher_names=teacher_names
        ))
    return result


@router.post("/admin/courses", response_model=CourseResponse)
def create_course(
    payload: CreateCourseRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Создание нового курса"""
    # Проверяем группы
    groups = []
    if payload.group_ids:
        groups = db.query(Group).filter(Group.id.in_(payload.group_ids)).all()
        if len(groups) != len(payload.group_ids):
            raise HTTPException(status_code=400, detail="Одна или несколько групп не найдены")
        
        # Проверяем, что у выбранных групп нет курса с таким же названием (с предзагрузкой groups)
        conflicting_courses = db.query(Course).options(
            joinedload(Course.groups)
        ).join(
            course_groups, Course.id == course_groups.c.course_id
        ).filter(
            and_(
                Course.name == payload.name,
                course_groups.c.group_id.in_(payload.group_ids)
            )
        ).all()
        
        if conflicting_courses:
            conflicting_group_names = []
            for course in conflicting_courses:
                # groups уже загружены, нет дополнительных запросов
                course_group_ids = [g.id for g in course.groups]
                overlapping_groups = [g.name for g in groups if g.id in course_group_ids]
                conflicting_group_names.extend(overlapping_groups)
            conflicting_group_names = list(set(conflicting_group_names))
            raise HTTPException(
                status_code=400,
                detail=f"Курс с названием '{payload.name}' уже существует для групп: {', '.join(conflicting_group_names)}"
            )
    
    # Проверяем преподавателей
    teachers = []
    if payload.teacher_ids:
        teachers = db.query(User).filter(
            User.id.in_(payload.teacher_ids),
            User.role == 'teacher'
        ).all()
        if len(teachers) != len(payload.teacher_ids):
            raise HTTPException(status_code=400, detail="Один или несколько преподавателей не найдены или не являются преподавателями")
    
    try:
        course = Course(
            name=payload.name,
            description=payload.description
        )
        course.groups = groups
        course.teachers = teachers
        
        db.add(course)
        db.commit()
        # Перезагружаем курс с предзагрузкой для получения обновленных данных
        course = db.query(Course).options(
            joinedload(Course.groups),
            joinedload(Course.teachers)
        ).filter(Course.id == course.id).first()
    except Exception as e:
        db.rollback()
        logger.error(f"Ошибка при создании курса: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Ошибка при создании курса")
    
    # Теперь groups и teachers уже загружены, нет дополнительных запросов
    group_ids = [g.id for g in course.groups]
    group_names = [g.name for g in course.groups]
    teacher_ids = [t.id for t in course.teachers]
    teacher_names = [t.full_name or t.login for t in course.teachers]
    
    return CourseResponse(
        id=course.id,
        name=course.name,
        description=course.description,
        group_ids=group_ids,
        group_names=group_names,
        teacher_ids=teacher_ids,
        teacher_names=teacher_names
    )


@router.get("/admin/courses/{course_id}", response_model=CourseResponse)
def get_course(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Получение курса по ID"""
    # Получаем курс с предзагрузкой groups и teachers (избегаем N+1)
    course = db.query(Course).options(
        joinedload(Course.groups),
        joinedload(Course.teachers)
    ).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    
    # Теперь groups и teachers уже загружены, нет дополнительных запросов
    group_ids = [g.id for g in course.groups]
    group_names = [g.name for g in course.groups]
    teacher_ids = [t.id for t in course.teachers]
    teacher_names = [t.full_name or t.login for t in course.teachers]
    
    return CourseResponse(
        id=course.id,
        name=course.name,
        description=course.description,
        group_ids=group_ids,
        group_names=group_names,
        teacher_ids=teacher_ids,
        teacher_names=teacher_names
    )


@router.put("/admin/courses/{course_id}", response_model=CourseResponse)
def update_course(
    course_id: int,
    payload: UpdateCourseRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Обновление курса"""
    # Получаем курс с предзагрузкой groups и teachers (избегаем N+1)
    course = db.query(Course).options(
        joinedload(Course.groups),
        joinedload(Course.teachers)
    ).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    
    # Определяем название курса и группы для проверки
    course_name = payload.name if payload.name is not None else course.name
    groups_to_check = []
    
    # Обновляем группы, если указаны
    if payload.group_ids is not None:
        groups = []
        if payload.group_ids:
            groups = db.query(Group).filter(Group.id.in_(payload.group_ids)).all()
            if len(groups) != len(payload.group_ids):
                raise HTTPException(status_code=400, detail="Одна или несколько групп не найдены")
            
            # Проверяем, что у выбранных групп нет другого курса с таким же названием (с предзагрузкой groups)
            conflicting_courses = db.query(Course).options(
                joinedload(Course.groups)
            ).join(
                course_groups, Course.id == course_groups.c.course_id
            ).filter(
                and_(
                    Course.id != course_id,  # Исключаем текущий курс
                    Course.name == course_name,
                    course_groups.c.group_id.in_(payload.group_ids)
                )
            ).all()
            
            if conflicting_courses:
                conflicting_group_names = []
                for conflicting_course in conflicting_courses:
                    # groups уже загружены, нет дополнительных запросов
                    conflicting_course_group_ids = [g.id for g in conflicting_course.groups]
                    overlapping_groups = [g.name for g in groups if g.id in conflicting_course_group_ids]
                    conflicting_group_names.extend(overlapping_groups)
                conflicting_group_names = list(set(conflicting_group_names))
                raise HTTPException(
                    status_code=400,
                    detail=f"Курс с названием '{course_name}' уже существует для групп: {', '.join(conflicting_group_names)}"
                )
        course.groups = groups
        groups_to_check = groups
    else:
        # Если группы не обновляются, проверяем текущие группы (уже загружены)
        groups_to_check = course.groups
    
            # Если изменяется только название, проверяем текущие группы
    if payload.name is not None and payload.group_ids is None:
        if groups_to_check:
            group_ids_to_check = [g.id for g in groups_to_check]
            # С предзагрузкой groups для избежания N+1
            conflicting_courses = db.query(Course).options(
                joinedload(Course.groups)
            ).join(
                course_groups, Course.id == course_groups.c.course_id
            ).filter(
                and_(
                    Course.id != course_id,
                    Course.name == payload.name,
                    course_groups.c.group_id.in_(group_ids_to_check)
                )
            ).all()
            
            if conflicting_courses:
                conflicting_group_names = []
                for conflicting_course in conflicting_courses:
                    # groups уже загружены, нет дополнительных запросов
                    conflicting_course_group_ids = [g.id for g in conflicting_course.groups]
                    overlapping_groups = [g.name for g in groups_to_check if g.id in conflicting_course_group_ids]
                    conflicting_group_names.extend(overlapping_groups)
                conflicting_group_names = list(set(conflicting_group_names))
                raise HTTPException(
                    status_code=400,
                    detail=f"Курс с названием '{payload.name}' уже существует для групп: {', '.join(conflicting_group_names)}"
                )
    
    try:
        if payload.name is not None:
            course.name = payload.name
        if payload.description is not None:
            course.description = payload.description
        
        # Обновляем преподавателей, если указаны
        if payload.teacher_ids is not None:
            teachers = []
            if payload.teacher_ids:
                teachers = db.query(User).filter(
                    User.id.in_(payload.teacher_ids),
                    User.role == 'teacher'
                ).all()
                if len(teachers) != len(payload.teacher_ids):
                    raise HTTPException(status_code=400, detail="Один или несколько преподавателей не найдены или не являются преподавателями")
            course.teachers = teachers
        
        db.commit()
        # Перезагружаем курс с предзагрузкой для получения обновленных данных
        course = db.query(Course).options(
            joinedload(Course.groups),
            joinedload(Course.teachers)
        ).filter(Course.id == course_id).first()
    except HTTPException:
        # Перебрасываем HTTPException без rollback
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Ошибка при обновлении курса {course_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Ошибка при обновлении курса")
    
    # Теперь groups и teachers уже загружены, нет дополнительных запросов
    group_ids = [g.id for g in course.groups]
    group_names = [g.name for g in course.groups]
    teacher_ids = [t.id for t in course.teachers]
    teacher_names = [t.full_name or t.login for t in course.teachers]
    
    return CourseResponse(
        id=course.id,
        name=course.name,
        description=course.description,
        group_ids=group_ids,
        group_names=group_names,
        teacher_ids=teacher_ids,
        teacher_names=teacher_names
    )


@router.delete("/admin/courses/{course_id}")
def delete_course(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Удаление курса"""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    db.delete(course)
    db.commit()
    return {"message": "Курс успешно удален"}


@router.get("/admin/export_users")
def export_users(
    role: Optional[str] = Query(None, description="Фильтр по роли: teacher или student"),
    group_id: Optional[int] = Query(None, description="Фильтр по группе (только для студентов)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Выгрузка пользователей с временными паролями в Excel"""
    # Логирование для отладки
    logger.error(f"=== EXPORT CALLED: role={role!r}, group_id={group_id} ===")
    
    # Получаем всех пользователей и фильтруем в Python
    all_users = db.query(User).all()
    logger.error(f"=== Total users in DB: {len(all_users)} ===")
    if all_users:
        logger.error(f"=== Sample roles in DB: {[str(u.role) for u in all_users[:5]]} ===")
    
    # Фильтр: только пользователи с временным паролем (не изменили пароль)
    all_users = [u for u in all_users if u.is_password_changed == False]
    logger.error(f"=== After password filter (not changed): {len(all_users)} users ===")
    
    # Фильтр по роли
    if role:
        role_clean = role.strip() if isinstance(role, str) else str(role).strip()
        logger.error(f"=== Filtering by role: {role_clean} ===")
        if not role_clean or role_clean not in ['teacher', 'student']:
            raise HTTPException(status_code=400, detail="Некорректная роль. Допустимые значения: teacher, student")
        
        # Фильтруем по роли - используем прямое сравнение Enum
        filtered_users = []
        for u in all_users:
            # Прямое сравнение Enum значения со строкой
            user_role_str = str(u.role)
            if user_role_str == role_clean:
                filtered_users.append(u)
        
        logger.error(f"=== After role filter: {len(filtered_users)} users (was {len(all_users)}) ===")
        if filtered_users:
            logger.error(f"=== Sample filtered roles: {[str(u.role) for u in filtered_users[:3]]} ===")
        elif len(all_users) > 0:
            logger.error(f"=== WARNING: Filter returned 0 users but DB has {len(all_users)} users! ===")
        
        all_users = filtered_users
    else:
        logger.error("=== No role filter applied ===")
    
    # Фильтр по группе (только для студентов)
    if group_id is not None:
        if role and role != 'student':
            raise HTTPException(status_code=400, detail="Фильтр по группе доступен только для студентов")
        all_users = [u for u in all_users if u.group_id == group_id]
        logger.error(f"=== After group filter: {len(all_users)} users ===")
    
    # Сортируем
    users = sorted(all_users, key=lambda u: (u.last_name or '', u.first_name or '', u.id))
    
    # Получаем названия групп
    group_ids = {user.group_id for user in users if user.group_id is not None}
    groups_map = {}
    if group_ids:
        groups = db.query(Group).filter(Group.id.in_(group_ids)).all()
        groups_map = {group.id: group.name for group in groups}
    
    # Создаем Excel файл в памяти
    output = io.BytesIO()
    workbook = xlsxwriter.Workbook(output, {'in_memory': True})
    worksheet = workbook.add_worksheet('Пользователи')
    
    # Стили
    header_format = workbook.add_format({
        'bold': True,
        'bg_color': '#0b3d2c',
        'font_color': '#ffffff',
        'border': 1,
        'align': 'center',
        'valign': 'vcenter'
    })
    cell_format = workbook.add_format({
        'border': 1,
        'align': 'left',
        'valign': 'vcenter'
    })
    
    # Заголовки
    headers = ['ID', 'Логин', 'Фамилия', 'Имя', 'Отчество', 'Роль', 'Группа', 'Временный пароль', 'Пароль изменен']
    for col, header in enumerate(headers):
        worksheet.write(0, col, header, header_format)
    
    # Данные
    for row, user in enumerate(users, start=1):
        last_name, first_name, middle_name = resolve_user_names(user)
        group_name = groups_map.get(user.group_id) if user.group_id else None
        role_name = 'Преподаватель' if user.role == 'teacher' else 'Студент' if user.role == 'student' else 'Админ'
        password_changed = 'Да' if user.is_password_changed else 'Нет'
        
        worksheet.write(row, 0, user.id, cell_format)
        worksheet.write(row, 1, user.login, cell_format)
        worksheet.write(row, 2, last_name or '', cell_format)
        worksheet.write(row, 3, first_name or '', cell_format)
        worksheet.write(row, 4, middle_name or '', cell_format)
        worksheet.write(row, 5, role_name, cell_format)
        worksheet.write(row, 6, group_name or '', cell_format)
        worksheet.write(row, 7, user.temporary_password or '', cell_format)
        worksheet.write(row, 8, password_changed, cell_format)
    
    # Автоподбор ширины колонок
    for col in range(len(headers)):
        worksheet.set_column(col, col, 15)
    
    workbook.close()
    output.seek(0)
    
    # Формируем имя файла (только ASCII для совместимости)
    filename = 'users_export'
    if role:
        role_name = 'teachers' if role == 'teacher' else 'students'
        filename += f'_{role_name}'
    if group_id is not None:
        group = db.query(Group).filter(Group.id == group_id).first()
        if group:
            # Используем только ASCII символы в имени файла
            group_name_safe = group.name.encode('ascii', 'ignore').decode('ascii') or f'group_{group_id}'
            filename += f'_group_{group_name_safe}'
    filename += f'_{datetime.now().strftime("%Y%m%d_%H%M%S")}.xlsx'
    
    # Правильное кодирование имени файла для Content-Disposition
    filename_encoded = quote(filename, safe='')
    
    return StreamingResponse(
        io.BytesIO(output.read()),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{filename_encoded}"}
    )

