# AI Memory — Велес (Veles)

## Process
- Личный некоммерческий проект. Простота важнее энтерпрайз-надёжности, но код обязан быть
  корректным и безопасным (без SQL-инъекций, без XSS, с настоящей авторизацией).
- Claude/Anthropic: 2026-08-18 во время сессии Велес (Playwright по localhost:5173) оба
  аккаунта отключили пакетом. Это связка ПК+VPS+два аккаунта, не AUP проекта. Дальше —
  один аккаунт на машину, без шаринга VPN-exit и без выноса OAuth. Канон:
  `C:\dev\CLAUDE.md` + скилл `claude-account-safety`.

## Устоявшиеся решения
- Одно общее дерево, все зарегистрированные пользователи читают/пишут всё. Без per-object прав.
- Backend: Django 5.2 LTS + DRF + Djoser + SimpleJWT, свой пустой `accounts.User(AbstractUser)`.
  SQLite сейчас через `DATABASE_URL` (django-environ); переход на Postgres — правка `.env`,
  `psycopg2-binary` уже установлен.
- JWT в localStorage (не httpOnly cookie) — осознанный компромисс простоты vs. XSS-риска.
  access 30 мин, refresh 14 дней, ротация+blacklist.
- `Person.gender == "U"` в `/api/tree/` мапится в `"M"` только косметически (family-chart
  принимает только M/F); настоящее значение остаётся в `data.gender_actual` и везде в БД.
- Union: дубликат = одинаковая неупорядоченная пара + одинаковый `date_start`; допускает
  повторный брак тех же двух людей с другой датой.
- Cascade: `Person.father/mother/burial_place/linked_user/created_by/updated_by` = SET_NULL;
  `Union.person1/person2` = CASCADE.
- Фото (`Person.photo`, `Person.grave_photo`) необязательны — форма и модель это допускают.
- Карта — Яндекс.Карты (`@pbe/react-yandex-maps`), не Leaflet/OSM — проект российский.
  Требуется `VITE_YANDEX_MAPS_API_KEY`, привязанный к домену в консоли Яндекса.
- `@pbe/react-yandex-maps` грузит модули API по требованию (`load=` пустой): всё сверх
  минимума нужно перечислять в пропе `modules`, иначе оно молча отсутствует. Так у метки не
  было `.balloon` и балун не открывался (2026-08-19). Актуальный список модулей и подробности
  — `docs/yandex-maps.md`, раздел «Модули API загружаются по требованию».
- Поиск — `django-filter` + DRF `SearchFilter` + отдельный `GET /api/search/?q=`,
  объединяющий Person и BurialPlace. `BurialPlace.city` — отдельное индексированное поле.
  На SQLite `icontains` идёт через `LIKE`, который не сворачивает кириллический регистр;
  в `genealogy.apps.GenealogyConfig.ready()` регистрируется Unicode-`like()` на соединении.
- Логика `/api/search/` живёт в `genealogy/services.py` (`build_person_search_q`,
  `build_burial_place_search_q`, `order_person_search`): слова запроса объединяются по AND,
  поля и написания `е/ё` — по OR, четырёхзначное слово дополнительно матчится на год
  рождения/смерти. Ранжирование: попадание в собственные `first_name`/`last_name` выше
  попадания через девичью фамилию/место, потом алфавит. Персона в ответе несёт
  `burial_place_detail` (`PersonSearchSerializer`), чтобы карта летела к могиле без
  второго запроса. `REST_FRAMEWORK["COERCE_DECIMAL_TO_STRING"] = False` — координаты
  уходят числами, их принимает геометрия Яндекс.Карт.
- nginx — один сервис (финальная стадия frontend Dockerfile), отдаёт SPA + проксирует
  `/api`, `/admin` в backend, `/media`, `/static` из общих volume.
- Деплой: сборка образов → GHCR → SSH + `docker compose pull && up -d`. Два compose-файла
  (dev с `build:`, prod с `image:` overrides).
- Локальная разработка без Docker — верхнеуровневый `main.py` поднимает оба dev-сервера.
- `.claude/` версионируется (кроме `settings.local.json`) — skills/settings.json общие для
  всех, кто клонирует репозиторий.
