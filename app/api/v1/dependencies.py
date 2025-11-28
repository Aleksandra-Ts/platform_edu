"""Зависимости для проверки доступа к ресурсам"""
from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.security import get_current_user
from app.models import Course, Lecture, LectureMaterial, User


def require_course_access(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Course:
    """
    Проверяет доступ пользователя к курсу.
    Возвращает курс, если доступ разрешен, иначе выбрасывает HTTPException.
    """
    # Используем joinedload для предзагрузки groups и teachers (избегаем N+1)
    course = db.query(Course).options(
        joinedload(Course.groups),
        joinedload(Course.teachers)
    ).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    
    # Админ имеет доступ ко всем курсам
    if current_user.role == "admin":
        return course
    
    # Преподаватель должен быть преподавателем курса
    if current_user.role == "teacher":
        # teachers уже загружены, нет дополнительных запросов
        teacher_ids = [t.id for t in course.teachers]
        if current_user.id not in teacher_ids:
            raise HTTPException(
                status_code=403, 
                detail="Вы не являетесь преподавателем этого курса"
            )
        return course
    
    # Студент должен быть в группе курса
    if current_user.role == "student":
        if not current_user.group_id:
            raise HTTPException(
                status_code=403, 
                detail="У вас не указана группа"
            )
        # groups уже загружены, нет дополнительных запросов
        student_group_ids = [g.id for g in course.groups]
        if current_user.group_id not in student_group_ids:
            raise HTTPException(
                status_code=403, 
                detail="Доступ запрещен"
            )
        return course
    
    raise HTTPException(
        status_code=403, 
        detail="Доступ разрешен только преподавателям и студентам"
    )


def require_lecture_access(
    lecture_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    require_published: bool = False,
) -> Lecture:
    """
    Проверяет доступ пользователя к лекции.
    
    Args:
        lecture_id: ID лекции
        require_published: Если True, студенты могут видеть только опубликованные лекции
    
    Returns:
        Lecture объект, если доступ разрешен
    
    Raises:
        HTTPException: Если доступ запрещен
    """
    lecture = db.query(Lecture).filter(Lecture.id == lecture_id).first()
    if not lecture:
        raise HTTPException(status_code=404, detail="Лекция не найдена")
    
    # Получаем курс для проверки доступа с предзагрузкой groups и teachers (избегаем N+1)
    course = db.query(Course).options(
        joinedload(Course.groups),
        joinedload(Course.teachers)
    ).filter(Course.id == lecture.course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    
    # Админ имеет доступ ко всем лекциям
    if current_user.role == "admin":
        return lecture
    
    # Преподаватель должен быть преподавателем курса
    if current_user.role == "teacher":
        # teachers уже загружены, нет дополнительных запросов
        teacher_ids = [t.id for t in course.teachers]
        if current_user.id not in teacher_ids:
            raise HTTPException(
                status_code=403, 
                detail="Вы не являетесь преподавателем этого курса"
            )
        return lecture
    
    # Студент должен быть в группе курса и лекция должна быть опубликована (если требуется)
    if current_user.role == "student":
        if require_published and not lecture.published:
            raise HTTPException(
                status_code=403, 
                detail="Лекция не опубликована"
            )
        if not current_user.group_id:
            raise HTTPException(
                status_code=403, 
                detail="У вас не указана группа"
            )
        # groups уже загружены, нет дополнительных запросов
        student_group_ids = [g.id for g in course.groups]
        if current_user.group_id not in student_group_ids:
            raise HTTPException(
                status_code=403, 
                detail="Доступ запрещен"
            )
        return lecture
    
    raise HTTPException(
        status_code=403, 
        detail="Доступ запрещен"
    )


def require_lecture_teacher_access(
    lecture_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Lecture:
    """
    Проверяет, что пользователь является преподавателем лекции.
    Используется для операций, требующих прав преподавателя (редактирование, удаление).
    """
    lecture = require_lecture_access(lecture_id, db, current_user, require_published=False)
    
    if current_user.role != "teacher":
        raise HTTPException(
            status_code=403, 
            detail="Доступ разрешен только преподавателям"
        )
    
    return lecture


def require_material_access(
    material_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    require_published: bool = False,
) -> tuple[LectureMaterial, Lecture, Course]:
    """
    Проверяет доступ пользователя к материалу лекции.
    
    Returns:
        Кортеж (material, lecture, course) если доступ разрешен
    """
    material = db.query(LectureMaterial).filter(LectureMaterial.id == material_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Материал не найден")
    
    # Получаем лекцию и курс через зависимость
    lecture = require_lecture_access(
        material.lecture_id, 
        db, 
        current_user, 
        require_published=require_published
    )
    
    course = db.query(Course).filter(Course.id == lecture.course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    
    return material, lecture, course

