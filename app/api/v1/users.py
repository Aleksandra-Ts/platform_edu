"""Роуты для работы с пользователями"""
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import get_current_user, pwd_context, validate_password_strength
from app.core.database import get_db
from app.models import Course, Group, User
from app.schemas import ChangeOwnPasswordRequest, CourseResponse, UpdateProfileRequest, UserResponse
from app.utils import build_user_response, compose_full_name, normalize_name

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/me", response_model=UserResponse)
def get_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Получение профиля текущего пользователя"""
    group_name = None
    if current_user.group_id:
        group = db.query(Group).filter(Group.id == current_user.group_id).first()
        group_name = group.name if group else None
    return build_user_response(current_user, group_name)


@router.put("/me", response_model=UserResponse)
def update_profile(
    payload: UpdateProfileRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Обновление профиля текущего пользователя"""
    last_name = normalize_name(payload.last_name)
    first_name = normalize_name(payload.first_name)
    middle_name = normalize_name(payload.middle_name)

    if not last_name or not first_name:
        raise HTTPException(status_code=400, detail="Имя и фамилия обязательны")

    current_user.last_name = last_name
    current_user.first_name = first_name
    current_user.middle_name = middle_name
    current_user.full_name = compose_full_name(last_name, first_name, middle_name)
    db.commit()
    db.refresh(current_user)

    group_name = None
    if current_user.group_id:
        group = db.query(Group).filter(Group.id == current_user.group_id).first()
        group_name = group.name if group else None
    return build_user_response(current_user, group_name)


@router.post("/me/change_password")
def change_own_password(
    payload: ChangeOwnPasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Смена собственного пароля"""
    if not current_user.password_hash or not pwd_context.verify(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Неверный текущий пароль")
    if payload.new_password == payload.current_password:
        raise HTTPException(status_code=400, detail="Новый пароль совпадает с текущим")
    validate_password_strength(payload.new_password)

    current_user.password_hash = pwd_context.hash(payload.new_password)
    current_user.temporary_password = None
    current_user.is_password_changed = True
    current_user.is_temporary = False
    db.commit()
    return {"message": "Пароль обновлён"}


@router.get("/me/courses", response_model=List[CourseResponse])
def get_my_courses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Получение курсов текущего пользователя"""
    from app.models import Lecture
    
    if current_user.role == "teacher":
        # Получаем все курсы, где текущий пользователь является преподавателем
        courses = current_user.courses_taught
    elif current_user.role == "student":
        # Получаем курсы группы студента, где есть опубликованные лекции
        if not current_user.group_id:
            return []
        
        # Получаем все курсы группы студента
        courses = db.query(Course).join(Course.groups).filter(
            Course.groups.any(id=current_user.group_id)
        ).all()
        
        # Фильтруем только те курсы, где есть опубликованные лекции
        courses_with_published = []
        for course in courses:
            published_lectures_count = db.query(Lecture).filter(
                Lecture.course_id == course.id,
                Lecture.published == True
            ).count()
            if published_lectures_count > 0:
                courses_with_published.append(course)
        courses = courses_with_published
        logger.info(f"Студент {current_user.id} видит {len(courses)} курсов с опубликованными лекциями")
    else:
        raise HTTPException(status_code=403, detail="Доступ разрешен только преподавателям и студентам")
    
    result = []
    for course in courses:
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


@router.get("/me/courses/{course_id}", response_model=CourseResponse)
def get_my_course(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Получение курса по ID (для преподавателей и студентов)"""
    from app.models import Lecture
    
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    
    # Проверяем доступ в зависимости от роли
    if current_user.role == "teacher":
        # Преподаватель должен быть преподавателем этого курса
        teacher_ids = [t.id for t in course.teachers]
        if current_user.id not in teacher_ids:
            raise HTTPException(status_code=403, detail="Вы не являетесь преподавателем этого курса")
    elif current_user.role == "student":
        # Студент должен быть в группе курса и курс должен иметь опубликованные лекции
        if not current_user.group_id:
            raise HTTPException(status_code=403, detail="У вас не указана группа")
        
        student_group_ids = [g.id for g in course.groups]
        if current_user.group_id not in student_group_ids:
            raise HTTPException(status_code=403, detail="Доступ запрещен")
        
        # Проверяем, что есть опубликованные лекции
        published_lectures_count = db.query(Lecture).filter(
            Lecture.course_id == course.id,
            Lecture.published == True
        ).count()
        if published_lectures_count == 0:
            raise HTTPException(status_code=403, detail="В этом курсе нет опубликованных лекций")
    else:
        raise HTTPException(status_code=403, detail="Доступ разрешен только преподавателям и студентам")
    
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

