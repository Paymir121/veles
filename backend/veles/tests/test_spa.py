from pathlib import Path

import pytest
from django.http import Http404
from django.test import RequestFactory, override_settings

from veles.spa import spa_view


def _body(response) -> bytes:
    if getattr(response, "streaming", False):
        return b"".join(response.streaming_content)
    return response.content


def test_spa_disabled_is_404():
    request = RequestFactory().get("/")
    with override_settings(SERVE_SPA=False):
        with pytest.raises(Http404):
            spa_view(request, rest="")


def test_spa_serves_index_and_assets(tmp_path: Path):
    (tmp_path / "index.html").write_text("<html>veles-index</html>", encoding="utf-8")
    assets = tmp_path / "assets"
    assets.mkdir()
    (assets / "app.js").write_text("console.log(1)", encoding="utf-8")

    factory = RequestFactory()
    with override_settings(SERVE_SPA=True, SPA_DIR=tmp_path):
        index = spa_view(factory.get("/"), rest="")
        assert index.status_code == 200
        assert b"veles-index" in _body(index)

        asset = spa_view(factory.get("/assets/app.js"), rest="assets/app.js")
        assert asset.status_code == 200
        assert b"console.log" in _body(asset)

        client_route = spa_view(factory.get("/tree"), rest="tree")
        assert client_route.status_code == 200
        assert b"veles-index" in _body(client_route)


def test_spa_rejects_path_traversal(tmp_path: Path):
    (tmp_path / "index.html").write_text("<html>ok</html>", encoding="utf-8")
    factory = RequestFactory()
    with override_settings(SERVE_SPA=True, SPA_DIR=tmp_path):
        with pytest.raises(Http404):
            spa_view(factory.get("/x"), rest="../secrets.txt")
