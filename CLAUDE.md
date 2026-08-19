# CLAUDE.md — Велес (Veles)

Генеалогический трекер семьи: общее дерево (family-chart) + карта захоронений (Яндекс.Карты).
Backend: Django + DRF + Djoser + SimpleJWT, SQLite→Postgres. Frontend: React + Vite + TS
(feature-based структура, TanStack Query, Zustand). Локальный запуск без Docker — `main.py`
в корне. Полная архитектура: `AI_MEMORY.md` и `C:\Users\Paymi\.claude\plans\
inherited-knitting-parnas.md`. Cursor читает этот же `CLAUDE.md` (канон — Claude Code,
не отдельное дерево `.cursor/rules`).

## Экономия контекста
- Читать `AI_MEMORY.md` при старте сессии; остальное — по необходимости.
- Проект пока небольшой: отдельной таблицы "стоимость файлов" нет. Завести её здесь,
  когда какой-то файл вырастет за ~1500 строк.
- Не перечитывать файл сразу после своего Write/Edit.
- Аудит по многим файлам — через subagent, в контекст возвращать только итог.
- Фильтровать вывод команд: `pytest -q`, `npm run build | Select-Object -Last 20`.

## Куда смотреть
- `AI_MEMORY.md` — устоявшиеся архитектурные решения (читать первым).
- `C:\dev\obsidian-vault\veles\00_Home.md` — история сессий / вне-проектные заметки.
- Нативная память Claude Code уже активна для этого проекта — писать по мере решений,
  отдельной настройки не требуется.

## MCP / граф кода
См. `.mcp.json`. `code-review-graph` обновляется хуками в `.claude/settings.json` (нужен
`uvx code-review-graph`, no-op если не установлен или не git-репозиторий). `context7` — для
менее mainstream-библиотек (Djoser, family-chart, `@pbe/react-yandex-maps`); если что-то не
покрыто — прямой WebFetch официальной документации, не полагаться на память модели.

## Структура репозитория
```
backend/    Django + DRF + Djoser (см. backend/README или AI_MEMORY.md)
frontend/   React + Vite + TS, feature-based структура (features/<name>/)
main.py     Локальный запуск backend+frontend без Docker — запускать как `py main.py`
            (НЕ `python main.py`: на этой машине `python`/`python3` не в PATH,
            резолвится нерабочий Windows Store alias; `py`-лаунчер работает).
            Есть обёртки `run.ps1` / `run.bat`, которые делают это автоматически.
docker-compose.yml (+ .prod.yml), nginx.conf   — production
.github/workflows/  ci.yml, deploy.yml
```

## Правила
- Аккаунты Claude — глобальное правило в `C:\dev\CLAUDE.md` (один аккаунт на эту машину).
  2026-08-18 оба аккаунта отключили во время сессии Велес; это не бан за код проекта.
- SQL только через Django ORM/DRF — без raw SQL/строковой интерполяции идентификаторов
  (общее правило из `C:\dev\CLAUDE.md`).
- Не считать UI-изменение (дерево/карта/поиск) готовым без реального рендера в браузере
  (Playwright MCP или `python main.py` + dev-сервер) — см. skill `project-testing-rules`.
- Фото человека и могилы — всегда опциональны, не делать их обязательными ни в модели,
  ни в форме.
- Дерево общее для всех пользователей — не добавлять per-object права без явного запроса.
- Минимальные изменения, без спекулятивных абстракций.
