"""SQLAlchemy модели"""
from sqlalchemy import Boolean, Column, Enum, ForeignKey, Integer, String, Table, Text
from sqlalchemy.orm import relationship

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
    
    # Связь с курсом
    course = relationship("Course", back_populates="lectures")
    
    # Материалы лекции (храним пути к файлам)
    materials = relationship("LectureMaterial", back_populates="lecture", cascade="all, delete-orphan")


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

