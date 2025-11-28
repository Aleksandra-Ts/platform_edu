"""Утилиты для RAG (Retrieval-Augmented Generation) и генерации вопросов"""
import logging
import threading
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import text
import json

logger = logging.getLogger(__name__)

# Семафор для ограничения одновременных запросов к GigaChat API (максимум 10)
_gigachat_semaphore = threading.Semaphore(10)

# Попытка импортировать GigaChat для генерации вопросов
GIGACHAT_CHAT_AVAILABLE = False
try:
    from langchain_gigachat import GigaChat
    GIGACHAT_CHAT_AVAILABLE = True
except ImportError:
    try:
        from langchain_community.chat_models import GigaChat
        GIGACHAT_CHAT_AVAILABLE = True
    except ImportError:
        logger.warning("GigaChat Chat не установлен. Генерация вопросов будет недоступна.")


def search_similar_materials(
    db: Session,
    query_embedding: List[float],
    lecture_id: int,
    limit: int = 5
) -> List[Dict[str, Any]]:
    """
    Поиск похожих материалов по эмбеддингу запроса (RAG поиск).
    
    Args:
        db: Сессия базы данных
        query_embedding: Эмбеддинг запроса (список из 1024 чисел)
        lecture_id: ID лекции для поиска
        limit: Количество результатов
        
    Returns:
        Список словарей с информацией о материалах
    """
    if not query_embedding or len(query_embedding) != 1024:
        logger.warning("Некорректный эмбеддинг запроса")
        return []
    
    try:
        # Преобразуем список в строку для PostgreSQL
        embedding_str = "[" + ",".join(map(str, query_embedding)) + "]"
        
        # SQL запрос для векторного поиска (косинусное расстояние)
        query = text("""
            SELECT 
                pm.id,
                pm.lecture_id,
                pm.material_id,
                pm.file_url,
                pm.file_type,
                pm.processed_text,
                1 - (pm.embedding <=> :embedding::vector) as similarity
            FROM processed_materials pm
            WHERE pm.lecture_id = :lecture_id
                AND pm.embedding IS NOT NULL
                AND pm.processed_text IS NOT NULL
            ORDER BY pm.embedding <=> :embedding::vector
            LIMIT :limit
        """)
        
        result = db.execute(
            query,
            {
                "embedding": embedding_str,
                "lecture_id": lecture_id,
                "limit": limit
            }
        )
        
        materials = []
        for row in result:
            materials.append({
                "id": row.id,
                "lecture_id": row.lecture_id,
                "material_id": row.material_id,
                "file_url": row.file_url,
                "file_type": row.file_type,
                "processed_text": row.processed_text,
                "similarity": float(row.similarity) if row.similarity else 0.0
            })
        
        return materials
    except Exception as e:
        logger.error(f"Ошибка поиска похожих материалов: {e}", exc_info=True)
        return []


def generate_questions_from_text(
    text: str,
    num_questions: int = 5
) -> Optional[List[Dict[str, Any]]]:
    """
    Генерирует вопросы по тексту используя GigaChat.
    
    Args:
        text: Текст для генерации вопросов
        num_questions: Количество вопросов
        
    Returns:
        Список словарей с вопросами или None в случае ошибки
    """
    if not GIGACHAT_CHAT_AVAILABLE:
        logger.warning("GigaChat Chat недоступен. Установите langchain-gigachat.")
        return None
    
    if not text or not text.strip():
        logger.warning("Текст для генерации вопросов пуст")
        return None
    
    try:
        from app.core.config import GIGA_API_KEY, GIGACHAT_MODEL, GIGACHAT_SCOPE, GIGACHAT_TEMPERATURE
        
        if not GIGA_API_KEY:
            logger.error("GIGA_API_KEY не установлен")
            return None
        
        # Инициализируем GigaChat
        chat = GigaChat(
            credentials=GIGA_API_KEY,
            model=GIGACHAT_MODEL,
            scope=GIGACHAT_SCOPE,
            verify_ssl_certs=False,
            temperature=GIGACHAT_TEMPERATURE
        )
        
        # Ограничиваем длину текста для промпта (GigaChat имеет лимит)
        text_for_prompt = text[:4000] if len(text) > 4000 else text
        
        # Формируем промпт для генерации вопросов
        prompt = f"""На основе следующего текста создай {num_questions} вопросов с вариантами ответов для проверки знаний студентов.

Текст:
{text_for_prompt}

Требования к вопросам:
1. Вопросы должны проверять понимание ключевых концепций из текста
2. Вопросы должны быть разного уровня сложности
3. Каждый вопрос должен иметь 4 варианта ответа (A, B, C, D)
4. Только один вариант должен быть правильным
5. Неправильные варианты должны быть правдоподобными, но неверными
6. Вопросы должны быть на русском языке

Формат ответа (JSON):
{{
  "questions": [
    {{
      "question_text": "Текст вопроса",
      "options": ["Вариант A", "Вариант B", "Вариант C", "Вариант D"],
      "correct_answer": "Вариант A",
      "correct_index": 0
    }}
  ]
}}

Верни ТОЛЬКО валидный JSON, без дополнительного текста."""

        # Генерируем вопросы
        # Ограничиваем одновременные запросы к GigaChat через семафор
        with _gigachat_semaphore:
            response = chat.invoke(prompt)
        
        # Парсим ответ
        response_text = response.content if hasattr(response, 'content') else str(response)
        
        # Извлекаем JSON из ответа
        json_start = response_text.find('{')
        json_end = response_text.rfind('}') + 1
        
        if json_start == -1 or json_end == 0:
            logger.error("Не удалось найти JSON в ответе GigaChat")
            return None
        
        json_str = response_text[json_start:json_end]
        data = json.loads(json_str)
        
        questions = []
        for i, q in enumerate(data.get("questions", [])[:num_questions]):
            options = q.get("options", [])
            correct_answer = q.get("correct_answer", "")
            correct_index = q.get("correct_index", 0)
            
            # Сохраняем варианты как JSON строку
            options_json = json.dumps(options, ensure_ascii=False)
            
            questions.append({
                "question_text": q.get("question_text", ""),
                "correct_answer": correct_answer,
                "options": options_json,
                "question_type": "multiple_choice",
                "order_index": i
            })
        
        logger.info(f"Сгенерировано {len(questions)} вопросов")
        return questions
        
    except json.JSONDecodeError as e:
        logger.error(f"Ошибка парсинга JSON ответа GigaChat: {e}")
        logger.debug(f"Ответ GigaChat: {response_text if 'response_text' in locals() else 'N/A'}")
        return None
    except Exception as e:
        logger.error(f"Ошибка генерации вопросов через GigaChat: {e}", exc_info=True)
        return None

