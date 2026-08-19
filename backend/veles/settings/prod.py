"""Production settings, selected by DJANGO_SETTINGS_MODULE=veles.settings.prod
(set as an environment variable in docker-compose, not here).
"""
from .base import *  # noqa: F401,F403

DEBUG = False

# The app sits behind nginx, which terminates the client connection; this
# header lets Django know the original request was HTTPS once nginx is
# configured to set it (TLS itself is out of scope until a domain exists).
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
