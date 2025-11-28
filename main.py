"""Точка входа приложения"""
import logging

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pathlib import Path

from app.core.database import SessionLocal, init_database
from app.core.limiter import limiter
from app.api.v1 import api_router
from app.utils import create_default_admin

# Импортируем модели, чтобы они зарегистрировались в Base.metadata
import app.models  # Это нужно для регистрации моделей перед create_all()

# Настройка логирования
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

# Импорты для rate limiting (опционально, если slowapi установлен)
try:
    from slowapi.errors import RateLimitExceeded
    from slowapi.middleware import SlowAPIMiddleware
    SLOWAPI_AVAILABLE = True
except ImportError:
    SLOWAPI_AVAILABLE = False

# Создание приложения
app = FastAPI()

# Настройка rate limiting (если slowapi доступен)
if SLOWAPI_AVAILABLE:
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, lambda request, exc: JSONResponse(
        status_code=429,
        content={"detail": f"Rate limit exceeded: {exc.detail}"}
    ))
    app.add_middleware(SlowAPIMiddleware)
    logger.info("Rate limiting включен")
else:
    logger.warning("slowapi не установлен, rate limiting отключен. Установите: pip install slowapi redis")

# Настройка CORS для React
from app.core.config import CORS_ORIGINS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключение статических файлов (для React билда в продакшене)
static_dir = Path("static")
if static_dir.exists():
    app.mount("/static", StaticFiles(directory="static"), name="static")

# Подключение статических файлов для загруженных материалов
uploads_dir = Path("uploads")
uploads_dir.mkdir(exist_ok=True)  # Создаем директорию, если её нет
app.mount("/uploads", StaticFiles(directory=str(uploads_dir.absolute())), name="uploads")

# Подключение роутеров
app.include_router(api_router)

# Для продакшена: отдаем React приложение на всех остальных роутах
@app.get("/{full_path:path}")
async def serve_react_app(full_path: str):
    """Отдает React приложение для всех не-API роутов"""
    try:
        # Если это API запрос или статические файлы, пропускаем
        if full_path.startswith("api/") or full_path.startswith("static/") or full_path.startswith("uploads/"):
            return JSONResponse({"detail": "Not found"}, status_code=404)
        
        # Проверяем, существует ли собранное React приложение
        react_build = Path("static/react/index.html")
        if react_build.exists() and react_build.is_file():
            return FileResponse(react_build)
        
        # В режиме разработки возвращаем HTML с инструкцией
        html_content = """
        <!DOCTYPE html>
        <html>
        <head>
            <title>React App Not Built</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 40px; text-align: center; }
                h1 { color: #333; }
                p { color: #666; }
            </style>
        </head>
        <body>
            <h1>React App Not Built</h1>
            <p>В режиме разработки используйте Vite dev server:</p>
            <p><code>cd frontend && npm run dev</code></p>
            <p>Или соберите React приложение для продакшена:</p>
            <p><code>cd frontend && npm run build</code></p>
        </body>
        </html>
        """
        from fastapi.responses import HTMLResponse
        return HTMLResponse(content=html_content)
    except Exception as e:
        logger.error(f"Error serving React app: {e}", exc_info=True)
        return JSONResponse({"detail": f"Internal server error: {str(e)}"}, status_code=500)

# Создание администратора по умолчанию (после инициализации БД)
def init_app():
    """Инициализация приложения: создание админа"""
    import time
    max_retries = 5
    retry_delay = 2
    
    for attempt in range(max_retries):
        try:
            from app.core.database import init_database
            # Убеждаемся, что база данных инициализирована
            init_database()
            # Небольшая задержка, чтобы убедиться, что таблицы созданы
            time.sleep(1)
            # Создаем администратора
            create_default_admin(SessionLocal())
            logger.info("Приложение инициализировано")
            return
        except Exception as e:
            if attempt < max_retries - 1:
                logger.warning(f"Попытка {attempt + 1}/{max_retries} инициализации не удалась, повтор через {retry_delay}с: {e}")
                time.sleep(retry_delay)
            else:
                logger.error(f"Ошибка инициализации приложения после {max_retries} попыток: {e}", exc_info=True)

# Инициализируем приложение (отложенная инициализация через startup event)
@app.on_event("startup")
async def startup_event():
    """Инициализация при старте приложения"""
    init_app()
    
    # Предзагружаем модель Whisper в фоновом режиме
    import asyncio
    import threading
    
    def preload_whisper_model():
        """Предзагрузка модели Whisper в отдельном потоке"""
        try:
            from app.utils.transcription import get_whisper_model, WHISPER_AVAILABLE
            from app.core.config import WHISPER_MODEL, WHISPER_DEVICE, WHISPER_COMPUTE_TYPE
            
            if WHISPER_AVAILABLE:
                logger.info(f"Предзагрузка модели Whisper ({WHISPER_MODEL})...")
                model = get_whisper_model(
                    model_name=WHISPER_MODEL, 
                    device=WHISPER_DEVICE, 
                    compute_type=WHISPER_COMPUTE_TYPE
                )
                logger.info("Модель Whisper успешно предзагружена и готова к использованию")
            else:
                logger.warning("Whisper недоступен, предзагрузка пропущена")
        except Exception as e:
            logger.warning(f"Не удалось предзагрузить модель Whisper: {e}. Модель будет загружена при первом использовании.")
    
    # Запускаем предзагрузку в отдельном потоке, чтобы не блокировать старт приложения
    threading.Thread(target=preload_whisper_model, daemon=True).start()
    logger.info("Запущена предзагрузка модели Whisper в фоновом режиме")


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
