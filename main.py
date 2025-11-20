"""Точка входа приложения"""
import logging

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pathlib import Path

from app.core.database import SessionLocal
from app.api.v1 import api_router
from app.utils import create_default_admin

# Настройка логирования
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

# Создание приложения
app = FastAPI()

# Настройка CORS для React
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
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

# Создание администратора по умолчанию
create_default_admin(SessionLocal())


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
