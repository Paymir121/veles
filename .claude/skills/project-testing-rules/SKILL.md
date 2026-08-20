---
name: project-testing-rules
description: Use when verifying changes, deciding how to test a model/endpoint/UI change, or understanding what "done" means for veles.
---

# Backend (Django/DRF)
- pytest + pytest-django. Coverage focus: Person/BurialPlace/Union validators (alive-vs-burial
  consistency, no-self-parent, ancestor-cycle, extra_info JSON shape, Union duplicate/self checks),
  serializers (tree shape, gender fallback), permissions (anonymous → 401, registration stays open),
  search/filter endpoints (`/api/search/`, `?search=`, `?city=`).
- Run: `pytest -q` from `backend/`.
- `python manage.py makemigrations --check --dry-run` must be clean before merging model changes.
- Any new validator needs one negative + one positive test.

# Frontend (React/Vite)
- Vitest + React Testing Library: PersonForm (conditional alive/deceased fields, optional
  photo fields, dynamic extra_info list), `familyChartAdapter` (Person/Union → family-chart
  `{id,data,rels}` shape), SearchBar (finds both persons and burial places).
- Playwright smoke test: log in → tree renders, a node is clickable → map renders, a
  cluster/pin opens a person detail panel → search finds a person and focuses them. This
  satisfies the project rule that UI changes are verified in a real browser before being
  called done (use Playwright MCP for interactive checks, or `python main.py` + the dev
  server for a fast manual look).
- Run: `npm run test` and `npx playwright test` from `frontend/`.

# Done means
- Backend: relevant pytest file green, validators covered, migrations check clean.
- Frontend: component test for the changed component passes; tree/map/search changes also
  pass (or are manually re-verified via Playwright MCP with a screenshot) the smoke test.

# Tree layout
- Packing looks wrong: run `py dump_tree_layout.py` (optional `--q Фамилия`) from the
  repo root before guessing. It prints grid cells, families, and hole/split checks.

# Avoid
- Declaring a tree/map change done without actually rendering it.
- Adding a Person field that affects the tree without updating the `/api/tree/` transform + test.
- Assuming Yandex Maps API details from memory — verify via Context7 MCP or the official docs.
