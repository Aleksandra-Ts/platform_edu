"""Конфигурация приложения"""
import os

# Настройки для JWT
SECRET_KEY = os.getenv("SECRET_KEY", "secret")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Настройки для PostgreSQL
# В Docker используем имя сервиса 'db', локально - 'localhost'
# DATABASE_URL должен быть установлен через переменную окружения в docker-compose.yml
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/edu_platform"  # По умолчанию для локальной разработки
)

