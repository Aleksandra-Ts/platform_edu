"""API эндпоинты для работы с лекциями"""
import os
import shutil
import logging
import subprocess
from datetime import datetime
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.responses import JSONResponse, StreamingResponse
import json
import asyncio
import threading
from sqlalchemy.orm import Session
from sqlalchemy import create_engine
from app.core.database import engine

logger = logging.getLogger(__name__)

# Импорт модуля транскрибации
from app.utils.transcription import (
    transcribe_file, 
    find_ffmpeg, 
    ensure_ffmpeg_in_path,
    WHISPER_AVAILABLE
)

from app.core.database import get_db
from app.core.security import get_current_user
from app.models import Course, Lecture, LectureMaterial, ProcessedMaterial, User, Test, Question
from app.schemas import CreateLectureRequest, UpdateLectureRequest, LectureMaterialResponse, LectureResponse, TestResponse, QuestionResponse

router = APIRouter()

# Директория для хранения файлов лекций
UPLOAD_DIR = Path("uploads/lectures")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Импорты для парсинга файлов
try:
    import PyPDF2
    PDF_PARSER_AVAILABLE = True
except ImportError:
    PDF_PARSER_AVAILABLE = False

try:
    import pdfplumber
    PDFPLUMBER_AVAILABLE = True
except ImportError:
    PDFPLUMBER_AVAILABLE = False

try:
    from docx import Document
    DOCX_PARSER_AVAILABLE = True
except ImportError:
    DOCX_PARSER_AVAILABLE = False


