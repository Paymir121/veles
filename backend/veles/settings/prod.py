"""Production settings, selected by DJANGO_SETTINGS_MODULE=veles.settings.prod
(set as an environment variable in docker-compose, not here).
"""
import environ

from .base import *  # noqa: F401,F403

DEBUG = False

env = environ.Env()
SECRET_KEY = env("SECRET_KEY")

# The app sits behind nginx, which terminates the client connection; this
# header lets Django know the original request was HTTPS once nginx is
# configured to set it (TLS itself is out of scope until a domain exists).
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
