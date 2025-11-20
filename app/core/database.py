"""Настройки базы данных"""
import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import DATABASE_URL

logger = logging.getLogger(__name__)

# Создание движка и сессии
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """Dependency для получения сессии БД"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_user_schema():
    """Обеспечивает наличие необходимых колонок в таблице users"""
    with engine.connect() as conn:
        conn.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR")
        )
        conn.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR")
        )
        conn.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS middle_name VARCHAR")
        )
        conn.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS temporary_password VARCHAR")
        )
        conn.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES groups(id)")
        )
        conn.commit()


# Создание таблиц
Base.metadata.create_all(bind=engine)
ensure_user_schema()

def ensure_courses_schema():
    """Обеспечивает наличие таблицы courses"""
    with engine.connect() as conn:
        # Создаем таблицу courses, если её нет
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS courses (
                id SERIAL PRIMARY KEY,
                name VARCHAR NOT NULL,
                description TEXT
            )
        """))
        # Создаем связующие таблицы, если их нет
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS course_groups (
                course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
                group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
                PRIMARY KEY (course_id, group_id)
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS course_teachers (
                course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
                teacher_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                PRIMARY KEY (course_id, teacher_id)
            )
        """))
        conn.commit()

ensure_courses_schema()

def ensure_lectures_schema():
    """Обеспечивает наличие таблиц для лекций"""
    with engine.connect() as conn:
        # Создаем таблицу lectures, если её нет
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS lectures (
                id SERIAL PRIMARY KEY,
                course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
                name VARCHAR NOT NULL,
                description TEXT,
                created_at VARCHAR
            )
        """))
        # Создаем таблицу lecture_materials, если её нет
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS lecture_materials (
                id SERIAL PRIMARY KEY,
                lecture_id INTEGER REFERENCES lectures(id) ON DELETE CASCADE NOT NULL,
                file_path VARCHAR NOT NULL,
                file_type VARCHAR NOT NULL,
                file_name VARCHAR NOT NULL,
                file_size INTEGER,
                order_index INTEGER DEFAULT 0
            )
        """))
        # Добавляем столбец order_index, если его нет (для существующих таблиц)
        try:
            conn.execute(text("""
                ALTER TABLE lecture_materials 
                ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0
            """))
        except Exception as e:
            # Игнорируем ошибку, если столбец уже существует
            logger.debug(f"Column order_index may already exist: {e}")
        conn.commit()

ensure_lectures_schema()

