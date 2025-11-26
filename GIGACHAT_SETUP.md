# Настройка GigaChat Embeddings API

## Описание

Платформа использует GigaChat Embeddings API для генерации векторных представлений текста (эмбеддингов) размерностью 1024.

**Схема работы:**
```
Текст → GigaChat Embeddings API → Вектор [1024] → pgvector → PostgreSQL
```

## Установка зависимостей

```bash
pip install -r requirements.txt
```

Установятся следующие пакеты:
- `langchain` - базовый фреймворк для работы с LLM
- `langchain-community` - интеграция с GigaChat
- `gigachat` - клиент для GigaChat API
- `pgvector` - расширение PostgreSQL для векторного поиска

## Настройка переменных окружения

Создайте файл `.env` в корне проекта или установите переменную окружения:

```env
GIGA_API_KEY=your-gigachat-api-key-here
```

**Где получить API ключ:**
1. Зарегистрируйтесь на https://developers.sber.ru/
2. Создайте проект
3. Получите API ключ для GigaChat API

## Использование в коде

### Базовое использование

```python
from app.utils.embeddings import generate_embedding, get_embedding_model

# Генерация эмбеддинга для одного текста
text = "Пример текста для векторизации"
embedding = generate_embedding(text)
# Результат: список из 1024 чисел (float)

# Получение модели напрямую
model = get_embedding_model()
if model:
    embedding = model.embed_query(text)
```

### Батч-обработка

```python
from app.utils.embeddings import generate_embeddings_batch

texts = ["Текст 1", "Текст 2", "Текст 3"]
embeddings = generate_embeddings_batch(texts)
# Результат: список списков, каждый содержит 1024 числа
```

## Модель базы данных

Эмбеддинги сохраняются в таблице `processed_materials`:

```python
class ProcessedMaterial(Base):
    embedding = Column(Vector(1024), nullable=True)  # Вектор размерностью 1024
    processed_text = Column(Text, nullable=True)     # Исходный текст
    file_url = Column(String, nullable=False)      # URL файла
    user_id = Column(Integer, ForeignKey("users.id"))  # Кто загрузил
```

## Векторный поиск в PostgreSQL

После генерации эмбеддингов можно выполнять семантический поиск:

```sql
-- Поиск похожих материалов по косинусному расстоянию
SELECT 
    pm.id,
    pm.processed_text,
    1 - (pm.embedding <=> query_embedding::vector) as similarity
FROM processed_materials pm
WHERE pm.embedding IS NOT NULL
ORDER BY pm.embedding <=> query_embedding::vector
LIMIT 10;
```

## Автоматическая генерация эмбеддингов

Эмбеддинги автоматически генерируются при публикации лекции:

1. Преподаватель загружает материалы (видео, PDF, DOCX)
2. Нажимает кнопку "Выложить" (Publish)
3. Система:
   - Транскрибирует видео/аудио
   - Парсит PDF/DOCX
   - Генерирует эмбеддинги через GigaChat API
   - Сохраняет в базу данных

## Миграция с sentence-transformers

Если вы ранее использовали `sentence-transformers` (размерность 384):

1. **Обновите базу данных:**
   ```sql
   -- Удалите старую колонку
   ALTER TABLE processed_materials DROP COLUMN IF EXISTS embedding;
   
   -- Создайте новую с размерностью 1024
   ALTER TABLE processed_materials ADD COLUMN embedding vector(1024);
   ```

2. **Пересоздайте индекс:**
   ```sql
   DROP INDEX IF EXISTS processed_materials_embedding_idx;
   CREATE INDEX processed_materials_embedding_idx 
   ON processed_materials 
   USING ivfflat (embedding vector_cosine_ops)
   WITH (lists = 100);
   ```

3. **Перегенерируйте эмбеддинги:**
   - Перепубликуйте лекции, чтобы сгенерировать новые эмбеддинги через GigaChat API

## Устранение проблем

### Ошибка: "GIGA_API_KEY не установлен"

Убедитесь, что переменная окружения `GIGA_API_KEY` установлена:
```bash
# Windows (PowerShell)
$env:GIGA_API_KEY="your-key-here"

# Linux/Mac
export GIGA_API_KEY="your-key-here"
```

### Ошибка: "langchain_community не установлен"

Установите зависимости:
```bash
pip install langchain langchain-community gigachat
```

### Ошибка: "Неожиданная размерность эмбеддинга"

GigaChat Embeddings API должен возвращать векторы размерностью 1024. Если размерность отличается, проверьте:
- Версию библиотеки `langchain-community`
- Настройки API (модель должна быть "Embeddings")
- Логи для деталей ошибки

## Производительность

- **Размерность:** 1024 (больше, чем у sentence-transformers, но лучше качество)
- **API вызовы:** Каждый запрос к GigaChat API требует сетевого запроса
- **Рекомендации:**
  - Используйте батч-обработку для нескольких текстов
  - Кэшируйте эмбеддинги в базе данных
  - Обрабатывайте материалы асинхронно при публикации лекций