- На этой машине `python`/`python3` не резолвятся в PATH (только нерабочий Windows Store
  alias) — реальный интерпретатор (3.14) стоит в `C:\Users\Paymi\AppData\Local\Programs\
  Python\Python314\`, но найти его можно только через `py`-лаунчер. Поэтому `main.py`
  запускается как `py main.py` (или `run.ps1`/`run.bat`), не `python main.py`.

## Реализовано и проверено (2026-08-18)
- Backend и frontend реализованы фоновыми агентами по плану, каждый владел своей папкой
  (`backend/`, `frontend/`) параллельно. Оба прошли собственные тесты (`pytest -q`: 42/42;
  `npm run test`: 20/20, `npm run build`/`lint` чисты).
- Docker-compose/nginx/CI-CD дописаны отдельно (интеграционный слой, после того как обе
  папки появились) — Docker на этой машине не установлен, поэтому сам compose-стек собрать
  и прогнать локально не удалось, только вычитан на корректность путей/переменных.
- Сквозной smoke-test через `py main.py` (оба dev-сервера) + curl: регистрация → логин →
  JWT → создание BurialPlace/Person (father/child) → `/api/tree/` отдаёт точный
  `{id,data,rels}` формат → `/api/search/` находит по частичному совпадению → валидация
  alive+burial_place действительно возвращает 400 → кириллица в JSON работает (первая
  попытка ловила mojibake — оказалось артефакт кодировки Git Bash при передаче кириллицы
  через `-d "..."`, не баг бэкенда; с файлом в UTF-8 всё ок). Тестовые данные и SQLite после
  проверки сброшены (`db.sqlite3` пересоздан, миграции применены заново).
- `@pbe/react-yandex-maps` требует React `^16||^17||^18` — `npm create vite` по умолчанию
  поставил React 19, agent запинил `react`/`react-dom` на `18.3.1` (совместимо со всем
  остальным стеком). Если апгрейдить React в будущем — сначала проверить, снял ли
  `@pbe/react-yandex-maps` этот кап.
- `family-chart`/`@pbe/react-yandex-maps` API проверялись по реальным `.d.ts` с unpkg (доки
  сайтов неполные) — см. комментарии в `frontend/src/features/tree/familyChartAdapter.ts` и
  `frontend/src/shared/maps/yandexMapsSetup.ts`.
- На этой машине `python`/`python3` не в PATH (только Windows Store alias) — `main.py`
  запускать через `py main.py` или `run.ps1`/`run.bat` (см. ниже).

## Логгер и тестовый пользователь (2026-08-18)
- `backend/logger/logger.py` — портирован с того же паттерна, что в dsinvent/ts_piot
  (`py_logger`, `Logger(logging.Logger)`, уровни SUCCESS=25/COMPLETE=11, цветной консольный
  форматтер, `DayRotatingFileHandler` — один файл в день в `backend/log/`). Осознанно
  выброшено то, что не применимо к Django-бэкенду без GUI/WebSocket: `LOG_BUFFER` +
  WebSocket-рассылка (было в ts_piot), интеграция с PySide6 log-панелью (было в
  dsinvent/dsconfig). Используется как `from logger.logger import py_logger, error_logger`
  — уже подключено в `genealogy/services.py` (`@error_logger()` на `serialize_tree`) и
  `genealogy/views.py` (create/update/search логируются).
- Уровень — через `LOG_LEVEL` в `.env` (читается напрямую в `Logger.__init__`, как и
  `LOG_FUNCTIONS` в оригинальном паттерне): `DEBUG` в `backend/.env.example` (локально),
  `INFO` в корневом `.env.example` (Docker/прод). `LOG_FUNCTIONS=1` включает подробное
  логирование входа/выхода функций через `@error_logger()` — по умолчанию выключено.
- В Docker логи и на диске (volume `backend_logs:/app/log`, переживает пересоздание
  контейнера), и в `docker compose logs` (консольный handler).
- Постоянный тестовый пользователь `admin`/`admin` — data-миграция
  `accounts/0002_seed_admin_user.py`, идемпотентна (создаёт только если username "admin" ещё
  не существует, не трогает при повторных `migrate`). **Осознанно слабый, известный пароль**
  — нормально для локальной разработки непубличного проекта, но убрать/сменить перед любым
  реальным интернет-деплоем.

## Публичный просмотр дерева/карты и палитра (2026-08-18)
- Просмотр дерева, карты и отдельного человека (`/tree`, `/map`, `/person/:id`) не требует
  логина; создание/редактирование (`/person/new`, `/person/:id/edit`) — требует. На бэкенде:
  `TreeView`, `SearchView`, `BurialPlaceViewSet.list/retrieve`, `PersonViewSet.retrieve` —
  `AllowAny`; всё остальное (включая `PersonViewSet.list`) — `IsAuthenticated`. Поиск открыт
  специально: `/api/tree/` уже отдаёт все имена/связи публично, поэтому закрывать поиск не
  защищало бы ничего реального, только сломало бы поле поиска на публичных страницах.
- Список людей (`/api/persons/` list) остаётся закрытым — единственная реальная граница
  приватности, которая тут осталась (просмотр по одному через дерево/карту — открыт).
- Фронтенд: `RequireAuth` теперь оборачивает только `/person/new` и `/person/:id/edit`
  (внутри общего `Layout`, не снаружи). `NavBar` и `PersonDetailPage` условно показывают
  Войти/Регистрация или Выйти/Редактировать в зависимости от `useAuthStore.isAuthenticated`.
- Палитра — бело-голубая-синяя с небольшим акцентом изумрудного: `--accent` синий (#2563eb
  light / #60a5fa dark), новая `--accent-secondary` изумрудная (#10b981 light / #34d399
  dark) — используется на `.navbar-brand` и как цвет женских карточек в дереве (мужские —
  синие). `family-chart` красит карточки/линии через свои CSS-переменные на `.f3`
  (`--male-color`/`--female-color`/`--genderless-color`/`--background-color`/`--text-color`)
  — переопределены в `index.css` под `.tree-view-container .f3` вместо правки самой
  библиотеки.
- Жив/умер в дереве отмечается цветом **кружка ноды** (обводка аватара `.f3-card-avatar`:
  `--accent-secondary` / `--status-deceased`), а не рамкой карточки — у карточки нейтральная
  рамка `1px var(--border)`. Класс статуса по-прежнему на `.f3-card-inner`
  (`familyChartAdapter.buildCardInnerHtml`), цвет применяется к вложенному кружку.
  `--status-deceased` разный в light/dark (почти чёрный / светло-серый).

## Тестовые данные (2026-08-18)
- `init.py` (корень, рядом с `main.py`) — `py init.py` **полностью стирает** все
  Person/BurialPlace/Union и заливает демо-данные заново, при КАЖДОМ запуске (не только если
  БД пуста) — так и задумано, среда тестовая. `User`-ов (включая admin/admin) не трогает.
  `seed_demo_data` отказывается выполняться, если `DEBUG=False` (`CommandError`) — защита от
  случайного стирания настоящих данных, если команду когда-нибудь запустят на реальном
  деплое.
- Сами данные — человекочитаемый JSON `backend/genealogy/fixtures/demo_data.json`: 3
  поколения (9 человек), 2 кладбища, 3 брака. Люди/кладбища ссылаются друг на друга по
  строковому `"key"`, не по id (id ещё не существуют на момент написания файла).
- Загрузка — management-команда `genealogy/management/commands/seed_demo_data.py` (не
  Django `loaddata`: формат fixtures/loaddata требует PK и не умеет самоссылающиеся FK
  (father/mother) по человекочитаемым ключам). Два прохода: сначала все Person без
  father/mother, потом простановка родителей — иначе ребёнка, упомянутого в JSON раньше
  родителя, не на что было бы сослаться. `full_clean()` на каждую запись — та же валидация,
  что и через API (в т.ч. ancestor-cycle проверка реально прогоняется на этих данных).
  `init.py` — тонкая обёртка, вызывает `backend/.venv/…/python.exe manage.py
  seed_demo_data` (тот же паттерн резолва интерпретатора, что в `main.py`).
- **Грабли**: `latitude`/`longitude` в JSON обязаны быть строками (`"55.7761"`), не числами —
  сырой JSON-float теряет точность как binary double и не проходит `DecimalField`-валидацию
  (`full_clean()` кидает "no more than 6 decimal places"). Задокументировано в `_comment`
  внутри самого `demo_data.json`.
- В Docker/CI пока не подключено (не просили) — легко добавить строкой перед `migrate` в
  `docker-compose.yml`, если понадобится демо-данные и в контейнере.

## family-chart: реальные ограничения библиотеки (2026-08-18, проверено вживую через Playwright)
- **`ancestry_depth`/`progeny_depth` по умолчанию = 1 генерация** (`layout/calculate-tree.js`,
  `Chart.createStore()` их не передаёт) — без явной настройки библиотека показывает только
  главного человека ± 1 поколение, а НЕ весь граф. Исправлено в
  `familyChartAdapter.ts`: `setAncestryDepth(25).setProgenyDepth(25).setShowSiblingsOfMain(true)`.
- **`main_id` по умолчанию = `data[0].id`**, т.е. зависит от порядка, в котором backend отдаёт
  людей (`Person.Meta.ordering = ["last_name","first_name"]` — алфавитный, "Морозов" < "Соколов"
  в кириллице). Раньше `main_id` случайно попадал на человека, женившегося В семью (без
  родителей в БД) — глубина считается ТОЛЬКО от кровной линии `main_id`, у "примака" её нет,
  поэтому видно было только его непосредственных супругов/детей (баг "видно только Морозовых").
  Исправлено: `findWidestRootId()` выбирает кровного предка с максимальным числом кровных
  потомков. Библиотека всё равно рисует только ОДНУ кровную линию (лес не умеет), поэтому
  рядом с деревом есть панель «Люди» (`features/tree/PeoplePanel.tsx` + `treePeople.ts`):
  список ВСЕХ людей с фильтром по имени/годам, сгруппированный по связным компонентам графа
  (заголовок группы — самая широкая кровная линия). Клик перецентрирует дерево. Она заменила
  прежний селект «Ветка семьи» (2026-08-19): выбор ветки требовал знать, в какой ветке
  человек, а искомого человека всё равно надо было потом найти глазами.
- **Известное огр.**: если у "примака" есть ВТОРОЙ брак/ребёнок от другого партнёра (Виктор →
  Ольга умерла → Татьяна, Роман) — эта ветка не попадает в окно вокруг Соколовых. Показать её
  можно, выбрав любого её человека в панели «Люди» (или ссылкой `/tree?person=<id>` — её даёт
  кнопка «Показать в дереве» на странице человека), ценой пересчёта окна от нового `main_id`.
- Связь между людьми (линии) рисуется через `<path class="link">` с ЖЁСТКО заданным
  `stroke="#fff"` (JS/D3, не CSS) — на белом фоне невидимо. Переопределено в `index.css`:
  `.tree-view-container.f3 .links_view path.link { stroke: var(--text-muted); }`.
- Контейнеру дерева нужны классы `f3 f3-cont` (библиотека их не добавляет сама, только ждёт от
  вызывающего кода — `container.classList.add('f3','f3-cont')` в адаптере), иначе ВСЯ CSS
  библиотеки (включая `width/height:100%` у `svg.main_svg`) не активируется вообще.
- Высота дерева: библиотечный `.f3.f3-cont { height:900px; max-height:70vh }` переопределён
  на `height:100%; max-height:none` у `.tree-view-container.f3.f3-cont`, плюс `#root { height:100vh }`
  и `flex:1; min-height:0` по цепочке `.app-layout` → `.app-content` → `.tree-page`.
