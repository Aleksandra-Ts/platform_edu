"""Конфигурация приложения"""
import os
import logging

logger = logging.getLogger(__name__)

# ============================================
# БАЗА ДАННЫХ
# ============================================
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/edu_platform"
)

# ============================================
# БЕЗОПАСНОСТЬ
# ============================================
SECRET_KEY = os.getenv("SECRET_KEY", "secret")
if SECRET_KEY == "secret":
    logger.warning("⚠️  SECRET_KEY использует значение по умолчанию! Это небезопасно для продакшена!")

ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

# ============================================
# GIGACHAT API
# ============================================
GIGA_API_KEY = os.getenv("GIGA_API_KEY", "")
GIGACHAT_MODEL = os.getenv("GIGACHAT_MODEL", "GigaChat")
GIGACHAT_SCOPE = os.getenv("GIGACHAT_SCOPE", "GIGACHAT_API_CORP")
GIGACHAT_TEMPERATURE = float(os.getenv("GIGACHAT_TEMPERATURE", "0.7"))
GIGACHAT_EMBEDDINGS_MODEL = os.getenv("GIGACHAT_EMBEDDINGS_MODEL", "Embeddings")

# ============================================
# WHISPER (ТРАНСКРИБАЦИЯ)
# ============================================
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "base")
WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
WHISPER_COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")

# ============================================
# ПРИЛОЖЕНИЕ
# ============================================
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
LOG_LEVEL = os.getenv("LOG_LEVEL", "DEBUG")

# ============================================
# CORS
# ============================================
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")

