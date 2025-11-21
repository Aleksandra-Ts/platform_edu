"""Pydantic схемы для валидации данных"""
from typing import Optional
from pydantic import BaseModel, Field, validator


class ChangePasswordRequest(BaseModel):
    """Схема для смены временного пароля"""
    new_password: str = Field(..., min_length=8, max_length=128)
    confirm_password: str = Field(..., min_length=8, max_length=128)

    @validator("confirm_password")
    def passwords_match(cls, value: str, values: dict) -> str:
        new_password = values.get("new_password")
        if new_password is not None and value != new_password:
            raise ValueError("Пароли не совпадают")
        return value


class CreateUserRequest(BaseModel):
    """Схема для создания пользователя"""
    login: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=1, max_length=128)
    last_name: str = Field(..., min_length=1, max_length=100)
    first_name: str = Field(..., min_length=1, max_length=100)
    middle_name: Optional[str] = Field(None, max_length=100)
    role: str
    group_id: Optional[int] = None

    @validator("role")
    def validate_role(cls, value: str) -> str:
        allowed = {"teacher", "student", "admin"}
        if value not in allowed:
            raise ValueError("Некорректная роль")
        return value

    @validator("group_id", pre=True, always=True)
    def normalize_group_id(cls, value):
        if value in (None, "", "null"):
            return None
        return int(value)

    @validator("group_id")
    def require_group_for_students(cls, value: Optional[int], values: dict) -> Optional[int]:
        role = values.get("role")
        if role == "student" and value is None:
            raise ValueError("Группа обязательна для студентов")
        return value


class UserResponse(BaseModel):
    """Схема ответа с данными пользователя"""
    id: int
    login: str
    role: str
    last_name: Optional[str]
    first_name: Optional[str]
    middle_name: Optional[str]
    is_temporary: bool
    is_password_changed: bool
    full_name: str
    temporary_password: Optional[str]
    group_id: Optional[int]
    group_name: Optional[str]


class UpdateUserGroupRequest(BaseModel):
    """Схема для обновления группы студента"""
    group_id: Optional[int] = None


class SetTemporaryPasswordRequest(BaseModel):
    """Схема для установки временного пароля"""
    password: Optional[str] = Field(None, min_length=1, max_length=128)


class GroupCreateRequest(BaseModel):
    """Схема для создания группы"""
    name: str = Field(..., min_length=1, max_length=100)


class GroupResponse(BaseModel):
    """Схема ответа с данными группы"""
    id: int
    name: str


class UpdateProfileRequest(BaseModel):
    """Схема для обновления профиля"""
    last_name: str = Field(..., min_length=1, max_length=100)
    first_name: str = Field(..., min_length=1, max_length=100)
    middle_name: Optional[str] = Field(None, max_length=100)


class ChangeOwnPasswordRequest(BaseModel):
    """Схема для смены собственного пароля"""
    current_password: str = Field(..., min_length=1, max_length=128)
    new_password: str = Field(..., min_length=8, max_length=128)
    confirm_password: str = Field(..., min_length=8, max_length=128)

    @validator("confirm_password")
    def passwords_match(cls, value: str, values: dict) -> str:
        new_password = values.get("new_password")
        if new_password is not None and value != new_password:
            raise ValueError("Пароли не совпадают")
        return value


class CreateCourseRequest(BaseModel):
    """Схема для создания курса"""
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    group_ids: list[int] = Field(default_factory=list)
    teacher_ids: list[int] = Field(default_factory=list)


class UpdateCourseRequest(BaseModel):
    """Схема для обновления курса"""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    group_ids: Optional[list[int]] = None
    teacher_ids: Optional[list[int]] = None


class CourseResponse(BaseModel):
    """Схема ответа с данными курса"""
    id: int
    name: str
    description: Optional[str]
    group_ids: list[int]
    group_names: list[str]
    teacher_ids: list[int]
    teacher_names: list[str]

    class Config:
        from_attributes = True


class LectureMaterialResponse(BaseModel):
    """Схема ответа с данными материала лекции"""
    id: int
    file_path: str
    file_type: str
    file_name: str
    file_size: Optional[int]
    order_index: int = 0

    class Config:
        from_attributes = True


class CreateLectureRequest(BaseModel):
    """Схема для создания лекции"""
    course_id: int
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=2000)


class LectureResponse(BaseModel):
    """Схема ответа с данными лекции"""
    id: int
    course_id: int
    name: str
    description: Optional[str]
    created_at: Optional[str]
    published: bool = False
    materials: list[LectureMaterialResponse] = Field(default_factory=list)

    class Config:
        from_attributes = True


class ProcessedMaterialResponse(BaseModel):
    """Схема ответа с данными обработанного материала"""
    id: int
    material_id: int
    file_url: str
    file_type: str
    processed_text: Optional[str]
    processed_at: Optional[str]

    class Config:
        from_attributes = True
