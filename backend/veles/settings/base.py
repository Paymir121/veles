"""Base Django settings for Veles, shared by dev.py and prod.py.

Reads all environment-specific values from `.env` (via django-environ) so the
same codebase moves from local SQLite to a containerized Postgres deployment
through configuration only -- no code changes.
"""
import logging
from datetime import timedelta
from pathlib import Path

import environ

# backend/veles/settings/base.py -> parents: settings/ -> veles/ -> backend/
BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env(
    DEBUG=(bool, False),
)
# Local dev / bare-metal reads backend/.env; inside Docker the real env vars
# are injected by docker-compose and this file simply won't exist, which is fine.
environ.Env.read_env(BASE_DIR / ".env")

SECRET_KEY = env("SECRET_KEY", default="django-insecure-change-me")
DEBUG = env.bool("DEBUG", default=False)
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=[])

# --- Applications ---------------------------------------------------------

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # third-party
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "djoser",
    "corsheaders",
    "django_filters",
    # local
    "accounts",
    "genealogy",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "veles.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "veles.wsgi.application"
ASGI_APPLICATION = "veles.asgi.application"

# --- Database --------------------------------------------------------------

# Default matches .env.example: SQLite relative to backend/ (not the
# /app/... absolute path, which is only meaningful inside the Docker image).
DATABASES = {
    "default": env.db("DATABASE_URL", default="sqlite:///db.sqlite3"),
}

# --- Auth --------------------------------------------------------------

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# --- i18n --------------------------------------------------------------

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# --- Static / media --------------------------------------------------------

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
# True only in veles.settings.portable: Django serves the Vite bundle.
SERVE_SPA = False

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- CORS --------------------------------------------------------------

# Not actually load-bearing in production (frontend and backend share one
# origin behind nginx) but kept as a safety net for local dev where the Vite
# dev server runs on a different port.
CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=[])

# --- DRF / SimpleJWT / Djoser --------------------------------------------

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 100,
    # DRF ships DecimalFields as JSON strings by default. BurialPlace
    # latitude/longitude are fed straight into Yandex Maps geometry, which
    # needs real numbers, so emit them as numbers instead of making every
    # consumer remember to parse them.
    "COERCE_DECIMAL_TO_STRING": False,
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=14),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
}

DJOSER = {
    "LOGIN_FIELD": "username",
    "USER_CREATE_PASSWORD_RETYPE": True,
    "SEND_ACTIVATION_EMAIL": False,
    "SERIALIZERS": {
        "current_user": "accounts.serializers.UserSerializer",
        "user": "accounts.serializers.UserSerializer",
    },
    "PERMISSIONS": {
        "user_create": ["rest_framework.permissions.AllowAny"],
    },
}

# --- Logging ---------------------------------------------------------------

# Route Django's own output (runserver access log, request/server errors)
# through the same handlers/format as the project's `py_logger`
# (logger/logger.py), instead of Django's untouched default config -- so
# everything printed by the backend looks the same regardless of whether it
# came from our own code or from Django itself. Reuses the *exact* handler
# instances py_logger already uses (ColoredFormatter, and the daily-rotating
# file handler via its existing singleton factory) rather than duplicating
# them, so there's a single log file/console stream, not two.
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "veles_console": {
            "()": "logger.logger.ColoredFormatter",
            "format": "|%(levelname)-8s|%(asctime)s|: %(message)s",
        },
        "veles_file": {
            "format": "%(asctime)s - %(levelname)s - %(message)s",
        },
    },
    "handlers": {
        "veles_console": {
            "class": "logging.StreamHandler",
            "formatter": "veles_console",
        },
        "veles_file": {
            "()": "logger.logger._get_daily_file_handler",
            "formatter": "veles_file",
        },
    },
    "loggers": {
        "django": {
            "handlers": ["veles_console", "veles_file"],
            "level": env("LOG_LEVEL", default="INFO"),
            "propagate": False,
        },
        "django.server": {
            "handlers": ["veles_console", "veles_file"],
            "level": "INFO",
            "propagate": False,
        },
        # Third-party warnings (e.g. PyJWT's InsecureKeyLengthWarning) go
        # through `warnings.warn()`, not `logging`, by default -- captureWarnings
        # bridges them into this same "py.warnings" logger so nothing bypasses
        # the project's logging pipeline.
        "py.warnings": {
            "handlers": ["veles_console", "veles_file"],
            "level": "WARNING",
            "propagate": False,
        },
    },
}
logging.captureWarnings(True)
