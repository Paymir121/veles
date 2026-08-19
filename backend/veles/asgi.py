"""ASGI config for veles project."""
import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "veles.settings.dev")

application = get_asgi_application()
