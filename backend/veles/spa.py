"""Serve the Vite production bundle and fall back to index.html for client routes."""
from __future__ import annotations

from pathlib import Path

from django.conf import settings
from django.http import Http404, HttpRequest, HttpResponse
from django.views.static import serve as static_serve


def spa_view(request: HttpRequest, rest: str = "") -> HttpResponse:
    if not getattr(settings, "SERVE_SPA", False):
        raise Http404()

    spa_dir = Path(settings.SPA_DIR).resolve()
    if not spa_dir.is_dir():
        raise Http404("SPA bundle missing")

    relative = rest.strip("/")
    first = relative.split("/", 1)[0] if relative else ""
    if first in {"api", "admin", "media", "static"}:
        raise Http404()

    if relative:
        candidate = (spa_dir / relative).resolve()
        try:
            candidate.relative_to(spa_dir)
        except ValueError as exc:
            raise Http404() from exc
        if candidate.is_file():
            return static_serve(request, relative, document_root=str(spa_dir))

    index = spa_dir / "index.html"
    if not index.is_file():
        raise Http404("SPA bundle missing")
    return static_serve(request, "index.html", document_root=str(spa_dir))
