"""Утилиты для генерации эмбеддингов текста через GigaChat Embeddings API"""
import os
import logging
import threading
from typing import List, Optional
import numpy as np

logger = logging.getLogger(__name__)

# Семафор для ограничения одновременных запросов к GigaChat API (максимум 10)
_gigachat_semaphore = threading.Semaphore(10)

# Попытка импортировать GigaChatEmbeddings
try:
    from langchain_community.embeddings import GigaChatEmbeddings
    GIGACHAT_AVAILABLE = True
except ImportError:
    GIGACHAT_AVAILABLE = False
    logger.warning("langchain_community не установлен. Эмбеддинги через GigaChat будут недоступны.")

# Глобальная переменная для модели (ленивая загрузка)
_embedding_model = None


def get_embedding_model() -> Optional[GigaChatEmbeddings]:
    """
    Создаёт модель эмбеддингов для поиска через GigaChat API.
    
    Returns:
        GigaChatEmbeddings или None в случае ошибки
    """
    global _embedding_model
    
    if not GIGACHAT_AVAILABLE:
        logger.warning("GigaChat Embeddings недоступен. Установите langchain-community.")
        return None
    
    if _embedding_model is None:
        try:
            from app.core.config import GIGA_API_KEY, GIGACHAT_EMBEDDINGS_MODEL, GIGACHAT_SCOPE
            
            if not GIGA_API_KEY:
                logger.error("GIGA_API_KEY не установлен в переменных окружения")
                return None
            
            _embedding_model = GigaChatEmbeddings(
                credentials=GIGA_API_KEY,
                model=GIGACHAT_EMBEDDINGS_MODEL,
                scope=GIGACHAT_SCOPE,
                verify_ssl_certs=False,
            )
            logger.info("Модель GigaChat Embeddings инициализирована")
        except Exception as e:
            logger.error(f"Ошибка инициализации GigaChat Embeddings: {e}")
            return None
    
    return _embedding_model


def split_text_into_chunks(text: str, chunk_size: int = 2000, overlap: int = 200) -> List[str]:
    """
    Разбивает текст на чанки с перекрытием.
    
    Args:
        text: Исходный текст
        chunk_size: Размер чанка в символах
        overlap: Размер перекрытия между чанками в символах
        
    Returns:
        Список чанков текста
    """
    if not text or len(text) <= chunk_size:
        return [text] if text else []
    
    chunks = []
    start = 0
    
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        
        # Пытаемся разбить по предложениям (точка, восклицательный знак, вопросительный)
        if end < len(text):
            # Ищем последнее предложение в чанке
            for sep in ['. ', '! ', '? ', '\n\n', '\n']:
                last_sep = chunk.rfind(sep)
                if last_sep > chunk_size * 0.5:  # Если разделитель в первой половине
                    chunk = chunk[:last_sep + len(sep)]
                    end = start + len(chunk)
                    break
        
        chunks.append(chunk.strip())
        
        # Переходим к следующему чанку с перекрытием
        start = end - overlap
        if start >= len(text):
            break
    
    return chunks


def generate_embedding(text: str, use_chunks: bool = True, chunk_size: int = 2000, overlap: int = 200) -> Optional[List[float]]:
    """
    Генерирует эмбеддинг для текста через GigaChat Embeddings API.
    Для длинных текстов разбивает на чанки и усредняет эмбеддинги.
    
    Args:
        text: Текст для векторизации
        use_chunks: Использовать ли разбиение на чанки для длинных текстов
        chunk_size: Размер чанка в символах (если use_chunks=True)
        overlap: Размер перекрытия между чанками в символах
        
    Returns:
        Список из 1024 чисел (эмбеддинг) или None в случае ошибки
    """
    if not text or not text.strip():
        return None
    
    model = get_embedding_model()
    if model is None:
        logger.warning("Модель эмбеддингов недоступна")
        return None
    
    try:
        text = text.strip()
        
        # Если текст короткий или не используем чанки - генерируем напрямую
        if not use_chunks or len(text) <= chunk_size:
            # Ограничиваем одновременные запросы к GigaChat через семафор
            with _gigachat_semaphore:
                embedding = model.embed_query(text)
            if len(embedding) != 1024:
                logger.warning(f"Неожиданная размерность эмбеддинга: {len(embedding)}, ожидалось 1024")
            return embedding
        
        # Для длинных текстов разбиваем на чанки
        chunks = split_text_into_chunks(text, chunk_size, overlap)
        logger.info(f"Текст разбит на {len(chunks)} чанков для генерации эмбеддингов")
        
        embeddings = []
        for i, chunk in enumerate(chunks):
            try:
                # Ограничиваем одновременные запросы к GigaChat через семафор
                with _gigachat_semaphore:
                    chunk_embedding = model.embed_query(chunk)
                if chunk_embedding and len(chunk_embedding) == 1024:
                    embeddings.append(chunk_embedding)
                    logger.debug(f"Сгенерирован эмбеддинг для чанка {i+1}/{len(chunks)}")
            except Exception as e:
                logger.warning(f"Ошибка генерации эмбеддинга для чанка {i+1}: {e}")
                continue
        
        if not embeddings:
            logger.error("Не удалось сгенерировать эмбеддинги ни для одного чанка")
            return None
        
        # Если один чанк - возвращаем его эмбеддинг
        if len(embeddings) == 1:
            return embeddings[0]
        
        # Суммируем эмбеддинги всех чанков
        embeddings_array = np.array(embeddings)
        sum_embedding = np.sum(embeddings_array, axis=0)
        
        # Нормализуем результат (L2 нормализация)
        norm = np.linalg.norm(sum_embedding)
        if norm > 0:
            normalized_embedding = (sum_embedding / norm).tolist()
        else:
            normalized_embedding = sum_embedding.tolist()
        
        logger.info(f"Суммированы и нормализованы эмбеддинги из {len(embeddings)} чанков")
        return normalized_embedding
        
    except Exception as e:
        logger.error(f"Ошибка генерации эмбеддинга через GigaChat: {e}", exc_info=True)
        return None


def generate_embeddings_batch(texts: List[str]) -> List[Optional[List[float]]]:
    """
    Генерирует эмбеддинги для списка текстов (батч-обработка) через GigaChat API.
    
    Args:
        texts: Список текстов для векторизации
        
    Returns:
        Список эмбеддингов (каждый элемент - список из 1024 чисел или None)
    """
    if not texts:
        return []
    
    model = get_embedding_model()
    if model is None:
        logger.warning("Модель эмбеддингов недоступна")
        return [None] * len(texts)
    
    try:
        # Фильтруем пустые тексты
        non_empty_texts = [t for t in texts if t and t.strip()]
        if not non_empty_texts:
            return [None] * len(texts)
        
        # Генерируем эмбеддинги батчем через GigaChat API
        # Ограничиваем одновременные запросы к GigaChat через семафор
        with _gigachat_semaphore:
            embeddings = model.embed_documents(non_empty_texts)
        
        # Преобразуем в список списков
        result = []
        text_idx = 0
        for text in texts:
            if text and text.strip():
                embedding = embeddings[text_idx]
                # Проверяем размерность
                if len(embedding) != 1024:
                    logger.warning(f"Неожиданная размерность эмбеддинга: {len(embedding)}, ожидалось 1024")
                result.append(embedding)
                text_idx += 1
            else:
                result.append(None)
        
        return result
    except Exception as e:
        logger.error(f"Ошибка генерации эмбеддингов батчем через GigaChat: {e}")
        return [None] * len(texts)
