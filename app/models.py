"""SQLAlchemy модели"""
from sqlalchemy import Boolean, Column, Enum, ForeignKey, Integer, String, Table, Text
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector

from app.core.database import Base

# Связующие таблицы для many-to-many
course_groups = Table(
    'course_groups',
    Base.metadata,
    Column('course_id', Integer, ForeignKey('courses.id'), primary_key=True),
    Column('group_id', Integer, ForeignKey('groups.id'), primary_key=True)
)

course_teachers = Table(
    'course_teachers',
    Base.metadata,
    Column('course_id', Integer, ForeignKey('courses.id'), primary_key=True),
    Column('teacher_id', Integer, ForeignKey('users.id'), primary_key=True)
)


class Group(Base):
    """Модель группы"""
    __tablename__ = "groups"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    
    # Связи с курсами
    courses = relationship("Course", secondary=course_groups, back_populates="groups")


class User(Base):
    """Модель пользователя"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    login = Column(String, unique=True, index=True)
    password_hash = Column(String)
    temporary_password = Column(String, nullable=True)
    full_name = Column(String)
    last_name = Column(String, nullable=True)
    first_name = Column(String, nullable=True)
    middle_name = Column(String, nullable=True)
    role = Column(Enum('teacher', 'student', 'admin', name='role_enum'))
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=True)
    is_temporary = Column(Boolean, default=True)
    is_password_changed = Column(Boolean, default=False)
    
    # Связи с курсами (для преподавателей)
    courses_taught = relationship("Course", secondary=course_teachers, back_populates="teachers")


class Course(Base):
    """Модель курса"""
    __tablename__ = "courses"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    
    # Many-to-many связи
    groups = relationship("Group", secondary=course_groups, back_populates="courses")
    teachers = relationship("User", secondary=course_teachers, back_populates="courses_taught")
    
    # Связи с лекциями
    lectures = relationship("Lecture", back_populates="course", cascade="all, delete-orphan")


class Lecture(Base):
    """Модель лекции"""
    __tablename__ = "lectures"
    
    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(String)  # Будем хранить как строку для простоты
    published = Column(Boolean, default=False)  # Опубликована ли лекция для студентов
    generate_test = Column(Boolean, default=False)  # Генерировать ли тест для лекции
    test_generation_mode = Column(String, default="once")  # "once" - один раз, "per_student" - для каждого студента
    test_max_attempts = Column(Integer, default=1)  # Максимальное количество попыток для студента
    test_show_answers = Column(Boolean, default=False)  # Показывать ли правильные ответы после всех попыток
    test_deadline = Column(String, nullable=True)  # Дедлайн выполнения теста (ISO формат: YYYY-MM-DDTHH:MM:SS)
    
    # Связь с курсом
    course = relationship("Course", back_populates="lectures")
    
    # Материалы лекции (храним пути к файлам)
    materials = relationship("LectureMaterial", back_populates="lecture", cascade="all, delete-orphan")
    
    # Обработанные материалы (транскрипты, парсинг)
    processed_materials = relationship("ProcessedMaterial", back_populates="lecture", cascade="all, delete-orphan")
    
    # Тесты для лекции
    tests = relationship("Test", back_populates="lecture", cascade="all, delete-orphan")


class LectureMaterial(Base):
    """Модель материала лекции"""
    __tablename__ = "lecture_materials"
    
    id = Column(Integer, primary_key=True, index=True)
    lecture_id = Column(Integer, ForeignKey("lectures.id", ondelete="CASCADE"), nullable=False)
    file_path = Column(String, nullable=False)
    file_type = Column(String, nullable=False)  # video, pdf, presentation, audio, scorm
    file_name = Column(String, nullable=False)
    file_size = Column(Integer, nullable=True)  # Размер файла в байтах
    order_index = Column(Integer, default=0)  # Порядок отображения материалов
    
    # Связь с лекцией
    lecture = relationship("Lecture", back_populates="materials")


class ProcessedMaterial(Base):
    """Модель обработанного материала (транскрипты, парсинг, эмбеддинги для RAG)"""
    __tablename__ = "processed_materials"
    
    id = Column(Integer, primary_key=True, index=True)
    lecture_id = Column(Integer, ForeignKey("lectures.id", ondelete="CASCADE"), nullable=False)
    material_id = Column(Integer, ForeignKey("lecture_materials.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)  # Кто загрузил материал
    file_url = Column(String, nullable=False)  # URL файла
    file_type = Column(String, nullable=False)  # video, pdf, presentation, audio, scorm
    processed_text = Column(Text, nullable=True)  # Транскрипт или распарсенный текст
    embedding = Column(Vector(1024), nullable=True)  # Векторное представление текста (1024 размерность для GigaChat Embeddings)
    processed_at = Column(String)  # Дата обработки
    
    # Связи
    lecture = relationship("Lecture", back_populates="processed_materials")
    material = relationship("LectureMaterial")
    user = relationship("User")


class Test(Base):
    """Модель теста для лекции"""
    __tablename__ = "tests"
    
    id = Column(Integer, primary_key=True, index=True)
    lecture_id = Column(Integer, ForeignKey("lectures.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(String)  # Дата создания
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)  # Для режима "per_student"
    
    # Связи
    lecture = relationship("Lecture", back_populates="tests")
    questions = relationship("Question", back_populates="test", cascade="all, delete-orphan")
    attempts = relationship("TestAttempt", back_populates="test", cascade="all, delete-orphan")


class Question(Base):
    """Модель вопроса в тесте"""
    __tablename__ = "questions"
    
    id = Column(Integer, primary_key=True, index=True)
    test_id = Column(Integer, ForeignKey("tests.id", ondelete="CASCADE"), nullable=False)
    question_text = Column(Text, nullable=False)  # Текст вопроса
    correct_answer = Column(Text, nullable=False)  # Правильный ответ
    options = Column(Text, nullable=True)  # JSON строка с вариантами ответов (если есть)
    question_type = Column(String, default="open")  # open, multiple_choice
    order_index = Column(Integer, default=0)  # Порядок вопроса в тесте
    
    # Связи
    test = relationship("Test", back_populates="questions")


class TestAttempt(Base):
    """Модель попытки прохождения теста студентом"""
    __tablename__ = "test_attempts"
    
    id = Column(Integer, primary_key=True, index=True)
    test_id = Column(Integer, ForeignKey("tests.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    answers = Column(Text, nullable=False)  # JSON строка с ответами студента
    score = Column(Integer, nullable=False)  # Количество правильных ответов
    total_questions = Column(Integer, nullable=False)  # Общее количество вопросов
    completed_at = Column(String, nullable=False)  # Дата и время завершения попытки (ISO формат)
    
    # Связи
    test = relationship("Test", back_populates="attempts")
    user = relationship("User")

