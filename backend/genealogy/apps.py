import re

from django.apps import AppConfig
from django.db.backends.signals import connection_created


def _like_pattern_to_regex(pattern: str, escape: str) -> re.Pattern[str]:
    """Translate a SQL LIKE pattern (`%`/`_` wildcards, `escape`-escaped
    literals) into an equivalent case-folded regex."""
    parts = []
    i = 0
    while i < len(pattern):
        char = pattern[i]
        if escape and char == escape and i + 1 < len(pattern):
            i += 1
            parts.append(re.escape(pattern[i]))
        elif char == "%":
            parts.append(".*")
        elif char == "_":
            parts.append(".")
        else:
            parts.append(re.escape(char))
        i += 1
    return re.compile("".join(parts), re.DOTALL)


def _unicode_like(pattern, value, escape="\\"):
    if pattern is None or value is None:
        return None
    regex = _like_pattern_to_regex(pattern.casefold(), escape)
    return 1 if regex.fullmatch(value.casefold()) else 0


def _use_unicode_like(sender, connection, **kwargs):
    """SQLite's built-in `LIKE` operator (what Django's icontains/istartswith/
    icontains-family lookups compile to on SQLite -- confirmed via
    `queryset.query`, it's a plain `col LIKE %pattern% ESCAPE '\\'`, not a
    call to UPPER()/LOWER()) only case-folds ASCII, so a search like
    "москва" silently fails to match a stored "Москва": not an exception,
    just zero rows.

    SQLite explicitly supports overriding this: if the application registers
    its own SQL function named "like" (2-arg, or 3-arg with an ESCAPE char),
    SQLite calls that instead of its built-in implementation. Registering a
    Unicode-aware (str.casefold()-based) version here fixes every
    icontains/contains query project-wide without touching individual views.
    No-op on Postgres (ILIKE is already Unicode-correct there), which is why
    this is gated on connection.vendor.
    """
    if connection.vendor == "sqlite":
        connection.connection.create_function("like", 2, _unicode_like)
        connection.connection.create_function("like", 3, _unicode_like)


class GenealogyConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "genealogy"

    def ready(self):
        connection_created.connect(_use_unicode_like)