- `main.py`: `wait_for_backend()` перед Vite + `vite --force`. Фронт дополнительно ретраит
  `GET /api/tree/` (8 попыток с backoff) и показывает кнопку «Повторить», потому что глобальный
  QueryClient был с `retry: 1` и первая ECONNREFUSED становилась вечной ошибкой.

## Открыто / отложено
- Сервер не выбран — `deploy.yml` написан, но секреты Environment `production` не заполнены.
- Postgres — только когда понадобится, чисто конфигурационно.
- Password reset / email-активация — намеренно не реализованы (не нужен SMTP).
- Яндекс.Карты API-ключ — инструкция в `docs/yandex-maps.md`. Нужен продукт «JavaScript API
  и HTTP Геокодер» (карта + `ymaps.geocode()` в пикере места захоронения), лимиты бесплатного
  тарифа: 25 000/сутки JS API и 1 000/сутки геокодер, тарифицируются раздельно с мая 2025.
  **Грабли**: Vite читает `.env` только из `frontend/`; ключ в корневом `.env` работает лишь
  для docker-compose (build-arg). Локально нужен `frontend/.env` (создан 2026-08-19 из
  корневого ключа). Условия бесплатного тарифа формально требуют открытого доступа —
  просмотр у нас открыт, редактирование за логином (осознанный риск, не гарантия
  соответствия оферте).