@router.get("/courses/{course_id}/lectures", response_model=List[LectureResponse])
def get_course_lectures(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Получение всех лекций курса"""
    # Проверяем, что курс существует
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    
    # Проверяем доступ в зависимости от роли
    if current_user.role == "admin":
        # Админ видит все лекции курса
        lectures = db.query(Lecture).filter(Lecture.course_id == course_id).all()
    elif current_user.role == "teacher":
        # Преподаватель видит все лекции своего курса
        teacher_ids = [t.id for t in course.teachers]
        if current_user.id not in teacher_ids:
            raise HTTPException(status_code=403, detail="Вы не являетесь преподавателем этого курса")
        lectures = db.query(Lecture).filter(Lecture.course_id == course_id).all()
    elif current_user.role == "student":
        # Студент видит только опубликованные лекции курса своей группы
        student_group_ids = [g.id for g in course.groups]
        if current_user.group_id not in student_group_ids:
            raise HTTPException(status_code=403, detail="Доступ запрещен")
        lectures = db.query(Lecture).filter(
            Lecture.course_id == course_id,
            Lecture.published == True
        ).all()
    else:
        raise HTTPException(status_code=403, detail="Доступ запрещен")
    
    result = []
    for lecture in lectures:
        try:
            materials = db.query(LectureMaterial).filter(LectureMaterial.lecture_id == lecture.id).order_by(LectureMaterial.order_index).all()
        except Exception:
            # Если столбец order_index еще не существует, загружаем без сортировки
            materials = db.query(LectureMaterial).filter(LectureMaterial.lecture_id == lecture.id).all()
        result.append(LectureResponse(
            id=lecture.id,
            course_id=lecture.course_id,
            name=lecture.name,
            description=lecture.description,
            created_at=lecture.created_at,
            published=lecture.published or False,
            generate_test=lecture.generate_test or False,
            test_generation_mode=lecture.test_generation_mode or "once",
            test_max_attempts=lecture.test_max_attempts or 1,
            test_show_answers=lecture.test_show_answers or False,
            test_deadline=lecture.test_deadline,
            materials=[LectureMaterialResponse(
                id=m.id,
                file_path=m.file_path,
                file_type=m.file_type,
                file_name=m.file_name,
                file_size=m.file_size,
                order_index=m.order_index
            ) for m in materials]
        ))
    
    return result


@router.post("/lectures", response_model=LectureResponse)
def create_lecture(
    payload: CreateLectureRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Создание новой лекции"""
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Доступ разрешен только преподавателям")
    
    # Проверяем, что курс существует
    course = db.query(Course).filter(Course.id == payload.course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    
    # Проверяем, что пользователь является преподавателем курса
    teacher_ids = [t.id for t in course.teachers]
    if current_user.id not in teacher_ids:
        raise HTTPException(status_code=403, detail="Вы не являетесь преподавателем этого курса")
    
    # Создаем лекцию
    lecture = Lecture(
        course_id=payload.course_id,
        name=payload.name,
        description=payload.description,
        created_at=datetime.now().isoformat(),
        generate_test=payload.generate_test or False,
        test_generation_mode=payload.test_generation_mode or "once",
        test_max_attempts=payload.test_max_attempts or 1,
        test_show_answers=payload.test_show_answers or False,
        test_deadline=payload.test_deadline
    )
    
    db.add(lecture)
    db.commit()
    db.refresh(lecture)
    
    # При создании лекции материалов еще нет, возвращаем пустой список
    return LectureResponse(
        id=lecture.id,
        course_id=lecture.course_id,
        name=lecture.name,
        description=lecture.description,
        created_at=lecture.created_at,
        published=lecture.published or False,
        generate_test=lecture.generate_test or False,
        test_generation_mode=lecture.test_generation_mode or "once",
        test_max_attempts=lecture.test_max_attempts or 1,
        test_show_answers=lecture.test_show_answers or False,
        test_deadline=lecture.test_deadline,
        materials=[]
    )


@router.get("/lectures/{lecture_id}", response_model=LectureResponse)
def get_lecture(
    lecture_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Получение лекции по ID"""
    lecture = db.query(Lecture).filter(Lecture.id == lecture_id).first()
    if not lecture:
        raise HTTPException(status_code=404, detail="Лекция не найдена")
    
    # Проверяем доступ
    course = db.query(Course).filter(Course.id == lecture.course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    
    # Для преподавателей - проверяем, что они преподают курс
    if current_user.role == "teacher":
        teacher_ids = [t.id for t in course.teachers]
        if current_user.id not in teacher_ids:
            raise HTTPException(status_code=403, detail="Вы не являетесь преподавателем этого курса")
    # Для студентов - проверяем, что лекция опубликована и они в группе курса
    elif current_user.role == "student":
        if not lecture.published:
            raise HTTPException(status_code=403, detail="Лекция не опубликована")
        student_group_ids = [g.id for g in course.groups]
        if current_user.group_id not in student_group_ids:
            raise HTTPException(status_code=403, detail="Доступ запрещен")
    else:
        raise HTTPException(status_code=403, detail="Доступ запрещен")
    
    try:
        materials = db.query(LectureMaterial).filter(LectureMaterial.lecture_id == lecture.id).order_by(LectureMaterial.order_index).all()
    except Exception:
        # Если столбец order_index еще не существует, загружаем без сортировки
        materials = db.query(LectureMaterial).filter(LectureMaterial.lecture_id == lecture.id).all()
    
    return LectureResponse(
        id=lecture.id,
        course_id=lecture.course_id,
        name=lecture.name,
        description=lecture.description,
        created_at=lecture.created_at,
        published=lecture.published or False,
        generate_test=lecture.generate_test or False,
        test_generation_mode=lecture.test_generation_mode or "once",
        test_max_attempts=lecture.test_max_attempts or 1,
        test_show_answers=lecture.test_show_answers or False,
        test_deadline=lecture.test_deadline,
        materials=[{
            "id": m.id,
            "file_path": m.file_path,
            "file_type": m.file_type,
            "file_name": m.file_name,
            "file_size": m.file_size,
            "order_index": m.order_index
        } for m in materials]
    )


@router.put("/lectures/{lecture_id}")
def update_lecture(
    lecture_id: int,
    payload: UpdateLectureRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Обновление лекции"""
    lecture = db.query(Lecture).filter(Lecture.id == lecture_id).first()
    if not lecture:
        raise HTTPException(status_code=404, detail="Лекция не найдена")
    
    course = db.query(Course).filter(Course.id == lecture.course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    
    # Проверяем права доступа
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Доступ разрешен только преподавателям")
    
    teacher_ids = [t.id for t in course.teachers]
    if current_user.id not in teacher_ids:
        raise HTTPException(status_code=403, detail="Вы не являетесь преподавателем этого курса")
    
    # Обновляем поля
    if payload.name is not None:
        lecture.name = payload.name
    if payload.description is not None:
        lecture.description = payload.description
    if payload.generate_test is not None:
        lecture.generate_test = payload.generate_test
    if payload.test_generation_mode is not None:
        lecture.test_generation_mode = payload.test_generation_mode
    if payload.test_max_attempts is not None:
        lecture.test_max_attempts = payload.test_max_attempts
    if payload.test_show_answers is not None:
        lecture.test_show_answers = payload.test_show_answers
    if payload.test_deadline is not None:
        lecture.test_deadline = payload.test_deadline
    
    db.commit()
    db.refresh(lecture)
    
    try:
        materials = db.query(LectureMaterial).filter(LectureMaterial.lecture_id == lecture.id).order_by(LectureMaterial.order_index).all()
    except Exception:
        materials = db.query(LectureMaterial).filter(LectureMaterial.lecture_id == lecture.id).all()
    
    return LectureResponse(
        id=lecture.id,
        course_id=lecture.course_id,
        name=lecture.name,
        description=lecture.description,
        created_at=lecture.created_at,
        published=lecture.published or False,
        generate_test=lecture.generate_test or False,
        test_generation_mode=lecture.test_generation_mode or "once",
        test_max_attempts=lecture.test_max_attempts or 1,
        test_show_answers=lecture.test_show_answers or False,
        test_deadline=lecture.test_deadline,
        materials=[{
            "id": m.id,
            "file_path": m.file_path,
            "file_type": m.file_type,
            "file_name": m.file_name,
            "file_size": m.file_size,
            "order_index": m.order_index
        } for m in materials]
    )


@router.delete("/lectures/{lecture_id}")
def delete_lecture(
    lecture_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Удаление лекции"""
    lecture = db.query(Lecture).filter(Lecture.id == lecture_id).first()
    if not lecture:
        raise HTTPException(status_code=404, detail="Лекция не найдена")
    
    # Проверяем доступ
    course = db.query(Course).filter(Course.id == lecture.course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Доступ разрешен только преподавателям")
    
    teacher_ids = [t.id for t in course.teachers]
    if current_user.id not in teacher_ids:
        raise HTTPException(status_code=403, detail="Вы не являетесь преподавателем этого курса")
    
    db.delete(lecture)
    db.commit()
    
    return {"message": "Лекция удалена"}


@router.post("/lectures/{lecture_id}/materials")
async def upload_material(
    lecture_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Загрузка материала для лекции"""
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Доступ разрешен только преподавателям")
    
    # Проверяем доступ к лекции
    lecture = db.query(Lecture).filter(Lecture.id == lecture_id).first()
    if not lecture:
        raise HTTPException(status_code=404, detail="Лекция не найдена")
    
    course = db.query(Course).filter(Course.id == lecture.course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    
    teacher_ids = [t.id for t in course.teachers]
    if current_user.id not in teacher_ids:
        raise HTTPException(status_code=403, detail="Вы не являетесь преподавателем этого курса")
    
    # Определяем тип файла
    file_extension = Path(file.filename).suffix.lower()
    file_type_map = {
        '.mp4': 'video', '.avi': 'video', '.mov': 'video', '.mkv': 'video', '.webm': 'video',
        '.pdf': 'pdf',
        '.pptx': 'presentation', '.ppt': 'presentation',
        '.mp3': 'audio', '.wav': 'audio', '.ogg': 'audio', '.m4a': 'audio',
        '.zip': 'scorm', '.scorm': 'scorm'
    }
    file_type = file_type_map.get(file_extension, 'other')
    
    # Создаем директорию для лекции
    lecture_dir = UPLOAD_DIR / str(lecture_id)
    lecture_dir.mkdir(parents=True, exist_ok=True)
    
    # Сохраняем файл
    file_path = lecture_dir / file.filename
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Получаем текущий максимальный order_index
    max_order = db.query(LectureMaterial).filter(LectureMaterial.lecture_id == lecture_id).count()
    
    # Сохраняем относительный путь для доступа через статику
    # Формируем путь как uploads/lectures/{lecture_id}/{filename}
    relative_path_str = f"uploads/lectures/{lecture_id}/{file.filename}"
    
    # Создаем запись о материале
    material = LectureMaterial(
        lecture_id=lecture_id,
        file_path=relative_path_str,
        file_type=file_type,
        file_name=file.filename,
        file_size=file_path.stat().st_size,
        order_index=max_order
    )
    
    db.add(material)
    db.commit()
    db.refresh(material)
    
    return {
        "id": material.id,
        "file_path": material.file_path,
        "file_type": material.file_type,
        "file_name": material.file_name,
        "file_size": material.file_size,
        "order_index": material.order_index
    }


@router.delete("/lectures/{lecture_id}/materials/{material_id}")
def delete_material(
    lecture_id: int,
    material_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Удаление материала лекции"""
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Доступ разрешен только преподавателям")
    
    # Проверяем доступ
    lecture = db.query(Lecture).filter(Lecture.id == lecture_id).first()
    if not lecture:
        raise HTTPException(status_code=404, detail="Лекция не найдена")
    
    course = db.query(Course).filter(Course.id == lecture.course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    
    teacher_ids = [t.id for t in course.teachers]
    if current_user.id not in teacher_ids:
        raise HTTPException(status_code=403, detail="Вы не являетесь преподавателем этого курса")
    
    material = db.query(LectureMaterial).filter(
        LectureMaterial.id == material_id,
        LectureMaterial.lecture_id == lecture_id
    ).first()
    
    if not material:
        raise HTTPException(status_code=404, detail="Материал не найден")
    
    # Удаляем файл (используем абсолютный путь)
    file_path = Path(material.file_path)
    if not file_path.is_absolute():
        file_path = Path.cwd() / file_path
    if file_path.exists():
        file_path.unlink()
    
    db.delete(material)
    db.commit()
    
    return {"message": "Материал удален"}


@router.put("/lectures/{lecture_id}/materials/reorder")
def reorder_materials(
    lecture_id: int,
    material_ids: List[int],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Изменение порядка материалов"""
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Доступ разрешен только преподавателям")
    
    # Проверяем доступ
    lecture = db.query(Lecture).filter(Lecture.id == lecture_id).first()
    if not lecture:
        raise HTTPException(status_code=404, detail="Лекция не найдена")
    
    course = db.query(Course).filter(Course.id == lecture.course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    
    teacher_ids = [t.id for t in course.teachers]
    if current_user.id not in teacher_ids:
        raise HTTPException(status_code=403, detail="Вы не являетесь преподавателем этого курса")
    
    # Обновляем порядок
    for order_index, material_id in enumerate(material_ids):
        material = db.query(LectureMaterial).filter(
            LectureMaterial.id == material_id,
            LectureMaterial.lecture_id == lecture_id
        ).first()
        if material:
            material.order_index = order_index
    
    db.commit()
    return {"message": "Порядок материалов обновлен"}


@router.get("/materials/{material_id}/content")
def get_material_content(
    material_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Получение текстового содержимого материала (PDF, Word и т.д.)"""
    material = db.query(LectureMaterial).filter(LectureMaterial.id == material_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Материал не найден")
    
    # Проверяем доступ через лекцию
    lecture = db.query(Lecture).filter(Lecture.id == material.lecture_id).first()
    if not lecture:
        raise HTTPException(status_code=404, detail="Лекция не найдена")
    
    course = db.query(Course).filter(Course.id == lecture.course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    
    # Проверяем права доступа (админ, преподаватель курса или студент группы)
    if current_user.role == "admin":
        # Админ имеет доступ ко всем материалам
        pass
    elif current_user.role == "teacher":
        teacher_ids = [t.id for t in course.teachers]
        if current_user.id not in teacher_ids:
            raise HTTPException(status_code=403, detail="Доступ запрещен")
    elif current_user.role == "student":
        # Студент должен быть в одной из групп курса
        student_group_ids = [g.id for g in course.groups]
        if current_user.group_id not in student_group_ids:
            raise HTTPException(status_code=403, detail="Доступ запрещен")
    else:
        raise HTTPException(status_code=403, detail="Доступ запрещен")
    
    # Проверяем, опубликована ли лекция (для админа пропускаем проверку)
    if current_user.role != "admin" and not lecture.published:
        return JSONResponse({
            "content": None,
            "error": "Текст документа доступен только после публикации лекции. Нажмите кнопку 'Выложить' в конструкторе лекции.",
            "file_name": material.file_name,
            "file_type": material.file_type,
            "not_published": True
        })
    
    # Используем ProcessedMaterial (для всех, если лекция опубликована)
    processed_material = db.query(ProcessedMaterial).filter(
        ProcessedMaterial.material_id == material_id
    ).first()
    
    if processed_material and processed_material.processed_text:
        # Возвращаем сохраненный текст из ProcessedMaterial
        return JSONResponse({
            "content": processed_material.processed_text,
            "error": None,
            "file_name": material.file_name,
            "file_type": material.file_type,
            "from_cache": True
        })
    else:
        # Если ProcessedMaterial нет, возвращаем ошибку
        return JSONResponse({
            "content": None,
            "error": "Материал еще не обработан. Обратитесь к преподавателю для публикации лекции.",
            "file_name": material.file_name,
            "file_type": material.file_type
        })


def parse_pdf(file_path: Path) -> str:
    """Парсинг PDF файла и извлечение текста"""
    text_content = []
    
    # Пробуем использовать pdfplumber (более точный)
    if PDFPLUMBER_AVAILABLE:
        try:
            with pdfplumber.open(file_path) as pdf:
                for i, page in enumerate(pdf.pages, 1):
                    page_text = page.extract_text()
                    if page_text:
                        text_content.append(f"--- Страница {i} ---\n\n{page_text}")
            return "\n\n".join(text_content) if text_content else "Текст не найден в PDF"
        except Exception as e:
            print(f"Ошибка pdfplumber: {e}")
    
    # Fallback на PyPDF2
    if PDF_PARSER_AVAILABLE:
        try:
            with open(file_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                for i, page in enumerate(pdf_reader.pages, 1):
                    page_text = page.extract_text()
                    if page_text:
                        text_content.append(f"--- Страница {i} ---\n\n{page_text}")
            return "\n\n".join(text_content) if text_content else "Текст не найден в PDF"
        except Exception as e:
            print(f"Ошибка PyPDF2: {e}")
    
    raise Exception("Библиотеки для парсинга PDF не установлены")


def parse_docx(file_path: Path) -> str:
    """Парсинг Word документа и извлечение текста"""
    if not DOCX_PARSER_AVAILABLE:
        raise Exception("Библиотека python-docx не установлена")
    
    try:
        doc = Document(file_path)
        paragraphs = []
        for para in doc.paragraphs:
            if para.text.strip():
                paragraphs.append(para.text)
        return "\n\n".join(paragraphs) if paragraphs else "Текст не найден в документе"
    except Exception as e:
        raise Exception(f"Ошибка парсинга Word: {str(e)}")


@router.get("/materials/{material_id}/transcribe")
def transcribe_video(
    material_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Получение транскрипта видео/аудио (из БД для опубликованных лекций)"""
    material = db.query(LectureMaterial).filter(LectureMaterial.id == material_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Материал не найден")
    
    # Проверяем, что это видео или аудио
    video_exts = ['.mp4', '.avi', '.mov', '.mkv', '.flv', '.wmv', '.webm', '.m4v', '.3gp']
    audio_exts = ['.mp3', '.wav', '.flac', '.aac', '.m4a', '.ogg', '.wma', '.opus']
    file_ext = Path(material.file_name).suffix.lower()
    
    if file_ext not in video_exts and file_ext not in audio_exts:
        raise HTTPException(status_code=400, detail="Транскрибация доступна только для видео и аудио файлов")
    
    # Проверяем доступ через лекцию
    lecture = db.query(Lecture).filter(Lecture.id == material.lecture_id).first()
    if not lecture:
        raise HTTPException(status_code=404, detail="Лекция не найдена")
    
    course = db.query(Course).filter(Course.id == lecture.course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    
    # Проверяем права доступа
    is_teacher = False
    if current_user.role == "teacher":
        teacher_ids = [t.id for t in course.teachers]
        if current_user.id not in teacher_ids:
            raise HTTPException(status_code=403, detail="Доступ запрещен")
        is_teacher = True
    elif current_user.role == "student":
        if not lecture.published:
            raise HTTPException(status_code=403, detail="Лекция не опубликована")
        student_group_ids = [g.id for g in course.groups]
        if current_user.group_id not in student_group_ids:
            raise HTTPException(status_code=403, detail="Доступ запрещен")
    elif current_user.role == "admin":
        # Админ имеет доступ
        is_teacher = True  # Админ может транскрибировать как преподаватель
    else:
        raise HTTPException(status_code=403, detail="Доступ запрещен")
    
    # Проверяем сохраненный транскрипт из ProcessedMaterial
    processed_material = db.query(ProcessedMaterial).filter(
        ProcessedMaterial.material_id == material_id
    ).first()
    
    # Если транскрипт есть в БД - возвращаем его
    if processed_material and processed_material.processed_text:
        return JSONResponse({
            "text": processed_material.processed_text,
            "language": "ru"
        })
    
    # Если транскрипта нет в БД
    if is_teacher:
        # Для преподавателей: транскрибация доступна только после публикации
        if not lecture.published:
            raise HTTPException(
                status_code=403, 
                detail="Транскрибация доступна только после публикации лекции. Нажмите кнопку 'Выложить' в конструкторе лекции."
            )
        else:
            # Лекция опубликована, но транскрипта нет - значит при публикации произошла ошибка
            raise HTTPException(
                status_code=404, 
                detail="Транскрипт еще не готов. Перепубликуйте лекцию, нажав кнопку 'Выложить' в конструкторе."
            )
    else:
        # Для студентов: транскрипт должен быть в БД после публикации
        raise HTTPException(
            status_code=404, 
            detail="Транскрипт еще не готов. Обратитесь к преподавателю для публикации лекции."
        )




@router.get("/materials/{material_id}/file")
def get_material_file(
    material_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Получение файла материала с проверкой прав доступа"""
    from fastapi.responses import FileResponse
    
    material = db.query(LectureMaterial).filter(LectureMaterial.id == material_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Материал не найден")
    
    # Проверяем доступ через лекцию
    lecture = db.query(Lecture).filter(Lecture.id == material.lecture_id).first()
    if not lecture:
        raise HTTPException(status_code=404, detail="Лекция не найдена")
    
    course = db.query(Course).filter(Course.id == lecture.course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    
    # Проверяем права доступа (админ, преподаватель курса или студент группы)
    if current_user.role == "admin":
        # Админ имеет доступ ко всем материалам
        pass
    elif current_user.role == "teacher":
        teacher_ids = [t.id for t in course.teachers]
        if current_user.id not in teacher_ids:
            raise HTTPException(status_code=403, detail="Доступ запрещен")
    elif current_user.role == "student":
        # Студент должен быть в одной из групп курса
        student_group_ids = [g.id for g in course.groups]
        if current_user.group_id not in student_group_ids:
            raise HTTPException(status_code=403, detail="Доступ запрещен")
    else:
        raise HTTPException(status_code=403, detail="Доступ запрещен")
    
    # Проверяем существование файла
    file_path = Path(material.file_path)
    if not file_path.is_absolute():
        file_path = Path.cwd() / file_path
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Файл не найден")
    
    # Определяем media type
    media_type_map = {
        'video': 'video/mp4',
        'pdf': 'application/pdf',
        'audio': 'audio/mpeg',
        'presentation': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    }
    media_type = media_type_map.get(material.file_type, 'application/octet-stream')
    
    return FileResponse(
        path=str(file_path),
        media_type=media_type,
        filename=material.file_name,
        headers={
            "Content-Disposition": f'inline; filename="{material.file_name}"'
        }
    )


@router.post("/lectures/{lecture_id}/publish")
async def publish_lecture(
    lecture_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Публикация лекции: транскрибация видео и парсинг PDF с прогрессом через SSE"""
    logger.info(f"Начало публикации лекции {lecture_id} пользователем {current_user.id}")
    
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Доступ разрешен только преподавателям")
    
    lecture = db.query(Lecture).filter(Lecture.id == lecture_id).first()
    if not lecture:
        raise HTTPException(status_code=404, detail="Лекция не найдена")
    
    # Проверяем, что пользователь является преподавателем курса
    course = db.query(Course).filter(Course.id == lecture.course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    
    teacher_ids = [t.id for t in course.teachers]
    if current_user.id not in teacher_ids:
        raise HTTPException(status_code=403, detail="Вы не являетесь преподавателем этого курса")
    
    # Получаем все материалы лекции
    materials = db.query(LectureMaterial).filter(LectureMaterial.lecture_id == lecture_id).all()
    
    if not materials:
        raise HTTPException(status_code=400, detail="Лекция не содержит материалов")
    
    logger.info(f"Найдено материалов для обработки: {len(materials)}")
    
    processed_count = 0
    errors = []
    
    # Обрабатываем каждый материал
    for material in materials:
        try:
            # Проверяем, не обработан ли уже этот материал
            existing = db.query(ProcessedMaterial).filter(
                ProcessedMaterial.material_id == material.id
            ).first()
            
            if existing:
                # Материал уже обработан, пропускаем
                processed_count += 1
                continue
            
            # Получаем путь к файлу
            file_path = Path(material.file_path)
            if not file_path.is_absolute():
                file_path = Path.cwd() / file_path
            
            if not file_path.exists():
                errors.append(f"Файл не найден: {material.file_name}")
                continue
            
            # Формируем URL файла (используем относительный путь)
            file_url = f"/api/materials/{material.id}/file"
            
            processed_text = None
            
            # Обработка в зависимости от типа файла
            # Проверяем, является ли файл видео или аудио
            video_exts = ['.mp4', '.avi', '.mov', '.mkv', '.flv', '.wmv', '.webm', '.m4v', '.3gp']
            audio_exts = ['.mp3', '.wav', '.flac', '.aac', '.m4a', '.ogg', '.wma', '.opus']
            file_ext = Path(material.file_name).suffix.lower()
            
            # Обновляем file_type материала, если он не установлен или неправильный
            if file_ext in video_exts:
                if material.file_type != 'video':
                    material.file_type = 'video'
            elif file_ext in audio_exts:
                if material.file_type != 'audio':
                    material.file_type = 'audio'
            
            if file_ext in video_exts or file_ext in audio_exts:
                # Транскрибация видео или аудио
                logger.info(f"Обработка видео/аудио файла: {material.file_name}")
                if not WHISPER_AVAILABLE:
                    logger.warning(f"Whisper не установлен, пропущено: {material.file_name}")
                    errors.append(f"Whisper не установлен, пропущено: {material.file_name}")
                    continue
                
                try:
                    # Находим FFmpeg
                    logger.info(f"Поиск FFmpeg для файла: {material.file_name}")
                    ffmpeg_path = find_ffmpeg()
                    if not ffmpeg_path:
                        logger.error(f"FFmpeg не найден для файла: {material.file_name}")
                        errors.append(f"FFmpeg не найден, пропущено: {material.file_name}")
                        continue
                    
                    logger.info(f"FFmpeg найден: {ffmpeg_path}")
                    
                    # Убеждаемся, что FFmpeg в PATH
                    ensure_ffmpeg_in_path(ffmpeg_path)
                    
                    # Транскрибируем используя модуль транскрибации в отдельном потоке
                    # чтобы не блокировать event loop
                    logger.info(f"Начало транскрибации файла: {material.file_name} (путь: {file_path})")
                    # Выполняем транскрибацию в отдельном потоке
                    loop = asyncio.get_event_loop()
                    processed_text = await loop.run_in_executor(
                        None,  # Используем ThreadPoolExecutor по умолчанию
                        transcribe_file,
                        file_path,
                        "base"
                    )
                    logger.info(f"Транскрибация завершена: {material.file_name}, длина текста: {len(processed_text) if processed_text else 0} символов")
                    
                except Exception as e:
                    logger.error(f"Ошибка транскрибации {material.file_name}: {e}", exc_info=True)
                    errors.append(f"Ошибка транскрибации {material.file_name}: {str(e)}")
                    continue
            
            elif material.file_type == 'pdf':
                # Парсинг PDF в отдельном потоке
                try:
                    import pdfplumber
                    def parse_pdf():
                        text_parts = []
                        with pdfplumber.open(str(file_path)) as pdf:
                            for page in pdf.pages:
                                text = page.extract_text()
                                if text:
                                    text_parts.append(text)
                        return "\n\n".join(text_parts)
                    
                    loop = asyncio.get_event_loop()
                    processed_text = await loop.run_in_executor(None, parse_pdf)
                    logger.info(f"Распарсен PDF: {material.file_name}")
                    
                except Exception as e:
                    logger.error(f"Ошибка парсинга PDF {material.file_name}: {e}")
                    errors.append(f"Ошибка парсинга PDF {material.file_name}: {str(e)}")
                    continue
            
            elif material.file_name.endswith('.docx') or material.file_name.endswith('.doc'):
                # Парсинг DOCX в отдельном потоке
                try:
                    from docx import Document
                    def parse_docx():
                        doc = Document(str(file_path))
                        text_parts = []
                        for paragraph in doc.paragraphs:
                            if paragraph.text.strip():
                                text_parts.append(paragraph.text)
                        return "\n\n".join(text_parts)
                    
                    loop = asyncio.get_event_loop()
                    processed_text = await loop.run_in_executor(None, parse_docx)
                    logger.info(f"Распарсен DOCX: {material.file_name}")
                    
                except Exception as e:
                    logger.error(f"Ошибка парсинга DOCX {material.file_name}: {e}")
                    errors.append(f"Ошибка парсинга DOCX {material.file_name}: {str(e)}")
                    continue
            
            # Генерируем эмбеддинг для текста, если он есть
            embedding = None
            if processed_text and processed_text.strip():
                try:
                    from app.utils.embeddings import generate_embedding
                    text_for_embedding = processed_text.strip()
                    
                    # Генерируем эмбеддинг в отдельном потоке, чтобы не блокировать event loop
                    loop = asyncio.get_event_loop()
                    embedding = await loop.run_in_executor(
                        None,
                        lambda: generate_embedding(
                            text_for_embedding,
                            use_chunks=True,
                            chunk_size=2000,  # Размер чанка в символах
                            overlap=200       # Перекрытие между чанками
                        )
                    )
                    
                    if embedding:
                        logger.info(f"Сгенерирован эмбеддинг для материала: {material.file_name} (размерность: {len(embedding)}, длина текста: {len(text_for_embedding)} символов)")
                    else:
                        logger.warning(f"Эмбеддинг не был сгенерирован для {material.file_name} (вернулся None)")
                except Exception as e:
                    logger.error(f"Ошибка генерации эмбеддинга для {material.file_name}: {e}", exc_info=True)
            
            # Сохраняем обработанный материал
            processed_material = ProcessedMaterial(
                lecture_id=lecture_id,
                material_id=material.id,
                user_id=current_user.id,  # Кто загрузил материал
                file_url=file_url,
                file_type=material.file_type,
                processed_text=processed_text,
                embedding=embedding,  # Векторное представление
                processed_at=datetime.now().isoformat()
            )
            db.add(processed_material)
            db.flush()  # Сохраняем в БД без коммита
            processed_count += 1
            logger.info(f"Обработан материал: {material.file_name} (тип: {material.file_type})")
            
        except Exception as e:
            logger.error(f"Ошибка обработки материала {material.file_name}: {e}", exc_info=True)
            errors.append(f"Ошибка обработки {material.file_name}: {str(e)}")
            continue
    
    # Публикуем лекцию ТОЛЬКО если ВСЕ материалы успешно обработаны
    if processed_count == len(materials) and len(errors) == 0:
        lecture.published = True
        db.commit()
        logger.info(f"Лекция {lecture_id} успешно опубликована. Обработано: {processed_count}/{len(materials)}")
        
        # Генерируем тест на основе обработанных материалов (2-3 вопроса на файл)
        # Только если generate_test=True и test_generation_mode="once"
        # Генерация теста также выполняется в отдельном потоке
        if lecture.generate_test and lecture.test_generation_mode == "once":
            try:
                from app.utils.rag import generate_questions_from_text
                
                logger.info(f"Начинаем генерацию теста для лекции {lecture_id} (режим: один раз)")
                
                # Получаем обработанные материалы
                processed_materials = db.query(ProcessedMaterial).filter(
                    ProcessedMaterial.lecture_id == lecture_id,
                    ProcessedMaterial.processed_text.isnot(None)
                ).all()
                
                logger.info(f"Найдено обработанных материалов: {len(processed_materials)}")
                
                all_questions = []
                order_index = 0
                
                # Генерируем вопросы для каждого файла отдельно
                for pm in processed_materials:
                    if not pm.processed_text or not pm.processed_text.strip():
                        continue
                    
                    text = pm.processed_text.strip()
                    text_length = len(text)
                    
                    # Определяем количество вопросов в зависимости от длины текста
                    # Короткий текст (< 500 символов) - 2 вопроса
                    # Средний (500-1500) - 2-3 вопроса
                    # Длинный (> 1500) - 3 вопроса
                    if text_length < 500:
                        num_questions = 2
                    elif text_length < 1500:
                        num_questions = 2 if text_length < 1000 else 3
                    else:
                        num_questions = 3
                    
                    logger.info(f"Генерируем {num_questions} вопросов для материала {pm.material_id} (длина: {text_length} символов)")
                    
                    # Генерируем вопросы для этого файла
                    questions_data = generate_questions_from_text(text, num_questions=num_questions)
                    
                    if questions_data and len(questions_data) > 0:
                        # Устанавливаем правильный order_index для каждого вопроса
                        for q_data in questions_data:
                            q_data["order_index"] = order_index
                            order_index += 1
                        all_questions.extend(questions_data)
                        logger.info(f"Добавлено {len(questions_data)} вопросов из материала {pm.material_id}")
                    else:
                        logger.warning(f"Не удалось сгенерировать вопросы для материала {pm.material_id}")
                
                if all_questions and len(all_questions) > 0:
                    logger.info(f"Всего сгенерировано {len(all_questions)} вопросов, создаем тест...")
                    # Создаем тест
                    test = Test(
                        lecture_id=lecture_id,
                        created_at=datetime.now().isoformat()
                    )
                    db.add(test)
                    db.flush()
                    
                    # Создаем вопросы
                    for q_data in all_questions:
                        question = Question(
                            test_id=test.id,
                            question_text=q_data["question_text"],
                            correct_answer=q_data["correct_answer"],
                            options=q_data.get("options"),  # Добавляем варианты ответов
                            question_type=q_data["question_type"],
                            order_index=q_data["order_index"]
                        )
                        db.add(question)
                    
                    db.commit()
                    logger.info(f"✅ Создан тест из {len(all_questions)} вопросов для лекции {lecture_id}")
                else:
                    logger.warning(f"⚠️ Не удалось сгенерировать вопросы для лекции {lecture_id}")
            except Exception as e:
                logger.error(f"❌ Ошибка генерации теста для лекции {lecture_id}: {e}", exc_info=True)
                import traceback
                logger.error(f"Traceback: {traceback.format_exc()}")
                # Не прерываем публикацию, если тест не создался
        else:
            if lecture.generate_test:
                logger.info(f"Тест для лекции {lecture_id} будет генерироваться для каждого студента отдельно")
        
        return JSONResponse({
            "message": f"Лекция опубликована. Обработано материалов: {processed_count}/{len(materials)}",
            "processed_count": processed_count,
            "total_count": len(materials),
            "errors": None,
            "published": True
        })
    else:
        # Откатываем изменения, если не все материалы обработаны
        db.rollback()
        logger.warning(f"Не удалось обработать все материалы для лекции {lecture_id}. Обработано: {processed_count}/{len(materials)}")
        raise HTTPException(
            status_code=400, 
            detail=f"Не удалось обработать все материалы. Обработано: {processed_count}/{len(materials)}. Ошибки: {', '.join(errors) if errors else 'Неизвестная ошибка'}"
        )
    

