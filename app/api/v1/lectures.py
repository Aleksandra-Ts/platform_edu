"""API эндпоинты для работы с лекциями"""
import os
import shutil
import logging
from datetime import datetime
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from app.core.database import get_db
from app.core.security import get_current_user
from app.models import Course, Lecture, LectureMaterial, User
from app.schemas import CreateLectureRequest, LectureResponse

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
    # Проверяем, что курс существует и пользователь является преподавателем этого курса
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    
    # Проверяем, что пользователь является преподавателем курса
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Доступ разрешен только преподавателям")
    
    teacher_ids = [t.id for t in course.teachers]
    if current_user.id not in teacher_ids:
        raise HTTPException(status_code=403, detail="Вы не являетесь преподавателем этого курса")
    
    lectures = db.query(Lecture).filter(Lecture.course_id == course_id).all()
    
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
        materials=[{
            "id": m.id,
            "file_path": m.file_path,
            "file_type": m.file_type,
            "file_name": m.file_name,
            "file_size": m.file_size,
            "order_index": m.order_index
        } for m in materials]
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
        created_at=datetime.now().isoformat()
    )
    
    db.add(lecture)
    db.commit()
    db.refresh(lecture)
    
    return LectureResponse(
        id=lecture.id,
        course_id=lecture.course_id,
        name=lecture.name,
        description=lecture.description,
        created_at=lecture.created_at,
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
    
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Доступ разрешен только преподавателям")
    
    teacher_ids = [t.id for t in course.teachers]
    if current_user.id not in teacher_ids:
        raise HTTPException(status_code=403, detail="Вы не являетесь преподавателем этого курса")
    
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
    # Преобразуем абсолютный путь в относительный от корня проекта
    relative_path = file_path.relative_to(Path.cwd())
    relative_path_str = str(relative_path).replace('\\', '/')
    
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
    
    # Проверяем права доступа (преподаватель курса или студент группы)
    if current_user.role == "teacher":
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
    # file_path может быть относительным (uploads/lectures/...) или абсолютным
    file_path = Path(material.file_path)
    if not file_path.is_absolute():
        # Если путь относительный, строим полный путь от корня проекта
        file_path = Path.cwd() / file_path
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"Файл не найден: {file_path}")
    
    # Парсим файл каждый раз при запросе (без кэширования)
    content = None
    error = None
    
    try:
        if material.file_type == 'pdf':
            # Парсим PDF каждый раз
            content = parse_pdf(file_path)
        elif material.file_name.endswith('.docx') or material.file_name.endswith('.doc'):
            # Парсим Word документ каждый раз
            content = parse_docx(file_path)
        elif material.file_type == 'presentation':
            # Для презентаций пока возвращаем информацию о файле
            content = f"Презентация: {material.file_name}\nДля просмотра откройте файл напрямую."
        else:
            content = f"Файл: {material.file_name}\nТекстовое содержимое недоступно для этого типа файла."
    except Exception as e:
        error = str(e)
        content = None
        logger.error(f"Ошибка парсинга файла {material.file_name}: {e}", exc_info=True)
    
    return JSONResponse({
        "content": content,
        "error": error,
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
    
    # Проверяем права доступа (преподаватель курса или студент группы)
    if current_user.role == "teacher":
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

