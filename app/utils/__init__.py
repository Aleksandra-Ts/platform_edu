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

# Импортируем функции для эмбеддингов
from app.utils.embeddings import (
    generate_embedding,
    generate_embeddings_batch,
    get_embedding_model,
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
    "generate_embedding",
    "generate_embeddings_batch",
    "get_embedding_model",
]

