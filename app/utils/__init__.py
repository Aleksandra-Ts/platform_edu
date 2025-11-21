"""Утилиты для приложения"""
# Импортируем вспомогательные функции
from app.utils.helpers import (
    build_user_response,
    compose_full_name,
    normalize_name,
    resolve_user_names,
    create_default_admin,
)

# Импортируем функции транскрибации
from app.utils.transcription import (
    transcribe_file,
    find_ffmpeg,
    ensure_ffmpeg_in_path,
    WHISPER_AVAILABLE,
)

__all__ = [
    "build_user_response",
    "compose_full_name",
    "normalize_name",
    "resolve_user_names",
    "create_default_admin",
    "transcribe_file",
    "find_ffmpeg",
    "ensure_ffmpeg_in_path",
    "WHISPER_AVAILABLE",
]

