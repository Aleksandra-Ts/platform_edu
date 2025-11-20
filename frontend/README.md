# React Frontend для платформы "Умный конспект"

## Установка зависимостей

```bash
npm install
```

## Запуск в режиме разработки

```bash
npm run dev
```

Приложение будет доступно по адресу http://localhost:3000

## Сборка для продакшена

```bash
npm run build
```

Собранные файлы будут в папке `../static/react/`

## Структура проекта

```
frontend/
├── src/
│   ├── components/     # Переиспользуемые компоненты
│   ├── pages/          # Страницы приложения
│   ├── services/       # API клиент
│   ├── hooks/          # React хуки
│   └── styles/         # Стили
├── public/             # Статические файлы
└── package.json
```

## API

Все API запросы идут через `/api` прокси (настроен в vite.config.js), который перенаправляет на FastAPI backend на порту 8000.

