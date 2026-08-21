# Велес (Veles)

Генеалогический трекер семьи: интерактивное семейное дерево и карта захоронений.

## Возможности

- **Семейное дерево** — визуальное отображение родственных связей (библиотека [family-chart](https://github.com/nicedoc/family-chart)). Навигация по поколениям, боковая панель со списком всех людей и поиском.
- **Карта захоронений** — места захоронений на Яндекс.Картах с балунами и привязкой к людям.
- **Поиск** — полнотекстовый поиск по людям и местам захоронений (поддержка кириллицы, е/ё, поиск по году рождения/смерти).
- **Публичный просмотр** — дерево, карта и профили людей доступны без регистрации; создание и редактирование — только для авторизованных пользователей.
- **JWT-аутентификация** — регистрация / вход через Djoser + SimpleJWT.

## Стек

| Слой | Технологии |
|------|------------|
| Backend | Python 3.14, Django 5.2 LTS, Django REST Framework, Djoser, SimpleJWT |
| Frontend | React 18, TypeScript, Vite, TanStack Query, Zustand |
| Карта | Яндекс.Карты (`@pbe/react-yandex-maps`) |
| Дерево | `family-chart` |
| БД | SQLite (локально), PostgreSQL (продакшен) |
| Деплой | Docker Compose, nginx, GitHub Actions → GHCR |

## Быстрый старт (локальная разработка)

### Предварительные требования

- Python 3.12+ (через `py`-лаунчер)
- Node.js 18+

### Установка

```bash
# Клонирование
git clone <repo-url> && cd veles

# Backend
cd backend
py -m venv .venv
.venv\Scripts\activate      # Windows
pip install -r requirements.txt
cp .env.example .env
py manage.py migrate

# Frontend
cd ../frontend
npm install
cp .env.example .env        # прописать VITE_YANDEX_MAPS_API_KEY
```

### Запуск

```bash
# Один скрипт поднимает оба dev-сервера (backend :8000 + frontend :5173)
py main.py
```

Или через обёртки `run.ps1` / `run.bat`.

## Portable exe (Windows)

Папка с `Veles.exe` — тот же формат, что у dsinvent (`build/dist/…`), без Docker и без Node на машине пользователя.

```bash
cd backend
.venv\Scripts\activate
pip install -r requirements-build.txt

cd ..
py build/build.py              # → build/dist/veles_v0.1.0.0.commit-<hash>/
py build/build.py --installer  # плюс Veles_Setup.exe, нужен Inno Setup 6
```

Запуск: `Veles.exe` (консоль, Ctrl+C — стоп). Данные (SQLite, фото, логи) — в `data/` рядом с exe. Карта работает, только если при сборке в `frontend/.env` был `VITE_YANDEX_MAPS_API_KEY`.

Без PyInstaller, из исходников: `npm run build` в `frontend/`, затем `py portable.py`.

### Тестовые данные

```bash
py init.py
```

Создаёт демо-набор из 9 человек, 3 поколений и 2 кладбищ. Тестовый пользователь `admin` / `admin` создаётся миграцией автоматически.

> **Внимание:** `init.py` при каждом запуске полностью стирает все Person / BurialPlace / Union и заливает данные заново. Работает только при `DEBUG=True`.

## Тесты

```bash
# Backend
cd backend
pytest -q

# Frontend
cd frontend
npm test
```

## Docker (продакшен)

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Образы публикуются в GHCR через GitHub Actions (`deploy.yml`).

## Яндекс.Карты API-ключ

Для работы карты нужен API-ключ Яндекс.Карт (продукт «JavaScript API и HTTP Геокодер»). Подробная инструкция — в `docs/yandex-maps.md`.

- Локально: прописать `VITE_YANDEX_MAPS_API_KEY` в `frontend/.env`
- Docker: передаётся как build-arg через корневой `.env`

## Структура проекта

```
backend/          Django + DRF + Djoser
frontend/         React + Vite + TS (feature-based: features/<name>/)
main.py           Локальный запуск обоих dev-серверов
portable.py       Один процесс: Django + собранный SPA (основа exe)
build/            Сборка portable exe (`py build/build.py`)
init.py           Загрузка демо-данных
docker-compose.yml / .prod.yml   Docker-конфигурация
.github/workflows/               CI/CD
docs/                             Документация (Яндекс.Карты и пр.)
```

## Лицензия

[GNU General Public License v3.0](LICENSE)
