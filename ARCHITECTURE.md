# Архитектура проекта

## Структура проекта

```
edu_platform/
├── main.py                 # Точка входа приложения
├── app/                    # Основной пакет приложения
│   ├── __init__.py
│   ├── core/              # Ядро приложения
│   │   ├── __init__.py
│   │   ├── config.py      # Конфигурация (JWT, БД)
│   │   ├── database.py    # Настройки базы данных
│   │   └── security.py    # Аутентификация и авторизация
│   ├── models.py          # SQLAlchemy модели
│   ├── schemas.py         # Pydantic схемы для валидации
│   ├── utils.py           # Вспомогательные функции
│   └── api/               # API роутеры
│       ├── __init__.py
│       └── v1/            # API версия 1
│           ├── __init__.py
│           ├── auth.py    # Роуты аутентификации
│           ├── users.py   # Роуты пользователей
│           └── admin.py   # Роуты админ-панели
├── static/                # Статические файлы (для React билда)
│   └── react/            # Собранное React приложение
├── frontend/             # React фронтенд
│   ├── src/              # Исходный код React
│   │   ├── components/   # React компоненты
│   │   ├── pages/        # Страницы
│   │   ├── services/     # API клиент
│   │   ├── hooks/        # React хуки
│   │   └── styles/       # CSS стили
│   └── package.json      # Зависимости фронтенда
└── requirements.txt       # Зависимости проекта
```

## Описание модулей

### `main.py`
Точка входа приложения. Инициализирует FastAPI приложение, подключает роутеры и статические файлы.

### `app/core/config.py`
Содержит конфигурационные параметры:
- `SECRET_KEY` - секретный ключ для JWT
- `ALGORITHM` - алгоритм шифрования JWT
- `ACCESS_TOKEN_EXPIRE_MINUTES` - время жизни токена
- `DATABASE_URL` - строка подключения к БД

### `app/core/database.py`
Настройки базы данных:
- Создание движка SQLAlchemy
- Настройка сессий
- Инициализация Base для моделей
- Функция `get_db()` для dependency injection
- Функция `ensure_user_schema()` для миграций схемы

### `app/core/security.py`
Модуль аутентификации и авторизации:
- `pwd_context` - контекст для хеширования паролей
- `create_access_token()` - создание JWT токена
- `validate_password_strength()` - валидация силы пароля
- `get_current_user()` - получение текущего пользователя из токена
- `require_admin()` - проверка прав администратора

### `app/models.py`
SQLAlchemy модели:
- `User` - модель пользователя
- `Group` - модель группы

### `app/schemas.py`
Pydantic схемы для валидации данных:
- `ChangePasswordRequest` - смена временного пароля
- `CreateUserRequest` - создание пользователя
- `UserResponse` - ответ с данными пользователя
- `GroupCreateRequest` - создание группы
- `GroupResponse` - ответ с данными группы
- `UpdateProfileRequest` - обновление профиля
- `ChangeOwnPasswordRequest` - смена собственного пароля

### `app/utils.py`
Вспомогательные функции:
- `resolve_user_names()` - извлечение имени, фамилии и отчества
- `compose_full_name()` - составление полного имени
- `normalize_name()` - нормализация имени
- `build_user_response()` - построение ответа с данными пользователя
- `create_default_admin()` - создание администратора по умолчанию

### `app/api/v1/auth.py`
Роуты аутентификации:
- `POST /login` - вход в систему
- `POST /change_password/{user_id}` - смена временного пароля

### `app/api/v1/users.py`
Роуты для работы с пользователями:
- `GET /me` - получение профиля текущего пользователя
- `PUT /me` - обновление профиля
- `POST /me/change_password` - смена собственного пароля

### `app/api/v1/admin.py`
Роуты админ-панели:
- `GET /admin/users` - список всех пользователей
- `POST /admin/create_user` - создание пользователя
- `DELETE /admin/delete_user/{user_id}` - удаление пользователя
- `GET /admin/groups` - список всех групп
- `POST /admin/groups` - создание группы
- `DELETE /admin/groups/{group_id}` - удаление группы
- `GET /admin/groups/{group_id}/users` - список пользователей группы
- `GET /admin/export_users` - выгрузка пользователей в Excel

### `frontend/`
React фронтенд приложение:
- Все страницы обрабатываются React Router на клиенте
- API запросы идут через `/api/*` прокси в режиме разработки
- В продакшене React приложение собирается в `static/react/`

## Запуск приложения

### Backend
```bash
python main.py
```

или

```bash
uvicorn main:app --host 127.0.0.1 --port 8000
```

### Frontend (режим разработки)
```bash
cd frontend
npm install
npm run dev
```

### Frontend (продакшен)
```bash
cd frontend
npm install
npm run build
```

Собранные файлы будут в `static/react/`. Backend автоматически отдает React приложение для всех не-API роутов.
