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
        # Проверяем, существует ли таблица users
        result = conn.execute(text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'users'
            )
        """))
        table_exists = result.scalar()
        
        if not table_exists:
            # Таблица еще не создана, пропускаем добавление колонок
            # SQLAlchemy создаст таблицу через Base.metadata.create_all()
            return
        
        # Добавляем колонки только если таблица существует
        try:
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
        except Exception as e:
            logger.debug(f"Ошибка при добавлении колонок в users: {e}")
            conn.rollback()


def ensure_courses_schema():
    """Обеспечивает наличие дополнительных колонок в таблице courses"""
    # Таблицы создаются через SQLAlchemy, здесь только добавляем колонки если нужно
    pass

def ensure_lectures_schema():
    """Обеспечивает наличие дополнительных колонок и расширений для лекций"""
    with engine.connect() as conn:
        # Создаем расширение pgvector, если его нет
        try:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            conn.commit()
        except Exception as e:
            logger.debug(f"pgvector extension may already exist: {e}")
            conn.rollback()
        
        # Проверяем существование таблиц перед добавлением колонок
        tables_to_check = ['lectures', 'lecture_materials', 'processed_materials', 'tests', 'questions']
        for table_name in tables_to_check:
            result = conn.execute(text(f"""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = '{table_name}'
                )
            """))
            if not result.scalar():
                logger.debug(f"Таблица {table_name} еще не создана, пропускаем")
                continue
            
            # Добавляем колонки для lectures
            if table_name == 'lectures':
                try:
                    conn.execute(text("""
                        ALTER TABLE lectures 
                        ADD COLUMN IF NOT EXISTS published BOOLEAN DEFAULT FALSE
                    """))
                except Exception as e:
                    logger.debug(f"Column published may already exist: {e}")
                
                try:
                    conn.execute(text("""
                        ALTER TABLE lectures 
                        ADD COLUMN IF NOT EXISTS generate_test BOOLEAN DEFAULT FALSE
                    """))
                except Exception as e:
                    logger.debug(f"Column generate_test may already exist: {e}")
                
                try:
                    conn.execute(text("""
                        ALTER TABLE lectures 
                        ADD COLUMN IF NOT EXISTS test_generation_mode VARCHAR DEFAULT 'once'
                    """))
                except Exception as e:
                    logger.debug(f"Column test_generation_mode may already exist: {e}")
                
                try:
                    conn.execute(text("""
                        ALTER TABLE lectures 
                        ADD COLUMN IF NOT EXISTS test_max_attempts INTEGER DEFAULT 1
                    """))
                except Exception as e:
                    logger.debug(f"Column test_max_attempts may already exist: {e}")
                
                try:
                    conn.execute(text("""
                        ALTER TABLE lectures 
                        ADD COLUMN IF NOT EXISTS test_show_answers BOOLEAN DEFAULT FALSE
                    """))
                except Exception as e:
                    logger.debug(f"Column test_show_answers may already exist: {e}")
                
                try:
                    conn.execute(text("""
                        ALTER TABLE lectures 
                        ADD COLUMN IF NOT EXISTS test_deadline VARCHAR
                    """))
                except Exception as e:
                    logger.debug(f"Column test_deadline may already exist: {e}")
            
            # Добавляем колонки для lecture_materials
            if table_name == 'lecture_materials':
                try:
                    conn.execute(text("""
                        ALTER TABLE lecture_materials 
                        ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0
                    """))
                except Exception as e:
                    logger.debug(f"Column order_index may already exist: {e}")
            
            # Добавляем колонки для processed_materials
            if table_name == 'processed_materials':
                try:
                    conn.execute(text("""
                        ALTER TABLE processed_materials 
                        ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL
                    """))
                except Exception as e:
                    logger.debug(f"Column user_id may already exist: {e}")
                
                try:
                    # Изменяем размерность вектора с 384 на 1024 для GigaChat Embeddings
                    # Сначала проверяем текущую размерность
                    result = conn.execute(text("""
                        SELECT column_name, data_type, udt_name
                        FROM information_schema.columns
                        WHERE table_name = 'processed_materials' 
                        AND column_name = 'embedding'
                    """))
                    col_info = result.fetchone()
                    
                    if col_info:
                        # Колонка существует, проверяем размерность
                        result = conn.execute(text("""
                            SELECT typname, typlen
                            FROM pg_type
                            WHERE oid = (
                                SELECT atttypid
                                FROM pg_attribute
                                WHERE attrelid = 'processed_materials'::regclass
                                AND attname = 'embedding'
                            )
                        """))
                        type_info = result.fetchone()
                        
                        # Если размерность не 1024, нужно изменить
                        # Для этого сначала удаляем старую колонку и создаем новую
                        # (ALTER TYPE vector не поддерживает изменение размерности напрямую)
                        conn.execute(text("""
                            ALTER TABLE processed_materials 
                            DROP COLUMN IF EXISTS embedding
                        """))
                        conn.execute(text("""
                            ALTER TABLE processed_materials 
                            ADD COLUMN embedding vector(1024)
                        """))
                    else:
                        # Колонка не существует, создаем с размерностью 1024
                        conn.execute(text("""
                            ALTER TABLE processed_materials 
                            ADD COLUMN embedding vector(1024)
                        """))
                except Exception as e:
                    logger.debug(f"Column embedding may already exist or error: {e}")
                
                # Создаем индекс для векторного поиска (размерность 1024 для GigaChat)
                try:
                    # Удаляем старый индекс, если он существует (на случай изменения размерности)
                    conn.execute(text("""
                        DROP INDEX IF EXISTS processed_materials_embedding_idx
                    """))
                    # Создаем новый индекс для векторов размерности 1024
                    conn.execute(text("""
                        CREATE INDEX IF NOT EXISTS processed_materials_embedding_idx 
                        ON processed_materials 
                        USING ivfflat (embedding vector_cosine_ops)
                        WITH (lists = 100)
                    """))
                except Exception as e:
                    logger.debug(f"Vector index may already exist: {e}")
            
            # Таблицы tests, questions и test_attempts создаются через SQLAlchemy, проверяем только существование
            if table_name == 'tests' or table_name == 'questions' or table_name == 'test_attempts':
                # Таблицы создаются автоматически через SQLAlchemy
                pass
            
            # Добавляем колонку user_id в таблицу tests, если её нет
            if table_name == 'tests':
                try:
                    conn.execute(text("""
                        ALTER TABLE tests 
                        ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL
                    """))
                except Exception as e:
                    logger.debug(f"Column user_id in tests may already exist: {e}")
        
        conn.commit()

# Инициализация базы данных
def init_database():
    """Инициализирует базу данных: создает таблицы и обновляет схему"""
    try:
        # Проверяем подключение к базе данных
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info("Подключение к базе данных успешно")
    except Exception as e:
        logger.error(f"Не удалось подключиться к базе данных: {e}")
        raise
    
    try:
        # Создаем расширение pgvector ПЕРЕД созданием таблиц
        with engine.connect() as conn:
            try:
                conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
                conn.commit()
                logger.info("Расширение pgvector создано/проверено")
            except Exception as e:
                logger.warning(f"Не удалось создать расширение pgvector (может быть уже создано): {e}")
                conn.rollback()
        
        # Импортируем все модели, чтобы они были зарегистрированы в Base.metadata
        # Это должно быть сделано до create_all()
        import app.models  # Импортируем модуль, чтобы модели зарегистрировались
        
        # Создаем все таблицы через SQLAlchemy
        Base.metadata.create_all(bind=engine)
        logger.info("Таблицы созданы через SQLAlchemy")
        
        # Небольшая задержка для гарантии, что таблицы созданы
        import time
        time.sleep(0.5)
        
        # Затем обновляем схему (добавляем колонки, если нужно)
        ensure_user_schema()
        ensure_courses_schema()
        ensure_lectures_schema()
        logger.info("Схема базы данных обновлена")
        
        # Проверяем, что таблица users существует
        with engine.connect() as conn:
            result = conn.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'users'
                )
            """))
            if not result.scalar():
                logger.error("Таблица users не была создана!")
                raise Exception("Таблица users не существует после create_all()")
            logger.info("Таблица users существует")
    except Exception as e:
        logger.error(f"Ошибка инициализации базы данных: {e}", exc_info=True)
        raise

# НЕ инициализируем базу данных при импорте модуля
# Инициализация будет вызвана явно в main.py после импорта всех моделей

