# Переход на React

Проект был переписан на React. Frontend находится в папке `frontend/`.

## Структура проекта

```
edu_platform/
├── frontend/           # React приложение
│   ├── src/
│   │   ├── pages/      # Страницы (Home, Login, Profile, Admin)
│   │   ├── services/   # API клиент
│   │   ├── hooks/      # React хуки (useAuth)
│   │   └── styles/     # CSS стили
│   └── package.json
├── main.py             # FastAPI backend (обновлен с CORS)
├── routers/            # API роутеры
├── models.py           # SQLAlchemy модели
├── schemas.py          # Pydantic схемы
└── static/             # Статические файлы (CSS, изображения, видео)
```

## Запуск проекта

### 1. Backend (FastAPI)

```bash
# Установка зависимостей Python
pip install -r requirements.txt

# Запуск сервера
python main.py
```

Backend будет доступен на http://127.0.0.1:8000

### 2. Frontend (React)

```bash
# Переход в папку frontend
cd frontend

# Установка зависимостей
npm install

# Запуск в режиме разработки
npm run dev
```

Frontend будет доступен на http://localhost:3000

## Режим разработки

В режиме разработки:
- React приложение работает на порту 3000
- FastAPI backend на порту 8000
- Vite прокси перенаправляет `/api/*` запросы на backend
- CORS настроен для работы между портами

## Сборка для продакшена

```bash
cd frontend
npm run build
```

Собранные файлы будут в `static/react/`. Backend автоматически отдает React приложение для всех не-API роутов.

## Основные изменения

1. **Frontend**: Полностью переписан на React с использованием React Router
2. **API**: Все запросы идут через единый API клиент (`frontend/src/services/api.js`)
3. **Аутентификация**: Используется хук `useAuth` для управления состоянием
4. **Стили**: CSS файлы скопированы в `frontend/src/styles/`
5. **Backend**: Добавлен CORS middleware для работы с React dev server

## Компоненты

- **Home** (`frontend/src/pages/Home.jsx`) - Главная страница
- **Login** (`frontend/src/pages/Login.jsx`) - Страница входа
- **Profile** (`frontend/src/pages/Profile.jsx`) - Профиль пользователя
- **Admin** (`frontend/src/pages/Admin.jsx`) - Админ-панель
- **ChangePassword** (`frontend/src/pages/ChangePassword.jsx`) - Смена пароля

## API Endpoints

Все API endpoints остались прежними:
- `POST /login` - Вход
- `POST /change_password/{user_id}` - Смена временного пароля
- `GET /me` - Получение профиля
- `PUT /me` - Обновление профиля
- `POST /me/change_password` - Смена собственного пароля
- `GET /admin/users` - Список пользователей
- `POST /admin/create_user` - Создание пользователя
- И т.д.

